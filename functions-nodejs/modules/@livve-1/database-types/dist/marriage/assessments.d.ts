export type AssessmentFramework = 'attachment' | 'big_five' | 'core_values' | 'love_languages';
/**
 * Represents a single question belonging to a Layer 4 assessment framework,
 * stored in Firestore (e.g., in ASSESSMENT_QUESTIONS_ATTACHMENT).
 * The document ID typically serves as the 'id' field.
 */
export interface AssessmentQuestion {
    text: string;
    framework: AssessmentFramework;
    layer: 4;
    priority: number;
    trait?: string;
    style?: string;
}
