export declare const ACCOUNT_STATUS_OPTIONS: readonly ["active", "inactive", "pending", "frozen"];
export type AccountStatus = typeof ACCOUNT_STATUS_OPTIONS[number];
export declare const ACCOUNT_TYPE_OPTIONS: readonly ["checking", "savings", "investment"];
export type AccountType = typeof ACCOUNT_TYPE_OPTIONS[number];
export declare const CARD_TYPE_OPTIONS: readonly ["visa", "mastercard", "discover", "amex"];
export type CardType = typeof CARD_TYPE_OPTIONS[number];
export declare const TRANSACTION_TYPE_OPTIONS: readonly ["income", "expense", "transfer", "payment"];
export type TransactionType = typeof TRANSACTION_TYPE_OPTIONS[number];
export declare const TRANSACTION_STATUS_OPTIONS: readonly ["pending", "completed", "failed", "processing"];
export type TransactionStatus = typeof TRANSACTION_STATUS_OPTIONS[number];
export interface IBankingAccount {
    id: string;
    userId: string;
    type: AccountType;
    status: AccountStatus;
    balance: number;
    currency: string;
    accountNumber: string;
    routingNumber?: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    isDefault?: boolean;
}
export interface IBankingCard {
    id: string;
    userId: string;
    accountId: string;
    cardType: CardType;
    cardNumber: string;
    cardHolder: string;
    cardValid: string;
    cvv?: string;
    isVirtual: boolean;
    isActive: boolean;
    dailyLimit: number;
    monthlyLimit: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface IBankingTransaction {
    id: string;
    userId: string;
    accountId: string;
    type: TransactionType;
    amount: number;
    currency: string;
    description: string;
    category: string;
    status: TransactionStatus;
    recipientName?: string;
    recipientId?: string;
    recipientAccountId?: string;
    recipientAccountNumber?: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface IBankingContact {
    id: string;
    userId: string;
    name: string;
    email?: string;
    accountNumber?: string;
    routingNumber?: string;
    bankName?: string;
    avatarUrl?: string;
    isFavorite: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface IBankingBudget {
    id: string;
    userId: string;
    category: string;
    amount: number;
    currency: string;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    startDate: Date;
    endDate?: Date;
    spent: number;
    remaining: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface IBankingNotification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'alert' | 'info' | 'warning';
    isRead: boolean;
    link?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface IFinancialAccount {
    id: string;
    userId: string;
    stripeFinancialAccountId: string;
    status: 'active' | 'inactive' | 'pending';
    balance: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface ICashBackReward {
    id: string;
    userId: string;
    transactionId: string;
    amount: number;
    percentage: number;
    category: string;
    status: 'pending' | 'approved' | 'credited';
    creditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface IBankingSettings {
    id: string;
    userId: string;
    overdraftProtection: boolean;
    lowBalanceAlert: boolean;
    lowBalanceThreshold: number;
    twoFactorAuth: boolean;
    notificationPreferences: {
        transactions: boolean;
        bills: boolean;
        rewards: boolean;
        security: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
}
