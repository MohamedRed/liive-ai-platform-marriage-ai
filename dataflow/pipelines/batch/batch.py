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
queries Pinecone for matches, and writes results to Firestore.
"""

from __future__ import annotations
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions
import logging
import argparse
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
        pubsub_topic=known_args.pubsub_topic,
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
        import traceback
        try:
            self.logger.info(f"Generating embedding for profile: {profile['id']}")
            qa_list = profile.get("questions_answers", [])
            
            if not qa_list:
                self.logger.error("No questions_answers found")
                return
            
            profile_text = "\n".join(
                f"Q: {qa['question']}\nA: {qa['answer']}"
                for qa in qa_list
            )
            
            response = self.client.embeddings.create(
                model="text-embedding-3-large",
                input=profile_text,
                encoding_format="float"
            )
            
            embedding = response.data[0].embedding
            self.logger.info(f"Generated embedding of length: {len(embedding)}")
            yield (profile["id"], embedding)
            
        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error generating embedding: {str(e)}\nTraceback: {traceback.format_exc()}")
            raise

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
                    
                    yield {
                        'user_id': user_id,
                        'matches': matches
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
        self.logger.info("Setting up OpenAI client")
        api_key = self._access_secret("OPENAI_API_KEY")
        self.client = self.openai.OpenAI(api_key=api_key)
        self.db = firestore.Client(project=self.project_id)

    def process(self, element):
        try:
            user_id = element['user_id']
            matches = element['matches']

            if not matches:
                self.logger.warning("No matches found for reranking")
                return
            
            # Get source profile
            source_profile = self.db.collection('profiles').document(user_id).get().to_dict()
            
            # Get matched profiles
            matched_profiles = []
            for match in matches:
                profile = self.db.collection('profiles').document(match['id']).get().to_dict()
                matched_profiles.append((match, profile))

            # Create prompt for each match
            reranked_matches = []
            for match, profile in matched_profiles:
                score = self._get_compatibility_score(source_profile, profile)
                reranked_matches.append({
                    'id': match['id'],
                    'vector_score': match['score'],
                    'ai_score': score,
                    'metadata': match.get('metadata')
                })

            # Sort by AI score
            reranked_matches.sort(key=lambda x: x['ai_score'], reverse=True)
            
            self.logger.info(f"Reranked {len(reranked_matches)} matches")

            yield {
                'user_id': user_id,
                'matches': reranked_matches
            }

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error reranking matches: {str(e)}")
            raise

    def _get_compatibility_score(self, source_profile, match_profile):
        """Get compatibility score from OpenAI"""
        prompt = f"""
        Rate the compatibility of these two profiles from 0-100 based on their answers:

        Profile 1:
        {self._format_profile(source_profile)}

        Profile 2:
        {self._format_profile(match_profile)}

        Return only the numeric score.
        """

        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        
        try:
            score = float(response.choices[0].message.content.strip())
            return min(max(score, 0), 100)  # Ensure score is 0-100
        except ValueError:
            self.logger.error(f"Failed to parse score: {response.choices[0].message.content}")
            return 0

class StorePineconeEmbeddingDoFn(beam.DoFn):
    """Stores user embeddings in Pinecone with rate limiting"""
    def __init__(self, project_id, pinecone_region, pinecone_index):
        self.project_id = project_id
        self.pinecone_region = pinecone_region
        self.pinecone_index = pinecone_index
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('main', MetricNames.ERRORS)

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

def run_batch_pipeline(argv=None):
    """Run the batch pipeline for a specific country."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--runner', required=True)
    parser.add_argument('--project', required=True)
    parser.add_argument('--country', required=True, help='Country code to process')
    parser.add_argument('--pinecone_region', required=True)
    parser.add_argument('--pinecone_index', required=True)
    parser.add_argument('--profiles_collection', required=True)
    parser.add_argument('--matches_collection', required=True)  # Add this back
    parser.add_argument('--top_k', type=int, required=True)    # Add this back
    parser.add_argument('--dlq_bucket', required=True)
    parser.add_argument('--temp_location', required=True)
    parser.add_argument('--staging_location', required=True)
    parser.add_argument('--job_name', required=True, help='Dataflow job name')
    parser.add_argument('--region', required=True, help='GCP region')
    parser.add_argument('--service_account_email', required=True, help='Service account email')
    parser.add_argument('--requirements_file', required=True, help='Path to requirements file')
    parser.add_argument('--template_location', required=True, help='Template location in GCS')
    parser.add_argument('--test_mode', action='store_true', help='Run in test mode with bounded input')

    known_args, pipeline_args = parser.parse_known_args(argv)
    options = get_pipeline_options(known_args)

    # Build Firestore query for country
    query = {
        'structuredQuery': {
            'where': {
                'fieldFilter': {
                    'field': {'fieldPath': 'country'},
                    'op': 'EQUAL',
                    'value': {'stringValue': known_args.country}
                }
            },
            'from': [{'collectionId': known_args.profiles_collection}]
        }
    }

    with beam.Pipeline(options=options) as p:
        # Read all profiles for country
        profiles = (
            p 
            | "ReadFromFirestore" >> beam.io.ReadFromFirestore(
                project_id=known_args.project,
                collection=known_args.profiles_collection,
                query=query
            )
            | "HandleReadErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

        # Process profiles
        validated_profiles = (
            profiles
            | "ValidateProfiles" >> beam.ParDo(ValidateProfileDoFn())
            | "HandleValidationErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

        # Generate embeddings and store in Pinecone
        embeddings = (
            validated_profiles
            | "GenerateEmbeddings" >> beam.ParDo(GenerateUserEmbedding(known_args.project))
            | "HandleEmbeddingErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
            | "StorePineconeEmbedding" >> beam.ParDo(StorePineconeEmbeddingDoFn(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index
            ))
            | "HandleStoreErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

        # Query Pinecone for ANN matches
        matches = (
            embeddings
            | "QueryPinecone" >> beam.ParDo(QueryPinecone(
                project_id=known_args.project,
                pinecone_region=known_args.pinecone_region,
                pinecone_index=known_args.pinecone_index,
                top_k=known_args.top_k
            ))
            | "HandlePineconeErrors" >> beam.ParDo(WriteToDLQFn(known_args.dlq_bucket))
        )

        # Rerank matches using AI
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
        )

if __name__ == "__main__":
    run_batch_pipeline()