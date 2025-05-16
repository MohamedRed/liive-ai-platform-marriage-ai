# apps/marriage-ai/dataflow/pipelines/streaming/transforms/answer_parsing.py
import apache_beam as beam
import logging
import openai
import traceback
import json # For parsing LLM JSON output
from typing import Dict, Any, List, Tuple
from apache_beam.metrics import Metrics

from ..common import config # For ANSWER_PARSING_MODEL_NAME
from ..utils import access_secret
# from .common import MetricNames # If you have a common MetricNames enum

logger = logging.getLogger(__name__)

# Define specific metric names for this DoFn
ANSWER_PARSING_ERRORS = 'AnswerParsingErrors'
STATEMENTS_EXTRACTED_COUNT = 'StatementsExtractedCount'
LLM_RESPONSE_PARSE_FAILURES = 'LLMResponseParseFailures'
EMPTY_ANSWER_SKIPPED = 'EmptyAnswerSkipped'

class ParseAnswerStatementsDoFn(beam.DoFn):
    """Parses a user's answer into distinct statements and determines the facet for each."""
    OUTPUT_ERROR_TAG = 'error' # Define an error tag

    # Define output tags if we want to separate successful parsing from elements that had issues
    # For now, this DoFn will output a list of statements for each input element, or an empty list on failure.
    # The main output will be the element augmented with a list of these parsed statements.

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.model_name = config.ANSWER_PARSING_MODEL_NAME
        self.logger = logging.getLogger(__name__)
        self.client = None
        self.error_counter = Metrics.counter('ParseAnswerStatementsDoFn', ANSWER_PARSING_ERRORS)
        self.statements_extracted_counter = Metrics.counter('ParseAnswerStatementsDoFn', STATEMENTS_EXTRACTED_COUNT)
        self.llm_parse_failure_counter = Metrics.counter('ParseAnswerStatementsDoFn', LLM_RESPONSE_PARSE_FAILURES)
        self.empty_answer_counter = Metrics.counter('ParseAnswerStatementsDoFn', EMPTY_ANSWER_SKIPPED)

    def setup(self):
        self.logger.info(f"Setting up OpenAI client for answer parsing using model {self.model_name}")
        try:
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.client = openai.OpenAI(api_key=api_key)
            self.logger.info("OpenAI client setup complete for answer parsing.")
        except Exception as e:
            self.logger.error(f"Failed to setup OpenAI client for answer parsing: {e}", exc_info=True)
            raise

    def _parse_llm_response_for_statements(self, llm_response_content: str, question_text: str, original_answer: str) -> List[Dict[str, str]]:
        """Parses the LLM's JSON response to extract statement objects."""
        try:
            # The LLM is prompted to return a JSON list of objects.
            # Example: "[{\"statement\": \"I like hiking.\", \"facet\": \"attribute\"}, ...]"
            parsed_statements = json.loads(llm_response_content)
            if not isinstance(parsed_statements, list):
                self.logger.warning(f"LLM response was not a list for Q: '{question_text}', A: '{original_answer}'. Response: {llm_response_content}")
                self.llm_parse_failure_counter.inc()
                return []

            valid_statements = []
            for stmt_obj in parsed_statements:
                if isinstance(stmt_obj, dict) and 'statement' in stmt_obj and 'facet' in stmt_obj:
                    if stmt_obj['facet'] in ['attribute', 'preference']:
                        valid_statements.append({
                            'statement_text': stmt_obj['statement'],
                            'facet': stmt_obj['facet']
                        })
                    else:
                        self.logger.warning(f"Invalid facet '{stmt_obj['facet']}' in LLM response for Q: '{question_text}'. Statement: '{stmt_obj['statement']}'")
                        self.llm_parse_failure_counter.inc()
                else:
                    self.logger.warning(f"Malformed statement object in LLM response for Q: '{question_text}'. Object: {stmt_obj}")
                    self.llm_parse_failure_counter.inc()
            
            self.statements_extracted_counter.inc(len(valid_statements))
            return valid_statements
        except json.JSONDecodeError as e:
            self.logger.error(f"JSONDecodeError parsing LLM response for Q: '{question_text}', A: '{original_answer}': {e}. Response content: {llm_response_content}", exc_info=True)
            self.llm_parse_failure_counter.inc()
            return []
        except Exception as e:
            self.logger.error(f"Unexpected error parsing LLM response for Q: '{question_text}': {e}. Response: {llm_response_content}", exc_info=True)
            self.llm_parse_failure_counter.inc()
            return []

    def _get_statements_from_llm(self, question_text: str, answer_text: str) -> List[Dict[str, str]]:
        """Calls an LLM to segment the answer and classify facets for each segment."""
        if not self.client:
            raise RuntimeError("OpenAI client for answer parsing is not initialized.")

        prompt = (
            f"Analyze the following answer provided by a user to the question: '{question_text}'\n"
            f"User's Answer: '{answer_text}'\n\n"
            f"Your task is to segment this answer into distinct, self-contained statements. "
            f"For each statement, determine if it primarily describes the user's own characteristics, facts about them, or their current state (an 'attribute'), "
            f"or if it describes what they are looking for in a partner, their desires, or their preferences for a relationship or partner (a 'preference').\n\n"
            f"Please return your analysis as a JSON list of objects. Each object in the list should represent a single statement "
            f"and must have two keys: 'statement' (the text of the segmented statement) and 'facet' (either 'attribute' or 'preference').\n"
            f"Example Response Format: "
            f"[\n"
            f"  {{\"statement\": \"I am a software engineer living in London.\", \"facet\": \"attribute\"}},\n"
            f"  {{\"statement\": \"I enjoy hiking on weekends and trying new vegan restaurants.\", \"facet\": \"attribute\"}},\n"
            f"  {{\"statement\": \"I am looking for a partner who is kind, funny, and shares my love for the outdoors.\", \"facet\": \"preference\"}}\n"
            f"]\n\n"
            f"If the answer is too short, vague, or doesn't provide clear statements that can be classified, return an empty list []."
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2, # Moderately low for consistency but allowing some nuance
                response_format={"type": "json_object"} # Request JSON output if model supports
            )
            if response and response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content
                return self._parse_llm_response_for_statements(content, question_text, answer_text)
            else:
                self.logger.warning(f"LLM returned no valid choice for answer parsing. Q: '{question_text}'. Response: {response}")
                self.error_counter.inc()
                return []
        except Exception as e:
            self.logger.error(f"LLM call failed for answer parsing. Q: '{question_text}', A: '{answer_text}': {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            return []

    def process(self, element: Dict[str, Any]):
        """
        Receives an element containing user_id, question_id, question_text, and answer_text.
        Outputs the element augmented with a list of parsed_statements.
        Example input: {
            'user_id': 'u1',
            'question_id': 'q1',
            'question_text': 'Tell me about yourself.',
            'answer_text': 'I am a doctor. I like travel.'
            # ... other fields from upstream if any
        }
        Example output: {
            'user_id': 'u1',
            'question_id': 'q1',
            'question_text': 'Tell me about yourself.',
            'answer_text': 'I am a doctor. I like travel.',
            'parsed_statements': [
                {'statement_text': 'I am a doctor', 'facet': 'attribute', 'original_question_text': 'Tell me about yourself.', 'original_question_id': 'q1', 'user_id': 'u1'},
                {'statement_text': 'I like travel', 'facet': 'attribute', 'original_question_text': 'Tell me about yourself.', 'original_question_id': 'q1', 'user_id': 'u1'}
            ]
        }
        """
        if not self.client:
             self.logger.error("OpenAI client not initialized in process. Skipping answer parsing.")
             self.error_counter.inc()
             # This is a setup/critical error, yield to error tag
             yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "OpenAI client not initialized", "element": element})
             return

        user_id = element.get('user_id')
        question_id = element.get('question_id')
        question_text = element.get('question_text')
        answer_text = element.get('answer_text')

        if not all([user_id, question_id, question_text, answer_text]):
            self.logger.warning(f"Missing one or more required fields (user_id, question_id, question_text, answer_text) in element: {element}. Skipping parsing.")
            self.error_counter.inc()
            # Missing essential data, yield to error tag
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": "Missing required fields", "element": element})
            return
        
        if not answer_text.strip():
            self.logger.info(f"Empty answer_text for user '{user_id}', QID '{question_id}'. Skipping parsing.")
            self.empty_answer_counter.inc()
            element['parsed_statements'] = []
            yield element # Yield to main output for empty answers
            return

        try:
            statements_with_facets = self._get_statements_from_llm(question_text, answer_text)
            
            # Augment each statement with original Q&A context for downstream embedding
            parsed_statements_for_output = []
            for stmt in statements_with_facets:
                parsed_statements_for_output.append({
                    **stmt, # statement_text, facet
                    'original_question_text': question_text,
                    'original_question_id': question_id,
                    'user_id': user_id 
                    # Add original_answer_text if embedding needs it, though current plan is Q_text + statement_text
                })
            
            element['parsed_statements'] = parsed_statements_for_output
            yield element

        except Exception as e:
            self.logger.error(f"Unexpected error in answer parsing process for user '{user_id}', QID '{question_id}': {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            element['parsed_statements'] = [] # Ensure key exists even on error
            yield beam.pvalue.TaggedOutput(self.OUTPUT_ERROR_TAG, {"error_message": f"Unexpected error in answer parsing process: {str(e)}", "element": element, "traceback": traceback.format_exc()})


@beam.ptransform_fn
def ParseAnswerIntoStatements(pcoll: beam.PCollection[Dict[str, Any]], project_id: str) -> beam.PCollectionTuple:
    """
    PTransform to parse a user's answer into distinct statements with facets.
    Input PCollection elements should be dictionaries containing:
    'user_id', 'question_id', 'question_text', 'answer_text'.

    Args:
        pcoll: PCollection of Q&A dictionaries.
        project_id: GCP Project ID for API key access.

    Returns:
        PCollectionTuple containing:
         - 'main': PCollection of the same dictionaries, augmented with a 'parsed_statements' list.
         - 'error': PCollection of elements that failed processing.
    """
    results = (
        pcoll
        | 'ParseAnswerStatements' >> beam.ParDo(ParseAnswerStatementsDoFn(project_id=project_id))
                                   .with_outputs(ParseAnswerStatementsDoFn.OUTPUT_ERROR_TAG, main='main')
    )
    return results 