#!/usr/bin/env python
import os
import re
from google.cloud import firestore
from google.auth.exceptions import DefaultCredentialsError

# This is the text block you provided.
# For a real run, you might load this from a file or paste it directly.
QUESTIONS_TEXT_BLOCK = """
2. How physically are you ?
    1. What is your height?
    2. What is your birthdate?
    3. What is your eye colour?
    4. What is your hair color?
    5. What is your skin colour?
    6. What is your weight?
    7. What is your breast size?
    8. What is your bottom size?
    9. How would you describe your muscle definition?
3. Islamic outward features
    1. Do you wear hijab ?
        1. Do you wear tight cloths ?
            1. If you wear tight clothes, do you wear a tight top?
            2. If you wear tight clothes, do you wear pants?
                1. If you wear pants as part of tight clothing, are they tight pants?
    2. Do you wear jilbab?
    3. Do you wear niqab ?
    4. Do you wear complete face veil ?
    5. Do you wear qamis ?
    6. Do you have beard ?
    7. Do you wear muslim hat?
4. Personality inward features
    1. How would you describe your personality in general ?
        1. When you are angry ?
        2. When you're sad ?
        3. When you are scared ?
        4. When you are stressed ?
        5. When you are happy ?
        6. When you long for something ?
            1. When you ultimately don't get it ?
            2. When you ultimately get it ?
        7. When something bad unexpected happens to you ?
        8. When you get sick ?
        9. When someone does bad to you ?
            1. Intentionally ?
            2. Unintentionally ?
        10. How do you handle secrets or confidentiality?
5. Location
    1. Which country are you from ?
        1. Which city are you from?
    2. City ?
    3. Where do you live ?
        1. In which country do you live?
        2. In which city do you live?
    4. Origin/ethnicity
6. What do you do in life ?
    1. Study
        1. What do you study ?
        2. When did you start ?
        3. When will it end ?
        4. What do you aim after studying ?
            1. Work in which domain ?
                1. Where ?
                2. What is the expected salary ?
    2. Work
        1. What work ?
        2. Since when ?
        3. Where ?
        4. Current salary ?
        5. Any future work related plan ?
            1. When ?
            2. Where ?
    3. Unemployment
        1. Since when ?
        2. If you are a man, how much unemployed aid do you perceive ?
        3. Have you studied or done any formations ?
        4. What's the plan for providing for the family if it's man?
        5. House wife ?
            1. If you plan to be a housewife, do you intend for this to be for ever?
    4. Handicapped 
        1. What handicapped ?
        2. Since when ?
        3. Do you perceive an aid ?
        4. Any plan ?
    5. Retired
        1. Since when ?
        2. Any future plan ?
        3. Retirement pension perceived each month ?
7. Have you ever been married before ?
    1. Origin of the Wife/Wives
    2. How many times ?
    3. What happened to each marriage ?
        1. When did you divorce ?
        2. Do you give them a pension ?
            1. How much to each ?
        3. Do you have any children from previous marriage ?
            1. How many from each marriage ?
                1. Their sex, age, origin
8. Marriage children plan
    1. Do you plan to have children ?
        1. Yes
            1. When to have children ?
                1. If you want to planify children:
                    1. Are you supportive of contraception ?
                        1. Any preference and requirement of which kind of contraception ?
            2. How many children ?
                1. Do you prefer boys or girls ?
                    1. How many boys ?
                    2. How many girls ?
                2. How long between each child ?
        2. No
            1. Why ?
        3. What do you think of raising orphans ?
            1. How many ? 
            2. What sex ?
            3. Time between each ?
            4. Country/culture of origin ?
9. Children Education
    1. If you want to have children, husband and wife should spend time with the baby ?
        1. How much for each ?
        2. How to combine work and spending time with children ?
        3. Will the children need a guardian/nurse ?
    2. Breast feeding is important for a baby health up to 2 years, what your plan ?
    3. Who will take children to school ?
        1. What kind of school would you like to sign up the children to ?
    4. Who will cook for them breakfast, lunch and dinner ?
    5. Who will help them with homework ?
    6. Who will take them to hobbies/sport/islamic classes, etc ?
10. How much do you plan to travel with family ?
11. If you are a man do you plan to be away from the family ?
    1. How often ?
        1. For how long ?
        2. Where ?
            1. If you plan to be away, would this be abroad?
    2. If yes, who will take care and protect the family ?
12. Healthy lifestyle 
    1. Is it important for you ?
        1. If yes, how it translates in your daily life ?
            1. Workout ?
            2. Healthy food ?
            3. Do you cook ?
13. Islamic growth
    1. Do you know arabic ?
        1. Are you able to read quran ?
            1. Easy, medium or hard to read ?
            2. How often do you read ?
        2. What's your objectives regarding the learning of the quran ?
    2. Do you know the tarsir of the quran ?
        1. In which language do you read it ?
        2. Which tafsir do you use ?
        3. What's your objectives regarding tafsir ?
    3. Do you learn more about islam ?
        1. How ?
            1. Do you go to lectures in seminars or mosques ?
            2. Online classes ?
                1. Which ones ?
            3. Online websites ?
                1. Which ones ?
    4. How would you rate your level now between 0 and 10 ?
        1. Do you plan to improve slowly, medium, or fast ?
    5. What's the final stage you dream to reach ?
    6. How would you like your future spouse to contribute to your improvement ?
14. Religious education of children
    1. How do you plan to raise your children ?
        1. What do you plan to do to achieve that ?
        2. How the future spouse is supposed to contribute ?
15. Islamic expectations on spouse
    1. Do you have islamic expectations of your future spouse ?
        1. Hijab, niqab, full face veil, gloves
        2. Wear large ?
        3. Non colourful clothes ?
        4. Qamis ?
        5. Beard ?
        6. Man hat ?
        7. Prayer
        8. Fasting 
        9. Umra, Hajj
        10. Charity
        11. Benevolent
        12. Teaching islam
        13. Hafidh Quran 
            1. How much should they have memorised ?
    2. Do you have expectations on how to behave with your family ?
        1. Should wear niqab during family gatherings ?
        2. No mixed gatherings ?
        3. Frequency of visit ?
            1. Everyday, often, sometimes, only in very important celebrations ?
            2. Should they visit together ?
                1. Can the spouse visit the family without telling the other spouse ?
        4. Should the 2 families help each other ?
            1. Keep safe distance ?
            2. Can families get involved in marital life ?
16. Mahr
    1. Which form ?
    2. How much ?
    3. Paid before marital life ?
        1. Paid during marital life ?
    4. Do you expect any gifts?
        1. Estimate of the cost ?
17. Current place of living situation 
    1. Do you live alone ?
        1. In apparement ?
        2. Same city than your family ?
18. Future place of living situation
    1. Do you want to live in the same city ?
    2. Join your husband to his city ?
    3. Move to a particular city, place, country ?
        1. For which reasons ?
        2. When ?
        3. Indefinitely ?
    4. Are you planning to do Hijra ?
        1. When ?
        2. Where ?
        3. Indefinitely ? 
19. Origin/Culture
    1. Are a cultural person ?
        1. A lot, medium, little, not at all
    2. Are you willing to marry from other cultures ?
        1. Which ones ?
        2. Which ones not ?
    3. Do you have family in your home country ?
        1. Family relatives ?
        2. Do you visit them often ?
            1. Alone ?
            2. With whole family ?
    4. Do you have family in your origin country ?
        1. Family relatives ?
        2. Do you visit often there ?
            1. Alone ?
            2. With whole family ?
20. Wedding 
    1. What kind of wedding are you planning ? 
        1. Who will you invite ?
        2. Will it be mixed ?
        3. Any special things ?
        4. Estimate how much will it cost ?
        5. How long will it take to prepare ?
    2. Do you want honey moon ?
        1. Where ?
        2. Estimate how much it will cost ?
21. Housing 
    1. Do you accept to live with your spouses' parents ?
        1. If yes for how long ?
    2. Any requirement for a personal housing ?
        1. Apartment, house, villa, etc ?
            1. Any specific requirements in how should be the housing?
        2. Should it be furnished ?
            1. Which style, colours ?
            2. By who ?
                1. Estimate the cost 
22. How long are you willing to wait for the marital life after finding a match ?
23. Expectations on spouse's family 
    1. Do you have any ?
        1. Origin ?
        2. Place of living
        3. Religiosity 
        4. Involvement in private affairs
        5. Wealth 
        6. Ages of parents, siblings, etc
24. Going out
    1. Do you want to go out at wish without letting know your partner ?
    2. Do you want your own car ?
        1. What kind of car ?
            1. Estimate of price 
    3. Do you want to go out in family ?
        1. How often ?
        2. Where ?
    4. Do you want to go out with spouse only ?
        1. How often ?
        2. Where ?
        3. Who will take care of the children ?
25. Chores
    1. Who should take care of the house chores ?
        1. Is there any division expected ?
            1. How often ?
    2. Who buys the groceries ?
    3. Taking children to hobbies/classes, etc ?
    4. Who cooks ?
        1. How often ?
            1. 1, 2,3 times a day 
        2. Big meals, small meals ?
26. Conflict resolutions
    1. If there is a small mistake from the spouse, how do you react ?
        1. If it's intentional?
        2. If it's not intentional ?
    2. If there is a big mistake from the spouse, how do you react ?
        1. If it's intentional?
        2. If it's not intentional ?
    3. If there is a small mistake from child ?
        1. If it's intentional?
        2. If it's not intentional ?
    4. If there is a big mistake from child ?
        1. If it's intentional?
        2. If it's not intentional ?
    5. If you do a small mistake, how would you like your spouse to react ?
        1. If it's intentional?
        2. If it's not intentional ?
    6. If you do a big mistake, how would you like your spouse to react ?
        1. If it's intentional?
        2. If it's not intentional ?
27. Showing signs of love 
    1. How do you plan to show signs of love to your spouse ?
    2. How do you plan to show signs of love to your children ?
    3. How you like plan your spouse to show signs of love to you ?
28. End goals for a fulfilled life inshAllah
    1. What are your personal end goals to achieve in life inshAllah?
        1. How would you like your spouse to support you in that ?
    2. What are your end goals for your family inshAllah?
        1. How would you like your spouse to support you in that ?
    3. Would you support your spouse in their end goals ?
        1. Are there any conditions ?
29. Pets
    1. Do you want to have pets ?
        1. Which ones ?
        2. How many ?
        3. Who will buy the food, pay the veterinary, etc ?
        4. Who will take them out ?
        5. Will they stay inside or outside ?
        6. Are they noisy ?
        7. Are they clean?
            1. Who will clean them ?
                1. How often ?
30. Politics
    1. Is politics important to you ?
        1. Yes 
            1. Little, medium, lot ?
                1. Which views you consider import do you have ?
                2. Do you need spouse having same politics view ?
                3. Which ones you absolutely refuse ? 
        2. No
31. Entertainment/Leisure
    1. What are your views on music, movies, or gaming?
    2. How do you spend weekends/holidays?
32. Technology & Social Media
    1. What are your boundaries for social media use?
    2. How do you view privacy in digital communication?
"""

