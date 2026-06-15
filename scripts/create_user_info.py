import firebase_admin
from firebase_admin import credentials, firestore
import base64
import os
import json

# Initialize Firebase Admin
def initialize_firebase():
    # Get the absolute path to the service account key file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(current_dir, 'service-account-key.json')
    
    if not os.path.exists(key_path):
        raise ValueError(f"Firebase service account key file not found at {key_path}")
        
    cred = credentials.Certificate(key_path)
    app = firebase_admin.initialize_app(cred, {'storageBucket': 'marriage-ai-289c6.firebasestorage.app'})
    return firestore.client()

def create_user_info(user_id: str):
    """Creates a user info document in Firestore."""
    db = initialize_firebase()
    
    # Collection names
    COLLECTIONS = {
        'USER_INFO': 'USER_INFO',
    }
    
    try:
        # Create user info document
        user_info_ref = db.collection(COLLECTIONS['USER_INFO']).document(user_id)
        
        # Check if document already exists
        if user_info_ref.get().exists:
            print(f"User info document already exists for user {user_id}")
            return
        
        # Create new user info document
        user_info_ref.set({
            'id': user_id,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'userMetadata': {
                'acceptedTerms': False,
                'marketingOptIn': False,
                'isDeleted': False,
                'isHidden': False,
                'isArchived': False,
                'isTest': False
            },
            'contact': {
                'email': '',
                'phoneNumber': ''
            },
            'name': {
                'firstName': '',
                'lastName': ''
            }
        })
        
        print(f"Successfully created user info document for user {user_id}")
        
    except Exception as e:
        print(f"Error creating user info document: {str(e)}")

if __name__ == "__main__":
    # Get user ID from command line argument
    import sys
    if len(sys.argv) != 2:
        print("Usage: python create_user_info.py <user_id>")
        sys.exit(1)
    
    user_id = sys.argv[1]
    create_user_info(user_id) 