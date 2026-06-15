#!/usr/bin/env python
#
# Copyright 2024 Marriage AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0

"""An Apache Beam streaming pipeline for user matching.

It reads user profile update events from Pub/Sub, generates embeddings using OpenAI,
queries Pinecone for matches, calculates lying scores for answers using OpenAI,
reranks matches based on compatibility and lying scores, and writes results to 
Firestore. The lying scores are used by the AI to adjust match compatibility scores.
"""

from __future__ import annotations
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions
import logging
import argparse
import apache_beam.transforms.window as window
from apache_beam.transforms import trigger
import warnings
from apache_beam.metrics import Metrics
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress warnings
warnings.filterwarnings("ignore", category=Warning)

class MetricNames:
    PROCESSED = 'processed_profiles'
    ERRORS = 'processing_errors'
    QUERIES = 'pinecone_queries'

COLLECTIONS = {
    "USERS": "USERS",
    "USER_INFO": "USER_INFO",
    "USER_SETTINGS": "USER_SETTINGS",
    "QUESTIONS_ANSWERS": "QAS",
    "QA_EDIT_LOGS": "QA_EDIT_LOGS",
    "IDENTITY_VERIFICATIONS": "ID_VERIFICATIONS",
    "USER_WALI_RELATION_VERIFICATIONS": "USER_WALI_RELATION_VERIFICATIONS",
    "WALI_USER_PROVIDED_INFO": "WALI_USER_PROVIDED_INFO",
    "WALI_INFO": "WALI_INFO",
    "MATCHES": "MATCHES",
    "AUDIT_LOGS": "AUDIT_LOGS"
}

def get_pipeline_options(known_args):
    """Get pipeline configuration mixing runtime args and secrets"""
    options = PipelineOptions(
        runner=known_args.runner,
        project=known_args.project,
        pinecone_region=known_args.pinecone_region,
        profiles_collection=known_args.profiles_collection,
        matches_collection=known_args.matches_collection,
        top_k=int(known_args.top_k),
        temp_location=known_args.temp_location,
        staging_location=known_args.staging_location,
        pinecone_index=known_args.pinecone_index,
        dlq_bucket=known_args.dlq_bucket,
        job_name=f"user-matching-streaming-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        user_profile_updated_pubsub_topic=known_args.user_profile_updated_pubsub_topic,
        delayed_matching_pubsub_topic=known_args.delayed_matching_pubsub_topic,
    )
    
    # Enable streaming mode
    standard_options = options.view_as(StandardOptions)
    standard_options.streaming = True
    
    return options

class DebugLogDoFn(beam.DoFn):
    """DoFn for debugging pipeline steps"""
    def __init__(self, step_name):
        self.step_name = step_name
        self.logger = logging.getLogger(__name__)

    def process(self, element):
        import json
        try:
            self.logger.info(f"\n=== {self.step_name} ===")
            self.logger.info(f"Element type: {type(element)}")
            if isinstance(element, dict):
                self.logger.info(f"Element content: {json.dumps(element, indent=2)}")
            else:
                self.logger.info(f"Element content: {element}")
            yield element
        except Exception as e:
            self.logger.error(f"Error in {self.step_name}: {str(e)}")
            yield element

class ExtractUserIDDoFn(beam.DoFn):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def process(self, element):
        import traceback
        try:
            self.logger.info(f"Processing PubSub element: {element}")
            
            # Handle PubSub message format
            if hasattr(element, 'attributes'):
                # Direct PubSub message
                user_id = element.attributes.get('user_id')
            else:
                # Dictionary format
                user_id = element.get('attributes', {}).get('user_id')
            
            if not user_id:
                self.logger.error("No user_id found in PubSub message")
                return
                
            self.logger.info(f"Extracted user_id: {user_id}")
            yield user_id
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error extracting user_id: {str(e)}\nTraceback: {traceback.format_exc()}")
            raise

class FetchProfileDoFn(beam.DoFn):
    def __init__(self, project_id, collection_name, is_test=False):
        self.project_id = project_id
        self.collection_name = collection_name
        self.is_test = is_test
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def setup(self):
        if not self.is_test:
            from google.cloud import firestore
            self.db = firestore.Client(project=self.project_id)

    def process(self, user_id):
        import json
        import traceback
        try:
            self.logger.info(f"Fetching profile for user: {user_id}")
            if self.is_test:
                test_profile = {
                    'id': user_id,
                    'isVerified': True,
                    'isWaliVerified': True,
                    'questions_answers': [
                        {
                            'question': 'What are your hobbies?',
                            'answer': 'I enjoy reading, hiking, and programming.'
                        },
                        {
                            'question': 'What are you looking for in a spouse?',
                            'answer': 'Someone who is kind, religious, and family-oriented.'
                        }
                    ]
                }
                self.logger.info(f"Generated test profile: {json.dumps(test_profile, indent=2)}")
                yield test_profile
                return

            doc = self.db.collection(self.collection_name).document(user_id).get()
            if not doc.exists:
                self.logger.warning(f"Profile {user_id} not found")
                return
            
            profile = doc.to_dict()
            profile['id'] = user_id
            yield profile
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error fetching profile: {str(e)}\nTraceback: {traceback.format_exc()}")
            raise

