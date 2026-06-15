import { BaseModel } from './base-model.types';
/**
 * Types of news categories for filtering
 */
export declare enum NewsCategory {
    POLITICS = "politics",
    ECONOMY = "economy",
    TECHNOLOGY = "technology",
    SCIENCE = "science",
    HEALTH = "health",
    ENVIRONMENT = "environment",
    SPORTS = "sports",
    ENTERTAINMENT = "entertainment",
    EDUCATION = "education",
    WORLD = "world"
}
/**
 * Geographic regions for news filtering
 */
export declare enum NewsRegion {
    NORTH_AMERICA = "north_america",
    SOUTH_AMERICA = "south_america",
    EUROPE = "europe",
    MIDDLE_EAST = "middle_east",
    AFRICA = "africa",
    ASIA = "asia",
    OCEANIA = "oceania"
}
/**
 * Specific topics that may cross categories
 */
export declare enum NewsTopic {
    UKRAINE_RUSSIA_WAR = "ukraine_russia_war",
    USA = "usa",
    MIDDLE_EAST = "middle_east",
    CHINA = "china",
    GLOBAL_ECONOMY = "global_economy",
    CLIMATE_CHANGE = "climate_change",
    ARTIFICIAL_INTELLIGENCE = "artificial_intelligence"
}
/**
 * The sentiment of the news article
 */
export declare enum NewsSentiment {
    POSITIVE = "positive",
    NEGATIVE = "negative",
    NEUTRAL = "neutral"
}
/**
 * Source of a news article
 */
export interface NewsSource {
    id: string;
    name: string;
    url: string;
    reliability: number;
    bias: number;
}
/**
 * Expert source cited in news analysis or fact-checking
 */
export interface ExpertSource {
    id: string;
    name: string;
    credentials: string;
    organization: string;
    specialization: string[];
    imageUrl?: string;
}
/**
 * Group of articles covering the same subject from different sources
 */
export interface NewsArticleGroup extends BaseModel {
    subject: string;
    slug: string;
    context: string;
    history: string;
    potentialSolutions?: string;
    expertSources: ExpertSource[];
    commonSummary: string;
    articleIds: string[];
    primaryArticleId?: string;
    viewCount: number;
    commentCount: number;
    sentiment: NewsSentiment;
    topics: NewsTopic[];
    categories: NewsCategory[];
    regions: NewsRegion[];
    publishedAt: Date;
    updatedAt: Date;
}
/**
 * Main news article data structure
 */
export interface NewsArticle extends BaseModel {
    title: string;
    description: string;
    content: string;
    sentiment: NewsSentiment;
    source: NewsSource;
    sourceUrl: string;
    categories: NewsCategory[];
    regions: NewsRegion[];
    topics: NewsTopic[];
    publishedAt: Date;
    updatedAt: Date;
    author: string;
    imageUrl?: string;
    videoUrl?: string;
    groupId?: string;
    uniquePerspective?: string;
    viewCount: number;
    shareCount: number;
    relevanceScore?: number;
    aiSummary?: string;
}
/**
 * User comment on a news article
 */
export interface NewsComment extends BaseModel {
    groupId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    isPoliteness: boolean;
    isConstructive: boolean;
    moderationStatus: 'pending' | 'approved' | 'rejected';
    moderationReason?: string;
    likeCount: number;
    dislikeCount: number;
    sentimentScore: number;
    keyTopics: string[];
    summaryClusterId?: string;
}
/**
 * Summarized clusters of similar comments
 */
export interface NewsCommentSummary extends BaseModel {
    groupId: string;
    content: string;
    commentCount: number;
    keyTopics: string[];
    sentiment: number;
    isFactChecked: boolean;
    factCheckSources: ExpertSource[];
    supportingEvidence?: string;
    opposingEvidence?: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Poll related to a news article
 */
export interface NewsPoll extends BaseModel {
    groupId: string;
    question: string;
    options: string[];
    createdAt: Date;
    expiresAt: Date;
    isActive: boolean;
    totalVotes: number;
    results: Record<string, number>;
    showAfterExpertSources: boolean;
}
/**
 * User vote in a poll
 */
export interface NewsPollVote extends BaseModel {
    pollId: string;
    userId: string;
    optionIndex: number;
    votedAt: Date;
}
/**
 * User news preferences
 */
export interface NewsUserPreferences extends BaseModel {
    userId: string;
    preferredCategories: NewsCategory[];
    preferredRegions: NewsRegion[];
    preferredTopics: NewsTopic[];
    showPositiveFirst: boolean;
    hideNegativeNews: boolean;
    emailNotifications: boolean;
    notificationFrequency: 'daily' | 'weekly' | 'never';
}