# Configuration
    # Attempt to import from a definitions file if this script is run in that context
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COMMON_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'common'))

TARGET_COLLECTION_NAME = "LAYER2_FOUNDATIONAL_QUESTIONS"
LAYER_2_NUMERIC_VALUE = 2 

# Try to import if the script is placed correctly relative to 'common'
try:
    import sys
    if COMMON_DIR not in sys.path:
        sys.path.insert(0, COMMON_DIR)
    from definitions import COLLECTIONS, FOUNDATIONAL_LAYER
    TARGET_COLLECTION_NAME = COLLECTIONS['MARRIAGE']['LAYER2_FOUNDATIONAL_QUESTIONS']
    LAYER_2_NUMERIC_VALUE = FOUNDATIONAL_LAYER
    print(f"Successfully imported settings. Using collection: {TARGET_COLLECTION_NAME}, Layer: {LAYER_2_NUMERIC_VALUE}")
except (ImportError, KeyError, AttributeError)  as e:
    print(f"WARNING: Could not import from definitions.py (Error: {e}). Using fallback values:")
    print(f"  Collection: {TARGET_COLLECTION_NAME}")
    print(f"  Layer Value: {LAYER_2_NUMERIC_VALUE}")
    print(f"  (To use values from definitions.py, ensure this script is in a 'scripts' directory,")
    print(f"   and 'common/definitions.py' is one level up, and PYTHONPATH is set up if needed,")
    print(f"   or run from a location where 'apps.marriage-ai.dataflow.pipelines.streaming.common' is importable).")