class ValidateProfileDoFn(beam.DoFn):
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.processed_counter = Metrics.counter('main', MetricNames.PROCESSED)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def process(self, profile):
        import traceback
        try:
            self.logger.info(f"Validating profile: {profile['id']}")
            if profile.get("isVerified") and profile.get("isWaliVerified"):
                self.logger.info(f"Profile {profile['id']} passed validation")
                self.processed_counter.inc()  # Use instance counter
                yield profile
            else:
                self.logger.info(f"Profile {profile['id']} failed validation")
                self.error_counter.inc()  # Use instance counter
        except Exception as e:
            self.error_counter.inc()  # Use instance counter
            self.logger.error(f"Error validating profile: {str(e)}\nTraceback: {traceback.format_exc()}")
            raise

class GenerateUserEmbedding(beam.DoFn):
    def __init__(self, project_id):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)
        import openai
        self.openai = openai
        
        # Define weights for different sections
        self.section_weights = {
            "religious_practice": 2.0,    # Higher weight for religious aspects
            "family_values": 1.5,         # Important family values
            "education": 1.2,             # Education background
            "personality": 1.0,           # Base weight for personality traits
            "hobbies": 0.8,              # Lower weight for hobbies
            "default": 1.0               # Default weight for undefined sections
        }

    def _access_secret(self, secret_name):
        """Fetch secret from GCP Secret Manager"""
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{self.project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")

    def setup(self):
        self.logger.info("Setting up OpenAI client")
        api_key = self._access_secret("OPENAI_API_KEY")
        self.client = self.openai.OpenAI(api_key=api_key)
        self.logger.info("OpenAI client setup complete")

    def process(self, profile):
        try:
            self.logger.info(f"Generating embedding for profile: {profile['id']}")
            qa_list = profile.get("questions_answers", [])
            
            if not qa_list:
                self.logger.error("No questions_answers found")
                return

            # 1. Generate embeddings for each QA pair
            qa_embeddings = []
            for qa in qa_list:
                qa_text = f"Q: {qa['question']}\nA: {qa['answer']}"
                embedding = self._get_embedding(qa_text)
                section = qa.get('section', 'default')
                self.logger.info(f"Generated embedding for QA in section '{section}', length: {len(embedding)}")
                qa_embeddings.append({
                    'embedding': embedding,
                    'section': section,
                    'weight': qa.get('weight', 1.0) # Individual QA weight if specified
                })

            # 2. Group embeddings by section
            section_groups = {}
            for qa in qa_embeddings:
                section = qa['section']
                if section not in section_groups:
                    section_groups[section] = []
                section_groups[section].append(qa)
            
            self.logger.info(f"Grouped QAs into {len(section_groups)} sections: {list(section_groups.keys())}")

            # 3. Combine embeddings within each section (weighted average)
            section_embeddings = {}
            for section, items in section_groups.items():
                # Get section weight
                section_weight = self.section_weights.get(section, self.section_weights['default'])
                self.logger.info(f"Processing section '{section}' with weight {section_weight}")
                self.logger.info(f"Found {len(items)} QAs in section '{section}'")
                
                # Combine embeddings in this section
                weighted_sum = [0.0] * len(items[0]['embedding'])
                total_weight = 0
                
                for item in items:
                    weight = item['weight'] * section_weight
                    self.logger.info(f"Using weight {weight} (QA weight: {item['weight']} * section weight: {section_weight})")
                    for i, val in enumerate(item['embedding']):
                        weighted_sum[i] += val * weight
                    total_weight += weight
                
                # Normalize
                section_embeddings[section] = [x/total_weight for x in weighted_sum]
                self.logger.info(f"Generated combined embedding for section '{section}', length: {len(section_embeddings[section])}")

            # 4. Combine section embeddings into final profile embedding
            final_embedding = self._combine_section_embeddings(section_embeddings)
            
            # Log section contributions
            section_norms = {
                section: sum(x*x for x in embedding)**0.5 
                for section, embedding in section_embeddings.items()
            }
            total_norm = sum(section_norms.values())
            
            self.logger.info("Section contributions to final embedding:")
            for section, norm in section_norms.items():
                contribution = (norm / total_norm) * 100
                self.logger.info(f"- {section}: {contribution:.2f}%")
            
            self.logger.info(f"Generated final embedding of length: {len(final_embedding)}")
            yield (profile["id"], final_embedding)
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error generating embedding: {str(e)}")
            raise

    def _get_embedding(self, text):
        """Get embedding for a single text"""
        response = self.client.embeddings.create(
            model="text-embedding-3-large",
            input=text,
            encoding_format="float"
        )
        return response.data[0].embedding

    def _combine_section_embeddings(self, section_embeddings):
        """Combine section embeddings into final profile embedding"""
        # Initialize with zeros
        embedding_size = len(next(iter(section_embeddings.values())))
        final_embedding = [0.0] * embedding_size
        total_weight = 0
        
        # Weighted sum of section embeddings
        for section, embedding in section_embeddings.items():
            weight = self.section_weights.get(section, self.section_weights['default'])
            for i, val in enumerate(embedding):
                final_embedding[i] += val * weight
            total_weight += weight
        
        # Normalize
        return [x/total_weight for x in final_embedding]

class QueryPinecone(beam.DoFn):
    def __init__(self, project_id, pinecone_region, pinecone_index, top_k):
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index = pinecone_index
        self.top_k = top_k
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)
        self.query_counter = Metrics.counter('main', MetricNames.QUERIES)

    def _access_secret(self, secret_name):
        """Fetch secret from GCP Secret Manager"""
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{self.project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")

    def setup(self):
        """
        Initializes the Pinecone index and rate limiting parameters.
        """
        from pinecone.grpc import PineconeGRPC
        import time
        
        # Initialize Pinecone
        pc = PineconeGRPC(
            api_key=self._access_secret("PINECONE_API_KEY"),
            environment=self.pinecone_region
        )
        
        # Convert index name to valid format
        index_name = self.pinecone_index.lower().replace('_', '-')
        
        try:
            # Try to get existing index
            self.index = pc.Index(index_name)
            self.logger.info("Connected to Pinecone index")
        except Exception as e:
            self.logger.info(f"Index {index_name} not found, creating new index...")
            # Create index if it doesn't exist
            pc.create_index(
                name=index_name,
                dimension=3072,  # OpenAI embedding dimension
                metric='cosine',
                spec={
                    'serverless': {
                        'cloud': 'gcp',
                        'region': self.pinecone_region
                    }
                }
            )
            # Wait for index to be ready
            while True:
                try:
                    status = pc.describe_index(index_name).status
                    if status.get('ready'):
                        break
                    time.sleep(1)
                except Exception as e:
                    self.logger.warning(f"Waiting for index to be ready: {str(e)}")
                    time.sleep(1)
            
            self.index = pc.Index(index_name)
        
        # Rate limiting setup
        self.total_qru_limit = 2000
        self.qru_per_query = None
        self.query_count = 0
        self.start_time = time.time()
        self.safety_margin = 0.9     # 90% of limit to be safe

    def process(self, item):
        import time
        try:
            user_id, embedding = item
            
            while True:
                current_time = time.time()
                elapsed_time = current_time - self.start_time

                # Reset counters every second
                if elapsed_time >= 1:
                    self.query_count = 0
                    self.start_time = current_time
                    self.logger.info("Reset query count and start time for new time window")

                # If this is the first query or we need to recalibrate
                if self.qru_per_query is None:
                    self.logger.info("Performing calibration query to determine QRU usage")
                    result = self.index.query(
                        vector=embedding,
                        top_k=self.top_k,
                        include_metadata=True
                    )
                    self.qru_per_query = result.get('usage', {}).get('readUnits', 10)  # Default to 10 if not found
                    self.logger.info(f"Calibrated QRU per query: {self.qru_per_query}")
                    
                    # Calculate max queries per second with safety margin
                    self.max_queries_per_second = int((self.total_qru_limit * self.safety_margin) // self.qru_per_query)
                    self.logger.info(f"Maximum queries per second: {self.max_queries_per_second}")

                # Check if we can make another query
                if self.query_count < self.max_queries_per_second:
                    # Perform the query
                    result = self.index.query(
                        vector=embedding,
                        top_k=self.top_k,
                        include_metadata=True
                    )

                    query_start_time = time.time()  # Capture query start time

                    # Update QRU tracking
                    actual_qru = result.get('usage', {}).get('readUnits', self.qru_per_query)
                    if actual_qru != self.qru_per_query:
                        self.logger.warning(f"QRU usage changed from {self.qru_per_query} to {actual_qru}")
                        self.qru_per_query = actual_qru
                        self.max_queries_per_second = int((self.total_qru_limit * self.safety_margin) // self.qru_per_query)

                    # Process results
                    matches = []
                    for match in result.matches:
                        matches.append({
                            'id': match.id,
                            'score': match.score,
                            'metadata': match.metadata if hasattr(match, 'metadata') else None
                        })

                    # Increment counter and yield result
                    self.query_count += 1
                    self.logger.info(f"Query {self.query_count}/{self.max_queries_per_second} in current window")
                    
                    # Add metric for successful queries
                    self.query_counter.inc()
                    
                    # Add more detailed logging for matches
                    self.logger.info(f"Found {len(matches)} matches for user {user_id}")
                    for match in matches:
                        self.logger.info(f"Match: {match['id']} with score {match['score']}")
                    
                    # Add query time to the results
                    return {
                        'user_id': user_id,
                        'matches': matches,
                        'query_time': query_start_time  # Include the query time
                    }
                    break
                else:
                    # Wait for next time window
                    remaining_time = max(0, 1 - elapsed_time)
                    self.logger.info(f"Rate limit reached. Waiting {remaining_time:.2f}s for next window")
                    time.sleep(remaining_time)

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Pinecone query failed: {str(e)}")
            raise

class WriteToDLQFn(beam.DoFn):
    """Custom DoFn to write DLQ records to GCS"""
    def __init__(self, output_path):
        self.output_path = output_path
        self.logger = logging.getLogger(__name__)

    def process(self, element):
        import json
        import time
        from apache_beam.io.filesystems import FileSystems
        from datetime import datetime
        from google.protobuf.timestamp_pb2 import Timestamp

        class CustomJSONEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, (datetime, Timestamp)):
                    return obj.timestamp()
                if hasattr(obj, 'to_dict'):
                    return obj.to_dict()
                return super().default(obj)

        try:
            # Convert PubSub message to serializable format
            if hasattr(element, 'attributes'):
                # It's a PubSub message
                serializable_element = {
                    'data': element.data.decode('utf-8') if element.data else None,
                    'attributes': dict(element.attributes) if element.attributes else {},
                    'publish_time': element.publish_time.timestamp() if element.publish_time else None
                }
            else:
                # It's a regular dict
                serializable_element = element

            # Create a unique filename using timestamp
            timestamp = int(time.time() * 1000)
            filename = f"{self.output_path}/dlq-{timestamp}.json"
            
            # Write the record to GCS using custom encoder
            with FileSystems.create(filename) as f:
                f.write(json.dumps(serializable_element, cls=CustomJSONEncoder).encode('utf-8'))
            
            yield element
        except Exception as e:
            self.logger.error(f"Failed to write DLQ record: {str(e)}")

class UpdateFirestoreDoFn(beam.DoFn):
    """DoFn for updating Firestore with matches"""
    
    def __init__(self, project_id: str, collection_name: str):
        self.project_id = project_id
        self.collection_name = collection_name
        self.db = None
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def setup(self):
        from google.cloud import firestore
        try:
            self.db = firestore.Client(project=self.project_id)
        except Exception as e:
            self.logger.error(f"Failed to initialize Firestore client: {str(e)}")
            raise

    def process(self, element):
        from google.cloud import firestore
        if not self.db:
            self.setup()
        try:
            user_id = element.get('user_id')
            matches = element.get('matches', [])
            
            self.logger.info(f"Updating Firestore for user {user_id} with {len(matches)} matches")
            
            if not user_id:
                self.logger.warning("No user_id found in element")
                return
                
            doc_ref = self.db.collection(self.collection_name).document(user_id)
            if matches:
                doc_ref.update({
                    "matches": firestore.ArrayUnion(matches)
                })
                self.logger.info(f"Successfully updated matches for user {user_id}")
            yield element
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Firestore update failed: {str(e)}")
            raise

class RerankMatchesDoFn(beam.DoFn):
    """Uses OpenAI to rerank matches based on profile compatibility"""
    def __init__(self, project_id):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)
        import openai
        self.openai = openai

    def setup(self):
        from google.cloud import firestore
        self.logger.info("Setting up OpenAI client and reading instructions")
        api_key = self._access_secret("OPENAI_API_KEY")
        self.client = self.openai.OpenAI(api_key=api_key)
        self.db = firestore.Client(project=self.project_id)
        
        # Read ranking instructions during setup
        self.ai_instructions = self.read_pdf_from_firebase('agent-instructions-1.0.pdf')

    def read_pdf_from_firebase(self, file_path):
        """Read PDF instructions from Firebase Storage"""
        import io
        import PyPDF2
        from google.cloud import storage
        storage_client = storage.Client()
        bucket = storage_client.bucket('marriage-ai-289c6.firebasestorage.app')
        blob = bucket.blob(file_path)
        
        pdf_content = blob.download_as_bytes()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        text = ""
        
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text

    def _access_secret(self, secret_name):
        """Fetch secret from GCP Secret Manager"""
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{self.project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")

    def _format_profile(self, profile):
        """Format profile for OpenAI prompt"""
        formatted_profile = ""
        for question, qa in profile.get("questions_answers", {}).items():
            lying_score = qa.get('lyingScore', 0)
            formatted_profile += f"{qa['question']}: {qa['answer']} (lying_score: {lying_score:.2f})\n"
        return formatted_profile

    def _get_compatibility_score_and_questions(self, source_profile, match_profile):
        """Get compatibility score and suggested questions from OpenAI"""
        prompt = f"""
        Analyze these two profiles for marriage compatibility and suggest follow-up questions:

        Profile 1:
        {self._format_profile(source_profile)}

        Profile 2:
        {self._format_profile(match_profile)}

        Note: Each answer has a lying_score from 0-1 where 1 indicates likely deception.
        Consider these scores when determining compatibility.

        Provide your response in the following JSON format:
        {{
            "score": <number between 0-100>,
            "suggested_questions": [
                {{
                    "question": "<question text>",
                    "rationale": "<why this question is important>",
                    "section": "<relevant section: religious_practice/family_values/education/personality/hobbies>"
                }}
            ]
        }}

        Focus on questions that would:
        1. Clarify potential compatibility concerns
        2. Verify shared values and expectations
        3. Address gaps in current information
        4. Help understand deal-breakers early
        Limit to 3 most important questions.
        """

        try:
            import json
            response = self.client.chat.completions.create(
                model="o1-mini",
                messages=[
                    {"role": "developer", "content": self.ai_instructions},  # Use loaded PDF content
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                response_format={ "type": "json" }
            )
            result = json.loads(response.choices[0].message.content)
            score = float(result['score'])
            questions = result.get('suggested_questions', [])
            return min(max(score, 0), 100), questions  # Ensure score is 0-100
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            self.logger.error(f"Failed to parse AI response: {str(e)}")
            return 0, []

    def process(self, element):
        try:
            user_id = element['user_id']
            matches = element['matches']

            if not matches:
                self.logger.warning("No matches found for reranking")
                return
            
            # Get source profile
            source_profile = self.db.collection('profiles').document(user_id).get().to_dict()
            
            # Get matched profiles and rerank
            reranked_matches = []
            for match in matches:
                profile = self.db.collection('profiles').document(match['id']).get().to_dict()
                score, suggested_questions = self._get_compatibility_score_and_questions(source_profile, profile)
                
                # Format matches to match the TypeScript Matches interface
                reranked_matches.append({
                    'id': match['id'],
                    'vector_score': match['score'],
                    'ai_score': score,
                    'suggested_questions': [
                        {
                            'question': q['question'],
                            'rationale': q['rationale'],
                            'section': q['section']
                        } for q in suggested_questions
                    ],
                    'metadata': match.get('metadata', {})
                })

            # Sort by AI score
            reranked_matches.sort(key=lambda x: x['ai_score'], reverse=True)
            
            self.logger.info(f"Reranked {len(reranked_matches)} matches with suggested questions")
            for match in reranked_matches:
                self.logger.info(f"Match {match['id']}: AI Score {match['ai_score']}")
                if match['suggested_questions']:
                    self.logger.info("Suggested questions:")
                    for q in match['suggested_questions']:
                        self.logger.info(f"- {q['question']} (Section: {q['section']}, Rationale: {q['rationale']})")

            yield {
                'user_id': user_id,
                'matches': reranked_matches
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error reranking matches: {str(e)}")
            raise

class StorePineconeEmbeddingDoFn(beam.DoFn):
    """Stores user embeddings in Pinecone with rate limiting"""
    def __init__(self, project_id, pinecone_region, pinecone_index):
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index = pinecone_index
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def _access_secret(self, secret_name):
        """Fetch secret from GCP Secret Manager"""
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{self.project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")

    def setup(self):
        """Initialize Pinecone client"""
        from pinecone.grpc import PineconeGRPC
        
        # Initialize Pinecone
        pc = PineconeGRPC(
            api_key=self._access_secret("PINECONE_API_KEY"),
            environment=self.pinecone_region
        )
        
        # Convert index name to valid format
        index_name = self.pinecone_index.lower().replace('_', '-')
        self.index = pc.Index(index_name)
        self.logger.info("Connected to Pinecone index")

    def process(self, item):
        try:
            user_id, embedding = item
            
            # Store the embedding
            self.index.upsert(
                vectors=[{
                    'id': user_id,
                    'values': embedding,
                    'metadata': {
                        'userID': user_id
                    }
                }]
            )
            
            self.logger.info(f"Stored embedding for user {user_id} in Pinecone")
            yield item  # Pass through the (user_id, embedding) tuple
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Failed to store embedding: {str(e)}")
            raise

class ScheduleDelayedMatchingDoFn(beam.DoFn):
    """Schedules a delayed matching task after immediate matching is done"""
    def __init__(self, project_id):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def setup(self):
        from google.cloud import tasks_v2
        from google.cloud import firestore
        self.tasks_client = tasks_v2.CloudTasksClient()
        self.db = firestore.Client(project=self.project_id)

    def process(self, element):
        import time
        import base64
        import json
        from datetime import datetime
        try:
            user_id = element['user_id']
            query_time = element.get('query_time')
            
            if not query_time:
                self.logger.warning("No query time found, using current time")
                query_time = time.time() + (2 * 60)
            
            # Schedule task for 5 minutes after the Pinecone query time
            schedule_time = int(query_time + (5 * 60))
            
            queue_path = self.tasks_client.queue_path(
                self.project_id, 
                'us-central1',
                'delayed-matching'
            )
            
            task = {
                'schedule_time': {'seconds': schedule_time},
                'pubsub_target': {
                    'topic_name': f'projects/{self.project_id}/topics/delayed-matching',
                    'data': base64.b64encode(json.dumps({
                        'userId': user_id,
                        'eventType': 'delayed_matching'
                    }).encode()).decode(),
                    'attributes': {'userId': user_id}
                }
            }
            
            response = self.tasks_client.create_task(
                request={'parent': queue_path, 'task': task}
            )
            
            # Store task info for potential cancellation
            self.db.collection('delayed_matching_tasks').document(user_id).set({
                'taskName': response.name,
                'scheduledTime': datetime.fromtimestamp(schedule_time)
            })
            
            self.logger.info(f"Scheduled delayed matching for user {user_id}")
            yield element  # Pass through the element
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Failed to schedule delayed matching: {str(e)}")
            raise

class HandleMatchActionsDoFn(beam.DoFn):
    """Handles post-match actions (notifications or AI voice agent)"""
    def __init__(self, project_id):
        self.project_id = project_id
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

    def setup(self):
        from google.cloud import firestore
        from google.cloud import tasks_v2
        self.db = firestore.Client(project=self.project_id)
        self.tasks_client = tasks_v2.CloudTasksClient()

    def process(self, element):
        try:
            user_id = element['user_id']
            matches = element['matches']
            
            # Get user settings - align with UserSettings interface
            user_settings = self.db.collection(COLLECTIONS['USER_SETTINGS']).document(user_id).get().to_dict()
            if not user_settings:
                self.logger.warning(f"No settings found for user {user_id}")
                return
            
            # Extract using same structure as TypeScript interface
            notification_prefs = user_settings.get('notification', {}).get('preferences', {})
            
            for match in matches:
                if match.get('suggested_questions'):
                    # Use the same availability check logic as in TypeScript
                    is_available = self._check_notification_availability(notification_prefs)
                    
                    if is_available and notification_prefs.get('enabled', True):
                        # Schedule notification
                        self._schedule_notification(user_id, match)
                    else:
                        # Schedule AI voice agent call
                        self._schedule_voice_agent(user_id, match)
            
            yield element  # Pass through the element

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error handling match actions: {str(e)}")
            raise

    def _check_notification_availability(self, prefs):
        """Match the TypeScript checkNotificationAvailability function logic"""
        if not prefs:
            return True  # Default to available
        
        now = datetime.now()
        current_hour = now.hour
        current_day = now.strftime('%A').lower()  # Get day name in lowercase
        
        # Check quiet hours
        quiet_hours = prefs.get('quietHours', {})
        if quiet_hours:
            start = quiet_hours.get('start', 22)
            end = quiet_hours.get('end', 6)
            
            # Handle overnight quiet hours
            if start <= end:
                if current_hour >= start and current_hour < end:
                    return False
            else:
                if current_hour >= start or current_hour < end:
                    return False
        
        # Check available days
        available_days = prefs.get('availableDays', {})
        if available_days and available_days.get(current_day) is False:
            return False
        
        # Check available hours for specific days
        available_hours = prefs.get('availableHours', {})
        if current_day in available_hours:
            day_hours = available_hours[current_day]
            start = day_hours.get('start', 9)
            end = day_hours.get('end', 17)
            
            # Handle overnight availability
            if start <= end:
                return current_hour >= start and current_hour < end
            else:
                return current_hour >= start or current_hour < end
        
        return True

    def _schedule_notification(self, user_id, match):
        """Schedule a notification with suggested questions"""
        import json
        task = {
            'http_request': {
                'http_method': 'POST',
                'url': f'https://{self.project_id}.cloudfunctions.net/sendMatchNotification',
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'userId': user_id,
                    'matchId': match['id'],
                    'score': match['ai_score'],
                    'questions': match['suggested_questions']
                }).encode()
            }
        }
        
        queue_path = self.tasks_client.queue_path(
            self.project_id, 
            'us-central1',
            'match-notifications'
        )
        
        self.tasks_client.create_task(request={'parent': queue_path, 'task': task})
        self.logger.info(f"Scheduled notification for user {user_id}")

    def _schedule_voice_agent(self, user_id, match):
        """Schedule an AI voice agent call"""
        import json
        task = {
            'http_request': {
                'http_method': 'POST',
                'url': f'https://{self.project_id}.cloudfunctions.net/initiateVoiceAgent',
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'userId': user_id,
                    'matchId': match['id'],
                    'questions': match['suggested_questions'],
                    'score': match['ai_score']
                }).encode()
            }
        }
        
        queue_path = self.tasks_client.queue_path(
            self.project_id, 
            'us-central1',
            'voice-agent-calls'
        )
        
        self.tasks_client.create_task(request={'parent': queue_path, 'task': task})
        self.logger.info(f"Scheduled voice agent call for user {user_id}")

class CalculateLyingScoreDoFn(beam.DoFn):
    def setup(self):
        # Initialize OpenAI client
        from google.cloud import firestore
        from openai import OpenAI
        self.openai = OpenAI()
        self.db = firestore.Client()

    def process(self, element):
        """Calculate lying score for modified QAs"""
        profile_id = element['profile_id']
        qa_id = element['qa_id']
        qa_data = element['qa_data']
        
        # Get edit history from Firestore
        profile_ref = self.db.collection('PROFILES').document(profile_id)
        events_ref = profile_ref.collection('events')
        
        # Query events related to this QA
        qa_events = events_ref.where('changedFields', 'array_contains', 
            f'questions_answers.{qa_id}').order_by('timestamp').stream()
        
        edit_history = []
        for event in qa_events:
            event_data = event.to_dict()
            edit_history.append({
                'timestamp': event_data['timestamp'],
                'previousAnswer': event_data['previousValues'].get(f'questions_answers.{qa_id}.answer', ''),
                'newAnswer': event_data['newValues'].get(f'questions_answers.{qa_id}.answer', ''),
            })

        # Format edit history for prompt
        history_text = '\n'.join([
            f"[{edit['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}] "
            f"Changed from: '{edit['previousAnswer']}' to: '{edit['newAnswer']}'"
            for edit in edit_history
        ])

        # Generate prompt for OpenAI
        prompt = f"""
        Question: {qa_data['question']}
        Current Answer: {qa_data['answer']}
        Edit History:
        {history_text}
        
        Based on the edit history and changes in the answer, calculate a lying score between 0 and 1,
        where 1 indicates likely deception. Consider:
        - Frequency of changes
        - Magnitude of changes
        - Consistency between versions
        - Time between edits
        
        Return only the numeric score.
        """

        # Get lying score from OpenAI
        response = self.openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        
        lying_score = float(response.choices[0].message.content.strip())

        yield {
            'profile_id': profile_id,
            'qa_id': qa_id,
            'lying_score': lying_score
        }

class UpdateLyingScoreDoFn(beam.DoFn):
    def setup(self):
        from google.cloud import firestore
        self.db = firestore.Client()

    def process(self, element):
        # Update to match the structure in the QuestionsAnswers interface
        profile_ref = self.db.collection('PROFILES').document(element['profile_id'])
        profile_ref.update({
            f'questions_answers.{element["qa_id"]}.aiLyingScore': element['lying_score']
        })

def run_streaming_pipeline(argv=None):
    """Run the streaming pipeline."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--runner', required=True, help='Beam Runner (DirectRunner or DataflowRunner)')
    parser.add_argument('--top_k', type=int, required=True)
    parser.add_argument('--pinecone_index', required=True, help='Pinecone index name')
    parser.add_argument('--job_name', required=True, help='Dataflow job name')
    parser.add_argument('--region', required=True, help='GCP region')
    parser.add_argument('--service_account_email', required=True, help='Service account email')
    parser.add_argument('--dlq_bucket', required=True, help='GCS path for DLQ')
    parser.add_argument('--matches_collection', required=True, help='Firestore collection for matches')
    parser.add_argument('--project', required=True, help='GCP project ID')
    parser.add_argument('--temp_location', required=True, help='GCS path for temporary files')
    parser.add_argument('--staging_location', required=True, help='GCS path for staging files')
    parser.add_argument('--pinecone_region', required=True, help='Pinecone region')
    parser.add_argument('--profiles_collection', required=True, help='Firestore collection for profiles')
    parser.add_argument('--requirements_file', required=True, help='Path to requirements file')
    parser.add_argument('--template_location', required=True, help='Template location in GCS')
    parser.add_argument('--test_mode', action='store_true', help='Run in test mode with bounded input')
    parser.add_argument('--user_profile_updated_pubsub_topic', required=True, help='PubSub topic for immediate events')
    parser.add_argument('--delayed_matching_pubsub_topic', required=True, help='PubSub topic for delayed matching events')
    
    known_args, pipeline_args = parser.parse_known_args(argv)
    options = get_pipeline_options(known_args)

    with beam.Pipeline(options=options) as pipeline:
        logger.info("Starting pipeline...")
        pipeline.options.view_as(StandardOptions).streaming = True

        # Add windowing configuration
        window_config = beam.WindowInto(
            window.GlobalWindows(),
            trigger=trigger.Repeatedly(trigger.AfterCount(1)),
            accumulation_mode=trigger.AccumulationMode.DISCARDING
        )

        # Read from immediate topic (with storage)
        immediate_profiles = (
            pipeline
            | "ReadFromImmediatePubSub" >> beam.io.ReadFromPubSub(
                topic=known_args.user_profile_updated_pubsub_topic,
                with_attributes=True,
                id_label="event_id"
            )
            | "ExtractImmediateUserID" >> beam.ParDo(ExtractUserIDDoFn())
            | "HandleImmediateExtractErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
            | "FetchImmediateProfiles" >> beam.ParDo(FetchProfileDoFn(
                project_id=known_args.project,
                collection_name=known_args.profiles_collection
            ))
            | "ValidateImmediateProfiles" >> beam.ParDo(ValidateProfileDoFn())
            | "GenerateImmediateEmbeddings" >> beam.ParDo(GenerateUserEmbedding(known_args.project))
            | "StoreInPinecone" >> beam.ParDo(StorePineconeEmbeddingDoFn(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index
            ))
        )

        # Read from delayed matching topic (skip storage)
        delayed_matching_profiles = (
            pipeline        
            | "ReadFromDelayedMatchingPubSub" >> beam.io.ReadFromPubSub(
                topic=known_args.delayed_matching_pubsub_topic,
                with_attributes=True,
                id_label="event_id"
            )
            | "ExtractDelayedMatchingUserID" >> beam.ParDo(ExtractUserIDDoFn())
            | "HandleDelayedMatchingExtractErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
            | "FetchDelayedMatchingProfiles" >> beam.ParDo(FetchProfileDoFn(
                project_id=known_args.project,
                collection_name=known_args.profiles_collection
            ))
            | "ValidateDelayedMatchingProfiles" >> beam.ParDo(ValidateProfileDoFn())
            | "GenerateDelayedMatchingEmbeddings" >> beam.ParDo(GenerateUserEmbedding(known_args.project))
        )

        # Merge embeddings from both paths
        all_embeddings = (
            (immediate_profiles, delayed_matching_profiles) 
            | "MergeEmbeddings" >> beam.Flatten()
        )

        # Common steps for both streams
        # Query Pinecone for ANN matches
        matches = (
            all_embeddings
            | "QueryPinecone" >> beam.ParDo(QueryPinecone(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index,
                top_k=known_args.top_k
            ))
            | "HandlePineconeErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
            | "ScheduleDelayedMatching" >> beam.ParDo(ScheduleDelayedMatchingDoFn(known_args.project))
            | "HandleScheduleErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

        # Calculate lying scores first
        lying_scores = (
            matches
            | "ExtractQAUpdates" >> beam.Map(lambda x: {
                'profile_id': x['user_id'],
                'qa_id': x['matches'][0]['id'],
                'qa_data': x['matches'][0]['metadata']
            })
            | "CalculateLyingScores" >> beam.ParDo(CalculateLyingScoreDoFn())
            | "WindowByMinute" >> beam.WindowInto(window.FixedWindows(60))  # Batch updates
            | "UpdateLyingScores" >> beam.ParDo(UpdateLyingScoreDoFn())
        )

        # Rerank matches using AI (now with lying scores available)
        reranked_matches = (
            matches
            | "RerankMatches" >> beam.ParDo(RerankMatchesDoFn(known_args.project))
            | "HandleRerankErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

        # Update Firestore with reranked matches
        _ = (
            reranked_matches
            | "UpdateFirestore" >> beam.ParDo(UpdateFirestoreDoFn(
                known_args.project,
                known_args.matches_collection
            ))
            | "HandleFirestoreErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

if __name__ == "__main__":
    run_streaming_pipeline()