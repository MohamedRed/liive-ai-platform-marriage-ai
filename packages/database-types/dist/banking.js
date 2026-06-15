"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSACTION_STATUS_OPTIONS = exports.TRANSACTION_TYPE_OPTIONS = exports.CARD_TYPE_OPTIONS = exports.ACCOUNT_TYPE_OPTIONS = exports.ACCOUNT_STATUS_OPTIONS = void 0;
// Banking Account Types
exports.ACCOUNT_STATUS_OPTIONS = ['active', 'inactive', 'pending', 'frozen'];
exports.ACCOUNT_TYPE_OPTIONS = ['checking', 'savings', 'investment'];
exports.CARD_TYPE_OPTIONS = ['visa', 'mastercard', 'discover', 'amex'];
exports.TRANSACTION_TYPE_OPTIONS = ['income', 'expense', 'transfer', 'payment'];
exports.TRANSACTION_STATUS_OPTIONS = ['pending', 'completed', 'failed', 'processing'];
