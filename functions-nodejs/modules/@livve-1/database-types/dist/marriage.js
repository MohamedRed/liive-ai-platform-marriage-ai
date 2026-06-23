"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewWaliSchema = exports.RelationshipType = exports.QuestionLayer = void 0;
const zod_1 = require("zod");
// Define the layers
var QuestionLayer;
(function (QuestionLayer) {
    QuestionLayer[QuestionLayer["LAYER_1_CLARIFICATION"] = 1] = "LAYER_1_CLARIFICATION";
    QuestionLayer[QuestionLayer["LAYER_2_FOUNDATIONAL"] = 2] = "LAYER_2_FOUNDATIONAL";
    QuestionLayer[QuestionLayer["LAYER_3_GENERAL"] = 3] = "LAYER_3_GENERAL";
    QuestionLayer[QuestionLayer["LAYER_4_INSIGHT"] = 4] = "LAYER_4_INSIGHT";
    QuestionLayer[QuestionLayer["LAYER_5_TOP_MATCH"] = 5] = "LAYER_5_TOP_MATCH";
})(QuestionLayer || (exports.QuestionLayer = QuestionLayer = {}));
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["FATHER"] = "father";
    RelationshipType["BROTHER"] = "brother";
    RelationshipType["UNCLE"] = "uncle";
    RelationshipType["OTHER"] = "other";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
// Enhanced Zod Schema for Wali
exports.NewWaliSchema = zod_1.z.object({
    name: zod_1.z.object({
        first: zod_1.z.string().min(1),
        last: zod_1.z.string().min(1)
    }),
    contact: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/),
        email: zod_1.z.string().email()
    }),
    address: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string().optional(),
        postalCode: zod_1.z.string(),
        country: zod_1.z.string().length(2) // ISO 3166-1 alpha-2
    }),
    relationship: zod_1.z.nativeEnum(RelationshipType),
});
