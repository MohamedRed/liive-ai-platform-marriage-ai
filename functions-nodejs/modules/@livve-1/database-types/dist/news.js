"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsSentiment = exports.NewsTopic = exports.NewsRegion = exports.NewsCategory = void 0;
/**
 * Types of news categories for filtering
 */
var NewsCategory;
(function (NewsCategory) {
    NewsCategory["POLITICS"] = "politics";
    NewsCategory["ECONOMY"] = "economy";
    NewsCategory["TECHNOLOGY"] = "technology";
    NewsCategory["SCIENCE"] = "science";
    NewsCategory["HEALTH"] = "health";
    NewsCategory["ENVIRONMENT"] = "environment";
    NewsCategory["SPORTS"] = "sports";
    NewsCategory["ENTERTAINMENT"] = "entertainment";
    NewsCategory["EDUCATION"] = "education";
    NewsCategory["WORLD"] = "world";
})(NewsCategory || (exports.NewsCategory = NewsCategory = {}));
/**
 * Geographic regions for news filtering
 */
var NewsRegion;
(function (NewsRegion) {
    NewsRegion["NORTH_AMERICA"] = "north_america";
    NewsRegion["SOUTH_AMERICA"] = "south_america";
    NewsRegion["EUROPE"] = "europe";
    NewsRegion["MIDDLE_EAST"] = "middle_east";
    NewsRegion["AFRICA"] = "africa";
    NewsRegion["ASIA"] = "asia";
    NewsRegion["OCEANIA"] = "oceania";
})(NewsRegion || (exports.NewsRegion = NewsRegion = {}));
/**
 * Specific topics that may cross categories
 */
var NewsTopic;
(function (NewsTopic) {
    NewsTopic["UKRAINE_RUSSIA_WAR"] = "ukraine_russia_war";
    NewsTopic["USA"] = "usa";
    NewsTopic["MIDDLE_EAST"] = "middle_east";
    NewsTopic["CHINA"] = "china";
    NewsTopic["GLOBAL_ECONOMY"] = "global_economy";
    NewsTopic["CLIMATE_CHANGE"] = "climate_change";
    NewsTopic["ARTIFICIAL_INTELLIGENCE"] = "artificial_intelligence";
})(NewsTopic || (exports.NewsTopic = NewsTopic = {}));
/**
 * The sentiment of the news article
 */
var NewsSentiment;
(function (NewsSentiment) {
    NewsSentiment["POSITIVE"] = "positive";
    NewsSentiment["NEGATIVE"] = "negative";
    NewsSentiment["NEUTRAL"] = "neutral";
})(NewsSentiment || (exports.NewsSentiment = NewsSentiment = {}));
