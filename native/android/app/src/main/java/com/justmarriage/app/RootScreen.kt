// RootScreen.kt — bottom-nav scaffold + onboarding gate (Compose).
package com.justmarriage.app

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.justmarriage.design.*

@Composable
fun RootScreen(visualScreenKey: String? = null) {
    val visualScreen = remember(visualScreenKey) { VisualParityScreen.from(visualScreenKey) }

    JustMarriageTheme {
        if (visualScreen == VisualParityScreen.Onboarding) {
            OnboardingScreen {}
            return@JustMarriageTheme
        }
        if (visualScreen == VisualParityScreen.Verification) {
            VerifyScreen()
            return@JustMarriageTheme
        }
        if (visualScreen == VisualParityScreen.Chat) {
            ChatScreen()
            return@JustMarriageTheme
        }

        var tab by remember { mutableStateOf(visualScreen?.tab ?: AppTab.Talk) }
        var onboarded by remember { mutableStateOf(visualScreen != null) }

        Scaffold(
            containerColor = JMColors.surfacePage,
            bottomBar = {
                NavigationBar(containerColor = JMColors.surfaceCard) {
                    navItem(tab, AppTab.Talk, "Talk", Icons.Filled.Mic) { tab = it }
                    navItem(tab, AppTab.Matches, "Matches", Icons.Filled.Favorite) { tab = it }
                    navItem(tab, AppTab.Profile, "Profile", Icons.Filled.Person) { tab = it }
                    navItem(tab, AppTab.Wali, "Wali", Icons.Filled.Shield) { tab = it }
                    navItem(tab, AppTab.Settings, "Settings", Icons.Filled.Settings) { tab = it }
                }
            }
        ) { pad ->
            val mod = Modifier.padding(pad)
            when (tab) {
                AppTab.Talk -> CounselorHomeScreen(
                    mod,
                    initialMode = if (visualScreen == VisualParityScreen.TalkType) CounselorMode.Text else CounselorMode.Voice,
                    initialConnected = visualScreen != VisualParityScreen.TalkIdle,
                ) { tab = it }
                AppTab.Matches -> MatchmakingScreen(mod, initialDetail = visualScreen == VisualParityScreen.MatchDetail)
                AppTab.Profile -> ProfileQuestionnaireScreen(mod)
                AppTab.Wali -> WaliScreen(mod)
                AppTab.Settings -> SettingsScreen(mod)
            }
        }

        AnimatedVisibility(visible = !onboarded, enter = slideInHorizontally { it }) {
            OnboardingScreen { onboarded = true }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.navItem(
    current: AppTab, tab: AppTab, label: String, icon: ImageVector, onSelect: (AppTab) -> Unit,
) {
    NavigationBarItem(
        selected = current == tab,
        onClick = { onSelect(tab) },
        icon = { Icon(icon, contentDescription = label) },
        label = { Text(label) },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = JMColors.primary,
            selectedTextColor = JMColors.primary,
            indicatorColor = JMColors.primarySoft,
            unselectedIconColor = JMPalette.Ink400,
            unselectedTextColor = JMPalette.Ink400,
        ),
    )
}
