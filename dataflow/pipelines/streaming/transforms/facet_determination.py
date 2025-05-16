# apps/marriage-ai/dataflow/pipelines/streaming/transforms/facet_determination.py
import apache_beam as beam
import logging
import openai # Using openai for now, can be parameterized if needed
import traceback
from typing import Dict, Any
from apache_beam.metrics import Metrics

# Assuming common MetricNames and access_secret utility are available
# If these are in specific locations, adjust imports accordingly.
# from .common import MetricNames # Uncomment if MetricNames is defined in a .common module
from ..utils import access_secret

logger = logging.getLogger(__name__)

# Define specific metric names if not using a shared MetricNames enum
FACET_DETERMINATION_ERRORS = 'FacetDeterminationErrors'
FACET_DETERMINATION_SUCCESS = 'FacetDeterminationSuccess'
FACET_PARSE_FAILURES = 'FacetParseFailures'

class DetermineQuestionFacetDoFn(beam.DoFn):
    """Determines if a question is an 'attribute' or 'preference' using an LLM call."""
    def __init__(self, project_id: str, model_name: str = "gpt-3.5-turbo"):
        self.project_id = project_id
        self.model_name = model_name
        self.logger = logging.getLogger(__name__)
        self.client = None
        self.error_counter = Metrics.counter('DetermineQuestionFacetDoFn', FACET_DETERMINATION_ERRORS)
        self.success_counter = Metrics.counter('DetermineQuestionFacetDoFn', FACET_DETERMINATION_SUCCESS)
        self.parse_failure_counter = Metrics.counter('DetermineQuestionFacetDoFn', FACET_PARSE_FAILURES)

    def setup(self):
        self.logger.info(f"Setting up OpenAI client for facet determination using model {self.model_name}")
        try:
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            self.client = openai.OpenAI(api_key=api_key)
            self.logger.info("OpenAI client setup complete for facet determination.")
        except Exception as e:
            self.logger.error(f"Failed to setup OpenAI client for facet determination: {e}", exc_info=True)
            raise

    def _get_facet_from_llm(self, question_text: str) -> str:
        """Calls an LLM to classify the question facet."""
        if not self.client:
            self.logger.error("OpenAI client not initialized in _get_facet_from_llm. This should not happen if setup succeeded.")
            # This indicates a severe issue if client is None after setup
            raise RuntimeError("OpenAI client for facet determination is not initialized.")

        prompt = (
            f"Given the following question: '{question_text}'. "
            f"Is this question primarily asking about the user's own characteristics and information (an 'attribute') "
            f"or what they are looking for in a partner or their preferences (a 'preference')? "
            f"Respond with only the single word 'attribute' or 'preference'."
        )
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0, # Low temperature for deterministic classification
                max_tokens=5 # 'attribute' or 'preference' are short
            )
            
            # Ensure response and choices are valid
            if response and response.choices and len(response.choices) > 0:
                facet = response.choices[0].message.content.strip().lower()
                if facet in ["attribute", "preference"]:
                    self.success_counter.inc()
                    return facet
                else:
                    self.logger.warning(f"LLM returned unexpected facet for question '{question_text}': {facet}. Defaulting to 'attribute'.")
                    self.parse_failure_counter.inc()
                    return "attribute" # Default fallback
            else:
                self.logger.warning(f"LLM returned no valid choice for question '{question_text}'. Defaulting to 'attribute'. Response: {response}")
                self.parse_failure_counter.inc()
                return "attribute" # Default fallback

        except Exception as e:
            self.logger.error(f"LLM call failed for facet determination of question '{question_text}': {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            # Decide on error handling: re-raise, or return default?
            # Returning default allows pipeline to continue but might use incorrect facet.
            # Re-raising would send to DLQ if configured. For now, let's return a default.
            self.logger.warning(f"LLM call failed. Defaulting facet to 'attribute' for question '{question_text}'.")
            return "attribute"


    def process(self, selected_question: Dict[str, Any]):
        """Receives a selected question, determines its facet, and yields it augmented."""
        if not self.client:
             self.logger.error("OpenAI client not initialized in process. Skipping facet determination.")
             self.error_counter.inc() # Count as an error if client isn't ready
             # Potentially re-raise to indicate a problem with the DoFn's state
             # For now, yield the element as is to allow pipeline to continue, though facet will be missing.
             # This should ideally be caught by setup failing.
             yield selected_question # Yield as is, facet will be missing
             return

        question_text = selected_question.get('question_text')

        if not question_text:
            self.logger.warning(f"Received selected_question without 'question_text': {selected_question}. Cannot determine facet.")
            self.error_counter.inc()
            yield selected_question # Yield as is
            return
        
        try:
            facet = self._get_facet_from_llm(question_text)
            selected_question['facet'] = facet
            # self.logger.info(f"Determined facet '{facet}' for question: '{question_text[:50]}...'")
            yield selected_question
        except Exception as e:
            # Errors from _get_facet_from_llm should be handled there, 
            # but if an unexpected one bubbles up or if client wasn't init.
            self.logger.error(f"Unexpected error in process for question '{question_text}': {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            self.error_counter.inc()
            selected_question['facet'] = 'attribute' # Default in case of unexpected error
            yield selected_question


@beam.ptransform_fn
def DetermineFacetForQuestion(
    pcoll: beam.PCollection[Dict[str, Any]], 
    project_id: str, 
    model_name: str = "gpt-3.5-turbo"
) -> beam.PCollection[Dict[str, Any]]:
    """
    PTransform to determine the facet ('attribute' or 'preference') for a selected question.

    Args:
        pcoll: PCollection of selected question dictionaries.
        project_id: GCP Project ID for API key access.
        model_name: The LLM model to use for facet determination.

    Returns:
        PCollection of question dictionaries, augmented with a 'facet' key.
    """
    return (
        pcoll
        | 'DetermineQuestionFacet' >> beam.ParDo(
            DetermineQuestionFacetDoFn(project_id=project_id, model_name=model_name)
        )
    ) 