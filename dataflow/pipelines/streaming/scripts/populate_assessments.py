import argparse
import sys
from google.cloud import firestore

# --- Configuration --- #

# Define the collection names (should match common/definitions.py)
ASSESSMENT_COLLECTIONS = {
    'attachment': 'ASSESSMENT_QUESTIONS_ATTACHMENT',
    'big_five': 'ASSESSMENT_QUESTIONS_BIGFIVE',
    'core_values': 'ASSESSMENT_QUESTIONS_COREVALUES',
    'love_languages': 'ASSESSMENT_QUESTIONS_LOVELANGUAGES',
}

# --- Placeholder Assessment Questions --- #
# !!! IMPORTANT: These are example questions found via web search.
# For a real application, use carefully curated or licensed validated questions. !!!

QUESTIONS_DATA = {
    'attachment': [
        {'id': 'ATTCH_01', 'text': 'When my partner is away, I often worry about our relationship.', 'priority': 1, 'style': 'anxious_focus'},
        {'id': 'ATTCH_02', 'text': 'I find it relatively easy to get close to others and am comfortable depending on them and having them depend on me.', 'priority': 2, 'style': 'secure_focus'},
        {'id': 'ATTCH_03', 'text': 'I am somewhat uncomfortable being close to others; I find it difficult to trust them completely, difficult to allow myself to depend on them.', 'priority': 3, 'style': 'avoidant_focus'},
        {'id': 'ATTCH_04', 'text': 'I prefer not to depend on others or have others depend on me.', 'priority': 4, 'style': 'avoidant_focus'},
        {'id': 'ATTCH_05', 'text': "I find that others are reluctant to get as close as I would like. I often worry that my partner doesn't really love me or won't want to stay with me.", 'priority': 5, 'style': 'anxious_focus'},
        {'id': 'ATTCH_06', 'text': 'It helps me to turn to my romantic partner in times of need.', 'priority': 6, 'style': 'secure_focus'},
    ],
    'big_five': [
        # Openness
        {'id': 'BIG5_O1', 'text': 'I have a rich vocabulary.', 'priority': 1, 'trait': 'openness'},
        {'id': 'BIG5_O2', 'text': 'I have difficulty understanding abstract ideas. (Reversed)', 'priority': 2, 'trait': 'openness'},
        {'id': 'BIG5_O3', 'text': 'I am interested in abstract ideas.', 'priority': 3, 'trait': 'openness'},
        # Conscientiousness
        {'id': 'BIG5_C1', 'text': 'I pay attention to details.', 'priority': 4, 'trait': 'conscientiousness'},
        {'id': 'BIG5_C2', 'text': 'I often forget to put things back in their proper place. (Reversed)', 'priority': 5, 'trait': 'conscientiousness'},
        {'id': 'BIG5_C3', 'text': 'I like order.', 'priority': 6, 'trait': 'conscientiousness'},
        # Extraversion
        {'id': 'BIG5_E1', 'text': 'I feel comfortable around people.', 'priority': 7, 'trait': 'extraversion'},
        {'id': 'BIG5_E2', 'text': 'I keep in the background. (Reversed)', 'priority': 8, 'trait': 'extraversion'},
        {'id': 'BIG5_E3', 'text': 'I start conversations.', 'priority': 9, 'trait': 'extraversion'},
        # Agreeableness
        {'id': 'BIG5_A1', 'text': 'I sympathize with others\' feelings.', 'priority': 10, 'trait': 'agreeableness'},
        {'id': 'BIG5_A2', 'text': 'I am not really interested in others. (Reversed)', 'priority': 11, 'trait': 'agreeableness'},
        {'id': 'BIG5_A3', 'text': 'I feel others\' emotions.', 'priority': 12, 'trait': 'agreeableness'},
        # Neuroticism (Emotional Stability - Reversed)
        {'id': 'BIG5_N1', 'text': 'I get stressed out easily.', 'priority': 13, 'trait': 'neuroticism'},
        {'id': 'BIG5_N2', 'text': 'I am relaxed most of the time. (Reversed)', 'priority': 14, 'trait': 'neuroticism'},
        {'id': 'BIG5_N3', 'text': 'I worry about things.', 'priority': 15, 'trait': 'neuroticism'},
    ],
    'core_values': [
        {'id': 'VAL_01', 'text': 'How important is financial security to you in a marriage?', 'priority': 1},
        {'id': 'VAL_02', 'text': 'To what extent do you value adventure and spontaneity in a relationship?', 'priority': 2},
        {'id': 'VAL_03', 'text': 'How significant is family involvement (from both sides) in your ideal marriage?', 'priority': 3},
        {'id': 'VAL_04', 'text': 'Describe the role you believe personal growth (individual and as a couple) should play in a marriage.', 'priority': 4},
        {'id': 'VAL_05', 'text': 'How important is it that you and your partner share similar spiritual or religious beliefs?', 'priority': 5},
        {'id': 'VAL_06', 'text': 'What does honesty and open communication look like to you in a partnership?', 'priority': 6},
        {'id': 'VAL_07', 'text': 'How do you prioritize health and well-being (physical, mental) within a relationship?', 'priority': 7},
    ],
    'love_languages': [
        {'id': 'LOVE_01', 'text': "It's more meaningful to me when someone I love sends me a loving note/text/email for no special reason.", 'priority': 1, 'language': 'words_of_affirmation'},
        {'id': 'LOVE_02', 'text': "It's more meaningful to me when I receive a hug from someone I love.", 'priority': 2, 'language': 'physical_touch'},
        {'id': 'LOVE_03', 'text': "It's more meaningful to me when I can spend uninterrupted leisure time with someone I love.", 'priority': 3, 'language': 'quality_time'},
        {'id': 'LOVE_04', 'text': "It's more meaningful to me when someone I love does something practical to help me out.", 'priority': 4, 'language': 'acts_of_service'},
        {'id': 'LOVE_05', 'text': "It's more meaningful to me when someone I love gives me a little gift as a token of our relationship.", 'priority': 5, 'language': 'receiving_gifts'},
        {'id': 'LOVE_06', 'text': "It's more meaningful to me when I hear the words 'I appreciate you' from someone I love.", 'priority': 6, 'language': 'words_of_affirmation'},
        {'id': 'LOVE_07', 'text': "It's more meaningful to me when someone I love and I embrace.", 'priority': 7, 'language': 'physical_touch'},
        {'id': 'LOVE_08', 'text': "It's more meaningful to me when I get to spend time alone with someone I love, just us.", 'priority': 8, 'language': 'quality_time'},
        {'id': 'LOVE_09', 'text': "It's more meaningful to me when someone I love helps me with a task.", 'priority': 9, 'language': 'acts_of_service'},
        {'id': 'LOVE_10', 'text': "It's more meaningful to me when I receive a gift from someone I love.", 'priority': 10, 'language': 'receiving_gifts'},
    ]
}