def sanitize_for_id(text):
    s = re.sub(r'\s+', '_', text.strip())
    s = re.sub(r'[^\w_]', '', s) 
    return s.upper()[:40] 

def count_leading_spaces(line_str):
    return len(line_str) - len(line_str.lstrip(' '))

def parse_questions(text_block):
    parsed_questions = []
    lines = text_block.strip().split('\n')

    current_section_text = ""
    current_section_id_prefix = ""
    current_section_priority = 0
    question_in_section_counter = 0

    section_re = re.compile(r"^\s*(\d+)\.\s+(.+)")
    question_re = re.compile(r"^\s*([\w\d]+)\.\s+(.+)")

    for line_content in lines:
        original_line = line_content 
        stripped_line = line_content.strip()

        if not stripped_line:
            continue

        sec_match = section_re.match(original_line)
        is_section_line = sec_match and count_leading_spaces(original_line) < 2

        if is_section_line:
            sec_num_str, sec_text = sec_match.groups()
            current_section_text = sec_text.strip()

            if sec_num_str == "1" and "Open requirements" in current_section_text:
                current_section_text = None 
                continue
            
            if current_section_text is None: 
                continue

            current_section_priority = int(sec_num_str)
            current_section_id_prefix = sanitize_for_id(current_section_text)
            question_in_section_counter = 0
        
        elif current_section_text: 
            q_match = question_re.match(stripped_line) 
            if q_match:
                q_num_or_letter, q_text_content = q_match.groups()
                q_text_clean = q_text_content.strip()
                question_in_section_counter += 1
                
                question_id = f"L2_{current_section_id_prefix}_{current_section_priority:02d}_{question_in_section_counter:03d}"
                priority = current_section_priority * 1000 + question_in_section_counter

                parsed_questions.append({
                    'id': question_id,
                    'text': q_text_clean,
                    'layer': LAYER_2_NUMERIC_VALUE,
                    'section': current_section_text,
                    'priority': priority
                })
            
    return parsed_questions

