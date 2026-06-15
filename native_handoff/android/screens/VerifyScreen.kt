// VerifyScreen.kt — phone OTP entry (Compose). Present as a full screen or in a sheet.
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

    Column(modifier.fillMaxSize().background(JMColors.surfacePage).padding(JMSpace.x5),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x4)) {

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(JMPalette.Ink100).clickable(onClick = onBack),
                contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.ArrowBack, "Back", tint = JMPalette.Ink700, modifier = Modifier.size(18.dp))
            }
            Text("Verification", style = JMText.headingSm)
        }

        JMBadge("Step 1 of 2 · Phone", tone = JMBadgeTone.Cyan, soft = true, uppercase = true)
        Text("Verify your number", style = JMText.headingLg)
        Text("We sent a 4-digit code to +44 7•• ••• 204", color = JMColors.textSecondary, fontSize = 15.sp)

        Row(Modifier.padding(vertical = JMSpace.x4), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(4) { i ->
                Box(
                    Modifier.weight(1f).height(64.dp).clip(JMShapes.md).background(JMColors.surfaceCard)
                        .border(2.dp, if (code[i].isEmpty()) JMPalette.Ink200 else JMColors.primary, JMShapes.md),
                    contentAlignment = Alignment.Center,
                ) {
                    BasicTextField(
                        value = code[i],
                        onValueChange = { if (it.length <= 1) code[i] = it },
                        textStyle = TextStyle(fontFamily = JMFontFamily.Display, fontSize = 30.sp,
                            color = JMColors.ink, textAlign = TextAlign.Center),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                }
            }
        }

        Text("Didn't get it? Resend in 0:24", color = JMColors.textTertiary, fontSize = 14.sp)

        Spacer(Modifier.weight(1f))

        Row(Modifier.fillMaxWidth().clip(JMShapes.md).background(JMPalette.Cyan50).padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Filled.VerifiedUser, null, tint = JMPalette.Cyan700, modifier = Modifier.size(20.dp))
            Text("Next: a quick identity check keeps the platform safe and serious for everyone.",
                color = JMPalette.Cyan900, fontFamily = JMFontFamily.Sans, fontSize = 13.sp, lineHeight = 18.sp)
        }

        JMButton("Verify & continue", onClick = onDone, variant = JMButtonVariant.Primary, size = JMButtonSize.Lg, fullWidth = true)
    }
}
