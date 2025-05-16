export type AssessmentFramework = 'attachment' | 'big_five' | 'core_values' | 'love_languages';

/**
 * Represents a single question belonging to a Layer 4 assessment framework,
 * stored in Firestore (e.g., in ASSESSMENT_QUESTIONS_ATTACHMENT).
 * The document ID typically serves as the 'id' field.
 */
export interface AssessmentQuestion {
  // id: string; // Document ID is implicitly the ID
  text: string;
  framework: AssessmentFramework;
  layer: 4; // Constant for Layer 4 assessments
  priority: number; // Determines the order within the specific framework
  trait?: string; // Optional: e.g., 'agreeableness', 'openness' for Big Five
  style?: string; // Optional: e.g., 'anxious_focus', 'avoidant_focus' for Attachment
  // Add any other relevant fields specific to certain assessments if needed
} 