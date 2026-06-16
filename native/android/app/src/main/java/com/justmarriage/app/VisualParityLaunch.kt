package com.justmarriage.app

enum class VisualParityScreen(val key: String) {
    TalkActive("talk-active"),
    TalkIdle("talk-idle"),
    TalkType("talk-type"),
    Matches("matches"),
    MatchDetail("match-detail"),
    Profile("profile"),
    Wali("wali"),
    Verification("verification"),
    Chat("chat"),
    Settings("settings");

    val tab: AppTab?
        get() = when (this) {
            TalkActive, TalkIdle, TalkType -> AppTab.Talk
            Matches, MatchDetail -> AppTab.Matches
            Profile -> AppTab.Profile
            Wali -> AppTab.Wali
            Settings -> AppTab.Settings
            Verification, Chat -> null
        }

    companion object {
        fun from(raw: String?): VisualParityScreen? {
            val normalized = raw?.trim()?.lowercase()?.replace('_', '-') ?: return null
            return entries.firstOrNull { it.key == normalized }
        }
    }
}
