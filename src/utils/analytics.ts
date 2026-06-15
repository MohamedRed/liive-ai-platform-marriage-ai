import { analytics } from 'src/lib/firebase';
import { logEvent } from "firebase/analytics";

export const AnalyticsEvents = {
  AGENT_VIEW: 'agent_view',
  PROFILE_VIEW: 'profile_view',
  PROFILE_UPDATE: 'profile_update',
  QUESTION_ANSWER: 'question_answer',
  WALI_VIEW: 'wali_view',
  WALI_UPDATE: 'wali_update',
  MATCHES_VIEW: 'matches_view',
  MATCH_VIEW: 'match_view',
  BEST_MATCH_VIEW: 'best_match_view',
  SETTINGS_VIEW: 'settings_view',
  STATISTICS_VIEW: 'statistics_view'
} as const;

export function trackEvent(
  eventName: keyof typeof AnalyticsEvents,
  params?: {
    [key: string]: any;
  }
) {
  logEvent(analytics, AnalyticsEvents[eventName], {
    timestamp: new Date().toISOString(),
    ...params
  });
} 