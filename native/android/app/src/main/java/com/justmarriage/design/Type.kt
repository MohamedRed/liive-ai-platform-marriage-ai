// Type.kt — typography (Jetpack Compose)
//
// FONT SETUP (one-time):
// 1. Put font files in res/font/ (lowercase, underscores):
//      anton_regular.ttf
//      public_sans_regular.ttf, public_sans_medium.ttf, public_sans_semibold.ttf,
//      public_sans_bold.ttf, public_sans_extrabold.ttf, public_sans_black.ttf
//    NOTE: Anton & Public Sans are Google-Fonts substitutes pending the licensed
//    display face — see ../SKILL.md.
// 2. R.font references below assume those names.
package com.justmarriage.design

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
// import com.justmarriage.app.R   // <-- point this at your app's R

// Replace these Font(...) calls with R.font.* references once fonts are in res/font/.
// They are written as comments to keep this file compiling standalone; uncomment & wire R.
object JMFontFamily {
    // val Display = FontFamily(Font(R.font.anton_regular))
    // val Sans = FontFamily(
    //     Font(R.font.public_sans_regular,   FontWeight.Normal),
    //     Font(R.font.public_sans_medium,    FontWeight.Medium),
    //     Font(R.font.public_sans_semibold,  FontWeight.SemiBold),
    //     Font(R.font.public_sans_bold,      FontWeight.Bold),
    //     Font(R.font.public_sans_extrabold, FontWeight.ExtraBold),
    //     Font(R.font.public_sans_black,     FontWeight.Black),
    // )
    val Display: FontFamily = FontFamily.Default // TODO: replace with Anton
    val Sans: FontFamily = FontFamily.Default     // TODO: replace with Public Sans
}

// Display = Anton, ALL CAPS at call site (use .uppercase()). Tight leading.
object JMText {
    val displayXl = TextStyle(fontFamily = JMFontFamily.Display, fontSize = 64.sp, lineHeight = 61.sp, letterSpacing = 0.005.em)
    val displayLg = TextStyle(fontFamily = JMFontFamily.Display, fontSize = 48.sp, lineHeight = 46.sp)
    val displayMd = TextStyle(fontFamily = JMFontFamily.Display, fontSize = 36.sp, lineHeight = 35.sp)
    val displaySm = TextStyle(fontFamily = JMFontFamily.Display, fontSize = 28.sp, lineHeight = 27.sp)

    val headingXl = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 32.sp, lineHeight = 40.sp)
    val headingLg = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp, lineHeight = 33.sp)
    val headingMd = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 21.sp, lineHeight = 27.sp)
    val headingSm = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp)
    val headingXs = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 22.sp)

    val bodyLg = TextStyle(fontFamily = JMFontFamily.Sans, fontSize = 18.sp, lineHeight = 28.sp)
    val bodyMd = TextStyle(fontFamily = JMFontFamily.Sans, fontSize = 16.sp, lineHeight = 25.sp)
    val bodySm = TextStyle(fontFamily = JMFontFamily.Sans, fontSize = 14.sp, lineHeight = 21.sp)

    // Eyebrow / label — apply .uppercase() to the string.
    val labelMd = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, letterSpacing = 0.06.em)
    val labelSm = TextStyle(fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 0.06.em)
}

// Material 3 Typography mapping.
val JMTypography = Typography(
    displayLarge  = JMText.displayXl,
    displayMedium = JMText.displayLg,
    headlineLarge = JMText.headingXl,
    headlineMedium= JMText.headingLg,
    titleLarge    = JMText.headingMd,
    titleMedium   = JMText.headingSm,
    bodyLarge     = JMText.bodyLg,
    bodyMedium    = JMText.bodyMd,
    bodySmall     = JMText.bodySm,
    labelLarge    = JMText.labelMd,
    labelSmall    = JMText.labelSm,
)
