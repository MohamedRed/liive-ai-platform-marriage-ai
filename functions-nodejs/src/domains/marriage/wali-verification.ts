import { RelationshipType } from "@livve-1/database-types";

export interface VerifiedWaliRelationPayload {
  userId: string;
  waliId: string;
  relationship: RelationshipType;
  status: "verified";
  verificationMetadata: {
    attempts: number;
  };
  createdAt: unknown;
  updatedAt: unknown;
}

export function isRelationshipType(value: unknown): value is RelationshipType {
  return Object.values(RelationshipType).includes(value as RelationshipType);
}

function requireTrimmedId(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

export function buildVerifiedWaliRelationPayload(
  userID: string,
  waliID: string,
  relationship: unknown,
  timestamp: unknown,
): VerifiedWaliRelationPayload {
  const userId = requireTrimmedId(userID, "userID");
  const waliId = requireTrimmedId(waliID, "waliID");

  if (!isRelationshipType(relationship)) {
    throw new Error("Invalid wali relationship type");
  }

  return {
    userId,
    waliId,
    relationship,
    status: "verified",
    verificationMetadata: {
      attempts: 1,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
