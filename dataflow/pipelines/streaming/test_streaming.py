from streaming import run_streaming_pipeline
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from google.cloud import pubsub_v1
import json

def publish_test_message(project_id, topic_id):
    """Publish a test message to PubSub"""
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, topic_id)
    
    test_message = {
        'profile_id': 'test_user_1',
        'event_type': 'profile_updated'
    }
    
    # Convert message to bytes
    message_data = json.dumps(test_message).encode('utf-8')
    
    # Add user_id as an attribute
    attributes = {
        'user_id': 'test_user_1'
    }
    
    try:
        future = publisher.publish(topic_path, message_data, **attributes)
        message_id = future.result()
        print(f"Published message ID: {message_id}")
        return True
    except Exception as e:
        print(f"Error publishing message: {str(e)}")
        return False

if __name__ == "__main__":
    # Set up test arguments
    project_id = "marriage-ai-289c6"
    topic_id = "user-profile-update-topic"
    
    test_args = [
        "--runner=DirectRunner",
        "--project=" + project_id,
        "--top_k=10",
        "--pinecone_index=profiles",
        "--job_name=test-streaming-job",
        "--region=us-central1",
        "--service_account_email=206700838957-compute@developer.gserviceaccount.com",
        "--dlq_bucket=gs://marriage-ai-289c6.firebasestorage.app/dataflow/streaming/dlq",
        "--matches_collection=MATCHES",
        "--temp_location=gs://marriage-ai-289c6.firebasestorage.app/dataflow/streaming/temp",
        "--staging_location=gs://marriage-ai-289c6.firebasestorage.app/dataflow/streaming/staging",
        "--pinecone_region=us-central1",
        "--profiles_collection=PROFILES",
        "--requirements_file=requirements.txt",
        "--template_location=template_spec.json",
        "--pubsub_topic=projects/marriage-ai-289c6/topics/user-profile-update-topic",
        "--test_mode"
    ]

    # Run pipeline and wait for keyboard interrupt
    try:
        print("Starting pipeline... Press Ctrl+C to exit")
        
        # Start the pipeline
        with ThreadPoolExecutor() as executor:
            pipeline_future = executor.submit(run_streaming_pipeline, test_args)
            
            # Wait a bit for pipeline to initialize
            time.sleep(5)
            
            # Publish test message
            print("Publishing test message...")
            if publish_test_message(project_id, topic_id):
                print("Test message published successfully")
            
            # Wait for pipeline to complete or Ctrl+C
            pipeline_future.result()
            
    except KeyboardInterrupt:
        print("\nShutting down pipeline...")
        sys.exit(0) 