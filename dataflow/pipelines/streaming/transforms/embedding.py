# apps/marriage-ai/dataflow/pipelines/streaming/transforms/embedding.py
import apache_beam as beam
import logging
import traceback
import openai # Keep import here as it's specific to this DoFn
from apache_beam.metrics import Metrics

# Import constants and metrics from common
from .common import MetricNames
# Import utility functions
from ..utils import access_secret

logger = logging.getLogger(__name__)

class GenerateUserEmbedding(beam.DoFn):
    def __init__(self, project_id):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('GenerateUserEmbedding', MetricNames.ERRORS)
        self.missing_qa_counter = Metrics.counter('GenerateUserEmbedding', 'missing_qa_counter')
        self.client = None # Initialize client

        # Define weights for different sections
        # TODO: Consider making weights configurable (e.g., pipeline options)
        self.section_weights = {
            "religious_practice": 2.0,    # Higher weight for religious aspects
            "family_values": 1.5,         # Important family values
            "education": 1.2,             # Education background
            "personality": 1.0,           # Base weight for personality traits
            "hobbies": 0.8,              # Lower weight for hobbies
            "default": 1.0               # Default weight for undefined sections
        }

    def setup(self):
        # Setup runs once per worker
        self.logger.info("Setting up OpenAI client")
        try:
            # Use the utility function to get the secret
            api_key = access_secret(self.project_id, "OPENAI_API_KEY")
            # Ensure the library is initialized correctly
            self.client = openai.OpenAI(api_key=api_key)
            self.logger.info("OpenAI client setup complete")
        except Exception as e:
             self.logger.error(f"Failed to setup OpenAI client: {e}", exc_info=True)
             # If setup fails, process will likely fail. Raising here is appropriate.
             raise

    def process(self, profile):
        if not self.client:
             self.logger.error("OpenAI client not initialized. Skipping embedding generation.")
             self.error_counter.inc()
             raise RuntimeError("OpenAI client failed to initialize in setup.")

        profile_id = profile.get('id', '[UNKNOWN_ID]')
        try:
            # self.logger.info(f"Generating embedding for profile: {profile_id}")
            qa_list = profile.get("questions_answers", [])

            if not qa_list:
                self.logger.warning(f"No questions_answers found for profile {profile_id}. Cannot generate embedding.")
                self.missing_qa_counter.inc()
                return # Don't yield if no data

            # 1. Generate embeddings for each QA pair
            qa_embeddings = []
            for qa in qa_list:
                # Ensure QA structure is as expected
                question = qa.get('question')
                answer = qa.get('answer')
                if not question or not answer:
                     self.logger.warning(f"Skipping QA item with missing question or answer for profile {profile_id}: {qa}")
                     continue

                qa_text = f"Q: {question}\nA: {answer}"
                embedding = self._get_embedding(qa_text)
                section = qa.get('section', 'default') # Get section, default if missing
                # self.logger.info(f"Generated embedding for QA in section '{section}', length: {len(embedding)}")
                qa_embeddings.append({
                    'embedding': embedding,
                    'section': section,
                    'weight': qa.get('weight', 1.0) # Individual QA weight if specified
                })

            if not qa_embeddings:
                 self.logger.warning(f"No valid QA pairs found to generate embedding for profile {profile_id}.")
                 self.missing_qa_counter.inc()
                 return

            # 2. Group embeddings by section
            section_groups = {}
            for qa_emb in qa_embeddings:
                section = qa_emb['section']
                if section not in section_groups:
                    section_groups[section] = []
                section_groups[section].append(qa_emb)

            # self.logger.info(f"Grouped QAs into {len(section_groups)} sections: {list(section_groups.keys())}")

            # 3. Combine embeddings within each section (weighted average)
            section_embeddings = {}
            embedding_size = len(qa_embeddings[0]['embedding']) # Get embedding size

            for section, items in section_groups.items():
                section_weight = self.section_weights.get(section, self.section_weights['default'])
                # self.logger.info(f"Processing section '{section}' with weight {section_weight}")
                # self.logger.info(f"Found {len(items)} QAs in section '{section}'")

                weighted_sum = [0.0] * embedding_size
                total_item_weight = 0.0

                for item in items:
                    # Combine individual QA weight and section weight
                    effective_weight = item['weight'] * section_weight
                    # self.logger.info(f"Using weight {effective_weight} (QA weight: {item['weight']} * section weight: {section_weight})")
                    for i, val in enumerate(item['embedding']):
                        weighted_sum[i] += val * effective_weight
                    total_item_weight += effective_weight

                # Normalize section embedding if total weight is positive
                if total_item_weight > 0:
                    section_embeddings[section] = [x / total_item_weight for x in weighted_sum]
                    # self.logger.info(f"Generated combined embedding for section '{section}', length: {len(section_embeddings[section])}")
                else:
                    self.logger.warning(f"Total weight for section '{section}' is zero. Skipping section embedding.")

            if not section_embeddings:
                self.logger.error(f"No section embeddings could be generated for profile {profile_id}. Cannot create final embedding.")
                self.error_counter.inc()
                return

            # 4. Combine section embeddings into final profile embedding (weighted average)
            final_embedding = [0.0] * embedding_size
            total_section_weight = 0.0

            for section, embedding in section_embeddings.items():
                # Weight of the section itself (could use self.section_weights again or assume normalized sections)
                weight = self.section_weights.get(section, self.section_weights['default']) # Use section weights for final combination
                for i, val in enumerate(embedding):
                    final_embedding[i] += val * weight
                total_section_weight += weight

            # Normalize final embedding
            if total_section_weight > 0:
                final_embedding = [x / total_section_weight for x in final_embedding]
                # Log final embedding length
                # self.logger.info(f"Generated final embedding of length: {len(final_embedding)} for profile {profile_id}")
                yield (profile_id, final_embedding)
            else:
                self.logger.error(f"Total section weight is zero for profile {profile_id}. Cannot normalize final embedding.")
                self.error_counter.inc()
                return

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error generating embedding for profile {profile_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            raise

    def _get_embedding(self, text):
        """Get embedding for a single text using the initialized client."""
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-large", # Consider making model configurable
                input=text,
                encoding_format="float"
            )
            return response.data[0].embedding
        except Exception as e:
             self.logger.error(f"OpenAI embedding API call failed: {e}", exc_info=True)
             raise # Propagate error to be caught by main process loop


@beam.ptransform_fn
def GenerateProfileEmbedding(pcoll: beam.PCollection[dict], project_id: str) -> beam.PCollection[tuple[str, list[float]]]:
    """Composite PTransform to generate embeddings for user profiles.

    Args:
        pcoll: PCollection of profile dictionaries.
        project_id: GCP Project ID.

    Returns:
        PCollection of tuples (user_id, embedding_vector).
    """
    return (
        pcoll
        | "GenerateEmbeddings" >> beam.ParDo(GenerateUserEmbedding(project_id))
    ) 