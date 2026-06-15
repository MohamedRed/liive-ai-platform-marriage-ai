from google.cloud import pubsub_v1
from google.cloud import firestore
import random
import time
import json
from datetime import datetime
import uuid

# Initialize clients
publisher = pubsub_v1.PublisherClient()
db = firestore.Client()

# Configure topic path
project_id = "your-project-id"
topic_path = publisher.topic_path(project_id, "user-profile-update-topic")

def get_random_profile():
    """Get a random profile ID from existing test profiles"""
    profiles_ref = db.collection("PROFILES")
    profiles = profiles_ref.limit(100).stream()
    profile_ids = [profile.id for profile in profiles]
    return random.choice(profile_ids)

def simulate_profile_update():
    """Simulate a profile update and publish to Pub/Sub"""
    user_id = get_random_profile()
    
    # Create message with required attributes
    message = {
        "userId": user_id,
        "timestamp": datetime.utcnow().isoformat(),
        "sequenceNumber": random.randint(1, 1000)
    }

    # Convert message to bytes
    message_data = json.dumps(message).encode("utf-8")

    # Add attributes required by the streaming pipeline
    attributes = {
        "user_id": user_id,
        "event_id": str(uuid.uuid4())
    }

    try:
        # Publish message
        future = publisher.publish(
            topic_path, 
            message_data,
            **attributes
        )
        message_id = future.result()
        print(f"Published message {message_id} for user {user_id}")
        return True
    except Exception as e:
        print(f"Error publishing message: {e}")
        return False

def main():
    """Main function to simulate continuous updates"""
    update_interval = 2  # seconds between updates
    total_updates = 50   # number of updates to simulate
    
    print(f"Starting simulation of {total_updates} profile updates...")
    successful_updates = 0
    
    for i in range(total_updates):
        if simulate_profile_update():
            successful_updates += 1
        time.sleep(update_interval)
        
        # Progress update
        if (i + 1) % 10 == 0:
            print(f"Processed {i + 1}/{total_updates} updates...")
    
    print(f"Simulation complete. Successfully published {successful_updates} updates.")

if __name__ == "__main__":
    main() 