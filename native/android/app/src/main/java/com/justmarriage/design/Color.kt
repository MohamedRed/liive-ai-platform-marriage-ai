// Color.kt — Just Marriage color tokens (Jetpack Compose)
// The ONLY file with hex literals. Reference JMColors.primary etc. everywhere else.
package com.justmarriage.design

import androidx.compose.ui.graphics.Color

object JMPalette {
    // Brand — Pink (primary)
    val Pink50  = Color(0xFFFFE9F6)
    val Pink100 = Color(0xFFFFCDEA)
    val Pink200 = Color(0xFFFF9FD6)
    val Pink300 = Color(0xFFFB6FC0)
    val Pink400 = Color(0xFFF846AC)
    val Pink500 = Color(0xFFF5269B)
    val Pink600 = Color(0xFFD60E82)
    val Pink700 = Color(0xFFA80866)
    val Pink800 = Color(0xFF7A0A4C)
    val Pink900 = Color(0xFF4F0731)

    // Brand — Cyan (secondary)
    val Cyan50     = Color(0xFFE2FBF9)
    val Cyan100    = Color(0xFFBAF6F0)
    val Cyan200    = Color(0xFF84ECE3)
    val Cyan300    = Color(0xFF4DE2D6)
    val Cyan400    = Color(0xFF22D8C9)
    val Cyan500    = Color(0xFF11C6B8)
    val Cyan600    = Color(0xFF0BA194)
    val Cyan700    = Color(0xFF0C7E75)
    val Cyan800    = Color(0xFF0E625C)
    val Cyan900    = Color(0xFF0A413D)
    val CyanBright = Color(0xFF1FE6D8)

    // Pop accent — Yellow
    val Yellow300 = Color(0xFFFFE38A)
    val Yellow400 = Color(0xFFFFD23E)
    val Yellow500 = Color(0xFFF5B600)

    // Ink / neutrals
    val Ink900 = Color(0xFF15161B)
    val Ink800 = Color(0xFF232530)
    val Ink700 = Color(0xFF3A3D4A)
    val Ink600 = Color(0xFF585C6B)
    val Ink500 = Color(0xFF80848F)
    val Ink400 = Color(0xFFA9ADB7)
    val Ink300 = Color(0xFFD2D5DC)
    val Ink200 = Color(0xFFE7E9EE)
    val Ink100 = Color(0xFFF2F3F6)
    val Ink50  = Color(0xFFFAFAFB)
    val White  = Color(0xFFFFFFFF)
    val Black  = Color(0xFF000000)

    val Canvas       = Color(0xFFFBFAF8)
    val CanvasSunken = Color(0xFFF4F2EE)

    // Status (restrained)
    val Green500 = Color(0xFF1FB873)
    val Green50  = Color(0xFFDEF7EC)
    val Amber500 = Color(0xFFFFB020)
    val Amber50  = Color(0xFFFFF3D6)
    val Red500   = Color(0xFFFF4D5E)
    val Red50    = Color(0xFFFFE3E6)
}

/** Semantic aliases — use THESE in UI, not the raw palette. */
object JMColors {
    val primary        = JMPalette.Pink500
    val primaryHover   = JMPalette.Pink600
    val primaryPress   = JMPalette.Pink700
    val primarySoft    = JMPalette.Pink50
    val onPrimary      = JMPalette.White

    val secondary      = JMPalette.CyanBright
    val secondaryHover = JMPalette.Cyan400
    val secondaryPress = JMPalette.Cyan500
    val secondarySoft  = JMPalette.Cyan50
    val onSecondary    = JMPalette.Ink900

    val ink            = JMPalette.Ink900
    val accent         = JMPalette.Yellow400
    val onAccent       = JMPalette.Ink900

    val textPrimary    = JMPalette.Ink900
    val textSecondary  = JMPalette.Ink600
    val textTertiary   = JMPalette.Ink500
    val textDisabled   = JMPalette.Ink400

    val surfacePage    = JMPalette.Canvas
    val surfaceCard    = JMPalette.White
    val surfaceSunken  = JMPalette.CanvasSunken
    val surfaceInverse = JMPalette.Ink900

    val borderSubtle   = JMPalette.Ink200
    val borderDefault  = JMPalette.Ink300
    val borderStrong   = JMPalette.Ink900

    val success = JMPalette.Green500
    val warning = JMPalette.Amber500
    val error   = JMPalette.Red500
    val info    = JMPalette.Cyan600
}
