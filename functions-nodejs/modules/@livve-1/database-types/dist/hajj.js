"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HAJJ_TYPE_OPTIONS = exports.HAJJ_SERVICE_OPTIONS = exports.HAJJ_COLLECTION = void 0;
/**
 * Firestore collection name
 */
exports.HAJJ_COLLECTION = 'hajj_packages';
/**
 * Service options for Hajj/Umra packages
 */
exports.HAJJ_SERVICE_OPTIONS = [
    { value: 'Visa Processing', label: 'Visa Processing' },
    { value: 'Transportation', label: 'Transportation' },
    { value: 'Accommodation', label: 'Accommodation' },
    { value: 'Meals', label: 'Meals' },
    { value: 'Group Guide', label: 'Group Guide' },
    { value: 'Religious Guidance', label: 'Religious Guidance' },
    { value: 'Ziyarat', label: 'Ziyarat' },
    { value: 'Medical Assistance', label: 'Medical Assistance' },
];
/**
 * Package type options
 */
exports.HAJJ_TYPE_OPTIONS = [
    { value: 'Hajj', label: 'Hajj' },
    { value: 'Umra', label: 'Umra' },
    { value: 'Hajj & Umra', label: 'Hajj & Umra' },
];
