// Theme.kt — Material 3 theme wiring (Jetpack Compose)
package com.justmarriage.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

// Just Marriage is a light-surface brand (loud accents on calm off-white).
// We map the brand onto a Material 3 light scheme; prefer JMColors.* directly in custom
// components, and use this scheme for stock Material widgets.
private val JMColorScheme = lightColorScheme(
    primary            = JMColors.primary,
    onPrimary          = JMColors.onPrimary,
    primaryContainer   = JMPalette.Pink50,
    onPrimaryContainer = JMPalette.Pink700,
    secondary          = JMColors.secondary,
    onSecondary        = JMColors.onSecondary,
    secondaryContainer = JMPalette.Cyan50,
    onSecondaryContainer = JMPalette.Cyan700,
    tertiary           = JMColors.accent,
    onTertiary         = JMColors.onAccent,
    background         = JMColors.surfacePage,
    onBackground       = JMColors.textPrimary,
    surface            = JMColors.surfaceCard,
    onSurface          = JMColors.textPrimary,
    surfaceVariant     = JMColors.surfaceSunken,
    onSurfaceVariant   = JMColors.textSecondary,
    outline            = JMColors.borderDefault,
    outlineVariant     = JMColors.borderSubtle,
    error              = JMColors.error,
    onError            = JMPalette.White,
)

@Composable
fun JustMarriageTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = JMColorScheme,
        typography  = JMTypography,
        shapes      = JMMaterialShapes,
        content     = content,
    )
}