def populate_layer2_questions_to_firestore(questions_data):
    print(f"Attempting to populate Layer 2 questions in Firestore collection: {TARGET_COLLECTION_NAME}")
    
    try:
        db = firestore.Client()
        print("Firestore client initialized.")
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Default Credentials not found.")
        print("Please ensure you are authenticated (e.g., `gcloud auth application-default login`)")
        print("or that GOOGLE_APPLICATION_CREDENTIALS environment variable is set.")
        return 0
    except Exception as e:
        print(f"ERROR: Could not initialize Firestore client: {e}")
        return 0

    batch = db.batch()
    populated_count = 0
    processed_ids = set()

    for q_data in questions_data:
        q_id = q_data.get('id')
        if not q_id:
            print(f"Skipping question due to missing ID: {q_data.get('text', 'N/A')}")
            continue
        if q_id in processed_ids:
            print(f"WARNING: Duplicate ID generated '{q_id}' for question '{q_data['text']}'. Skipping.")
            continue
        processed_ids.add(q_id)

        doc_data = {
            'id': q_id, # Storing ID as a field to match QuestionTemplate interface
            'text': q_data['text'],
            'layer': q_data['layer'],
            'section': q_data.get('section', 'General'),
            'priority': q_data.get('priority', 99999)
        }

        doc_ref = db.collection(TARGET_COLLECTION_NAME).document(q_id)
        batch.set(doc_ref, doc_data) 
        populated_count += 1
        
        if populated_count > 0 and populated_count % 400 == 0: # Firestore batch limit is 500
            print(f"Committing batch of 400 questions (total processed: {populated_count})...")
            try:
                batch.commit()
                batch = db.batch() 
                print(f"Committed {populated_count} questions.")
            except Exception as e:
                print(f"ERROR committing batch: {e}")
                return populated_count 

    if populated_count > 0 and populated_count % 400 != 0: 
        print(f"Committing final batch of {populated_count % 400} questions...")
        try:
            batch.commit()
            print(f"Committed final batch. Total questions {populated_count}.")
        except Exception as e:
            print(f"ERROR committing final batch: {e}")
            return populated_count

    print(f"Finished populating/updating {populated_count} Layer 2 questions in collection '{TARGET_COLLECTION_NAME}'.")
    print(f"Total unique L2 questions parsed from input: {len(questions_data)}")
    print("Please verify the data in the Firestore console.")
    return populated_count

if __name__ == "__main__":
    print("Parsing Layer 2 questions from text block...")
    layer_2_questions = parse_questions(QUESTIONS_TEXT_BLOCK)
    
    if layer_2_questions:
        print(f"Successfully parsed {len(layer_2_questions)} questions.")
        # Uncomment to debug parsed questions:
        # for q_idx, q_val in enumerate(layer_2_questions):
        #     if q_idx < 5 or q_idx > len(layer_2_questions) - 6 : # Print first 5 and last 5
        #          print(f"  ID: {q_val['id']}, Section: {q_val['section']}, Prio: {q_val['priority']}, Text: {q_val['text'][:60]}...")
        
        final_count = populate_layer2_questions_to_firestore(layer_2_questions)
        print(f"\\nTotal number of L2 questions successfully written to Firestore: {final_count}")
        print(f"This count ({final_count}) can be used to help determine TOTAL_CORE_QUESTIONS_IN_SYSTEM in your config.py, assuming these are the only L2 questions.")
    else:
        print("No questions were parsed. Please check the input text block and script logic.")
