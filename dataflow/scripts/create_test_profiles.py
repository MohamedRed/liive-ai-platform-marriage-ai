from google.cloud import firestore
import random
from datetime import datetime, timedelta

# Initialize Firestore client
db = firestore.Client()

# Sample data for generating profiles
FIRST_NAMES_MALE = ["Ahmed", "Youssef", "Karim", "Hassan", "Mohamed"]
FIRST_NAMES_FEMALE = ["Aisha", "Laila", "Fatima", "Zahra", "Salma"]
LAST_NAMES = ["El-Amin", "Benbrahim", "Garcia", "Fernandez", "Lopez"]
CITIES = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza"]
COUNTRIES = ["ES", "FR", "UK", "DE", "IT"]

# Sample questions and answers
QUESTIONS = [
    "How do you practice Islam daily?",
    "What are your views on work-life balance?",
    "How important is family to you?",
    "What are your hobbies?",
    "What are your career goals?"
]

ANSWERS = [
    "I pray five times a day and read Quran regularly.",
    "I believe in maintaining a healthy balance between work and personal life.",
    "Family is the cornerstone of my life.",
    "I enjoy reading, hiking, and spending time with family.",
    "I aim to grow in my career while maintaining Islamic values."
]

def generate_profile(index: int):
    is_male = random.choice([True, False])
    first_name = random.choice(FIRST_NAMES_MALE if is_male else FIRST_NAMES_FEMALE)
    
    # Generate questions and answers with timestamps
    base_timestamp = datetime.now() - timedelta(days=random.randint(1, 30))
    questions_answers = []
    for i, (question, answer) in enumerate(zip(QUESTIONS, ANSWERS)):
        timestamp = base_timestamp + timedelta(hours=i)
        questions_answers.append({
            "question": question,
            "answer": f"{answer} ({random.randint(1, 100)})",
            "createdAt": timestamp
        })

    return {
        "id": f"test_profile_{index}",
        "firstName": first_name,
        "lastName": random.choice(LAST_NAMES),
        "gender": "male" if is_male else "female",
        "email": f"test{index}@example.com",
        "country": random.choice(COUNTRIES),
        "address": {
            "city": random.choice(CITIES)
        },
        "isVerified": True,
        "isWaliVerified": True,
        "questions_answers": questions_answers,
        "createdAt": datetime.now(),
        "updatedAt": datetime.now()
    }

def main():
    batch_size = 20  # Firestore batches are limited to 500 operations
    profiles_ref = db.collection("PROFILES")
    
    print("Starting profile creation...")
    
    for batch_num in range(0, 100, batch_size):
        batch = db.batch()
        
        for i in range(batch_num, min(batch_num + batch_size, 100)):
            profile = generate_profile(i)
            doc_ref = profiles_ref.document(profile["id"])
            batch.set(doc_ref, profile)
        
        batch.commit()
        print(f"Committed batch {batch_num//batch_size + 1}")
    
    print("Successfully created 100 test profiles")

if __name__ == "__main__":
    main() 