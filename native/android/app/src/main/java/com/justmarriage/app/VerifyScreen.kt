// VerifyScreen.kt — phone OTP entry (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun VerifyScreen(modifier: Modifier = Modifier, onBack: () -> Unit = {}, onDone: () -> Unit = {}) {
    val code = remember { mutableStateListOf("", "", "", "") }
    var serviceNotice by remember { mutableStateOf<String?>(null) }
    var attempted by remember { mutableStateOf(false) }
    val complete = code.all { it.length == 1 }

    Column(
        modifier.fillMaxSize().background(JMColors.surfacePage).padding(JMSpace.x5),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x4),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(38.dp).clip(CircleShape).background(JMPalette.Ink100).clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.ArrowBack, "Back", tint = JMPalette.Ink700, modifier = Modifier.size(18.dp)) }
        }

        Text("VERIFICATION", fontFamily = JMFontFamily.Display, fontSize = 42.sp, color = JMColors.ink)
        JMBadge("STEP 1 OF 2 · PHONE", tone = JMBadgeTone.Pink, soft = false)
        Text("Verify your phone", style = JMText.headingLg)
        Text(
            "Enter the 4-digit code we sent to +44 7•• ••• 204",
            color = JMColors.textSecondary,
            fontFamily = JMFontFamily.Sans,
            fontSize = 15.sp,
            lineHeight = 22.sp,
        )

        Row(
            Modifier.fillMaxWidth().padding(top = JMSpace.x3, bottom = JMSpace.x2),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            repeat(4) { i -> OtpBox(value = code[i], active = code[i].isNotEmpty()) { next -> code[i] = next } }
        }

        JMButton(
            "Verify & continue",
            onClick = {
                attempted = true
                serviceNotice = if (complete) {
                    "Verification service is not connected yet. Code entry is ready for the secure provider integration."
                } else null
            },
            variant = JMButtonVariant.Primary,
            size = JMButtonSize.Lg,
            pill = true,
            fullWidth = true,
        )
        Text(
            when {
                serviceNotice != null -> serviceNotice!!
                attempted && !complete -> "Enter all 4 digits to continue."
                else -> "Resend code in 0:29"
            },
            color = when {
                serviceNotice != null -> JMColors.textSecondary
                attempted && !complete -> JMColors.error
                else -> JMColors.textTertiary
            },
            fontFamily = JMFontFamily.Sans,
            fontWeight = if (serviceNotice != null || attempted && !complete) FontWeight.Bold else FontWeight.Normal,
            fontSize = 14.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )

        Spacer(Modifier.weight(1f))

        Row(
            Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMPalette.Cyan50).padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(JMColors.secondary), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.VerifiedUser, null, tint = JMColors.ink, modifier = Modifier.size(19.dp))
            }
            Text(
                "Your number stays private. Matches only see that you are verified.",
                color = JMPalette.Cyan900,
                fontFamily = JMFontFamily.Sans,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
            )
        }
    }
}

@Composable
private fun RowScope.OtpBox(value: String, active: Boolean, onChange: (String) -> Unit) {
    val bg = if (active) JMColors.primary else JMColors.surfaceCard
    val fg = if (active) JMPalette.White else JMColors.ink
    Box(
        Modifier.weight(1f).height(64.dp).clip(JMShapes.md).background(bg)
            .border(2.dp, if (active) JMColors.primary else JMColors.borderDefault, JMShapes.md),
        contentAlignment = Alignment.Center,
    ) {
        BasicTextField(
            value = value,
            onValueChange = { raw -> onChange(raw.filter { it.isDigit() }.take(1)) },
            textStyle = TextStyle(
                fontFamily = JMFontFamily.Display,
                fontSize = 30.sp,
                color = fg,
                textAlign = TextAlign.Center,
            ),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
