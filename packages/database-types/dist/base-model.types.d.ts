/**
 * Base model interface that all domain models extend from.
 * Provides common fields for all database models.
 */
export interface BaseModel {
    id: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    createdBy?: string;
    updatedBy?: string;
}