# --- Script Logic --- #

def populate_assessments(project_id: str):
    """Connects to Firestore and populates assessment questions."""
    print(f"Connecting to Firestore project: {project_id}")
    try:
        db = firestore.Client(project=project_id)
    except Exception as e:
        print(f"Error: Could not connect to Firestore. Check credentials/project ID.", file=sys.stderr)
        print(f"Details: {e}", file=sys.stderr)
        sys.exit(1)

    print("Populating assessment questions...")

    for framework, questions in QUESTIONS_DATA.items():
        collection_name = ASSESSMENT_COLLECTIONS.get(framework)
        if not collection_name:
            print(f"Warning: Collection name not defined for framework '{framework}'. Skipping.", file=sys.stderr)
            continue

        print(f"  Processing framework: '{framework}' -> Collection: '{collection_name}'")
        collection_ref = db.collection(collection_name)

        # Check if collection seems populated (simple check on first question ID)
        first_q_id = questions[0].get('id') if questions else None
        if first_q_id:
             doc_ref = collection_ref.document(first_q_id)
             if doc_ref.get().exists:
                  user_input = input(f"    Collection '{collection_name}' appears to exist (found doc {first_q_id}). Overwrite? (y/N): ")
                  if user_input.lower() != 'y':
                       print(f"    Skipping '{collection_name}'.")
                       continue

        count = 0
        errors = 0
        batch = db.batch()
        for q_data in questions:
            q_id = q_data.get('id')
            if not q_id:
                print(f"Error: Question data missing 'id': {q_data}", file=sys.stderr)
                errors += 1
                continue

            # Prepare data for Firestore document
            doc_data = {
                'text': q_data.get('text', 'MISSING TEXT'),
                'framework': framework,
                'layer': 4, # Constant
                'priority': q_data.get('priority', 999),
                'trait': q_data.get('trait'),
                'style': q_data.get('style'),
                # Add other optional fields if needed
            }
            # Remove None values for cleaner Firestore docs
            doc_data = {k: v for k, v in doc_data.items() if v is not None}

            doc_ref = collection_ref.document(q_id)
            batch.set(doc_ref, doc_data)
            count += 1

            # Commit batch periodically to avoid exceeding limits
            if count % 400 == 0:
                 print(f"    Committing batch of {count % 400} documents...")
                 try:
                     batch.commit()
                     batch = db.batch() # Start a new batch
                 except Exception as e:
                     print(f"Error committing batch to '{collection_name}': {e}", file=sys.stderr)
                     errors += 1 # Or handle more granularly

        # Commit any remaining items in the last batch
        if count % 400 != 0:
            print(f"    Committing final batch of {count % 400} documents...")
            try:
                batch.commit()
            except Exception as e:
                print(f"Error committing final batch to '{collection_name}': {e}", file=sys.stderr)
                errors += 1

        print(f"    Finished '{framework}'. Added/updated {count} questions. Errors: {errors}")

    print("\nPopulation script finished.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Populate Firestore assessment questions.')
    parser.add_argument('--project', required=True, help='Your Google Cloud Project ID.')
    args = parser.parse_args()

    populate_assessments(args.project) 