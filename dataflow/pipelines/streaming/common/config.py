# apps/marriage-ai/dataflow/pipelines/streaming/common/config.py

# Configuration for Adjusted Match Percentage
TOTAL_CORE_QUESTIONS_IN_SYSTEM = 100  # Placeholder: Sum of all L2 and L4 questions
MIN_CONFIDENCE_WEIGHT = 0.1

# Model Names
# Model for the older facet determination logic (may be deprecated by ANSWER_PARSING_MODEL_NAME)
FACET_DETERMINATION_MODEL_NAME = "gpt-3.5-turbo"

# Model for parsing answers into statements and determining facet for each statement
ANSWER_PARSING_MODEL_NAME = "gpt-3.5-turbo" # Good for structured extraction & classification
 
# Potentially other existing configurations below 