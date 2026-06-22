import { RelationshipType } from "@livve-1/database-types";
import {
  buildVerifiedWaliRelationPayload,
  isRelationshipType,
} from "../domains/marriage/wali-verification";

describe("wali verification payload hardening", () => {
  const timestamp = { seconds: 123, nanoseconds: 456 };

  it("builds a verified wali relation record with canonical ids and relationship", () => {
    expect(buildVerifiedWaliRelationPayload(" user-1 ", " wali-1 ", RelationshipType.FATHER, timestamp)).toEqual({
      userId: "user-1",
      waliId: "wali-1",
      relationship: RelationshipType.FATHER,
      status: "verified",
      verificationMetadata: { attempts: 1 },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it("rejects missing ids and non-canonical relationship values before Firestore writes", () => {
    expect(() => buildVerifiedWaliRelationPayload("", "wali-1", RelationshipType.FATHER, timestamp)).toThrow("userID is required");
    expect(() => buildVerifiedWaliRelationPayload("user-1", "", RelationshipType.FATHER, timestamp)).toThrow("waliID is required");
    expect(() => buildVerifiedWaliRelationPayload("user-1", "wali-1", "cousin", timestamp)).toThrow("Invalid wali relationship type");
  });

  it("recognizes only canonical RelationshipType values", () => {
    expect(isRelationshipType(RelationshipType.FATHER)).toBe(true);
    expect(isRelationshipType(RelationshipType.BROTHER)).toBe(true);
    expect(isRelationshipType(RelationshipType.UNCLE)).toBe(true);
    expect(isRelationshipType(RelationshipType.OTHER)).toBe(true);
    expect(isRelationshipType("father ")).toBe(false);
    expect(isRelationshipType("cousin")).toBe(false);
  });
});
