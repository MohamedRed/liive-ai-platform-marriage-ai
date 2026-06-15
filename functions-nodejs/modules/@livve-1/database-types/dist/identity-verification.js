"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationStatus = void 0;
// Enums for Type Safety
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "pending";
    VerificationStatus["VERIFIED"] = "verified";
    VerificationStatus["REQUIRES_INPUT"] = "requires_input";
    VerificationStatus["CANCELED"] = "canceled";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
