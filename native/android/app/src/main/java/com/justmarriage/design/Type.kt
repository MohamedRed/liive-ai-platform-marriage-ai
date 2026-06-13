// Type.kt — bundled typography (Jetpack Compose).
// Anton and Public Sans are OFL-licensed Google Fonts bundled under res/font/.
package com.justmarriage.design

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.justmarriage.R

object JMFontFamily {
    val Display = FontFamily(Font(R.font.anton_regular, FontWeight.Normal))
    val Sans = FontFamily(
        Font(R.font.public_sans, FontWeight.Normal),
        Font(R.font.public_sans, FontWeight.Medium),
        Font(R.font.public_sans, FontWeight.SemiBold),
        Font(R.font.public_sans, FontWeight.Bold),
        Font(R.font.public_sans, FontWeight.ExtraBold),
        Font(R.font.public_sans, FontWeight.Black),
    )
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
