// GuaranteeScreen.kt — how the 6-month money-back promise works (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun GuaranteeScreen(onClose: () -> Unit, onSeeMembership: () -> Unit) {
    data class Step(val n: String, val title: String, val desc: String, val icon: ImageVector, val accent: Boolean = false)
    val steps = listOf(
        Step("01", "Pay once, upfront", "A single membership fee — no subscriptions, no hidden costs.", Icons.Filled.CreditCard),
        Step("02", "We build & match", "Your AI counselor builds a deep profile and searches for true compatibility.", Icons.Filled.Mic),
        Step("03", "Meet your 99% match", "A wali-approved match within six months — that's the promise.", Icons.Filled.Favorite),
        Step("04", "Or full refund", "No match in six months? Every penny back. The confidence is on us.", Icons.Filled.VerifiedUser, accent = true),
    )
    Column(Modifier.fillMaxSize().background(JMColors.surfacePage).verticalScroll(rememberScrollState()).padding(JMSpace.x5),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x4)) {

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(JMPalette.Ink100).clickable(onClick = onClose),
                contentAlignment = Alignment.Center) { Icon(Icons.Filled.Close, "Close", tint = JMPalette.Ink700, modifier = Modifier.size(18.dp)) }
            Text("The guarantee", style = JMText.headingSm)
        }

        JMBadge("Unseen in this industry", tone = JMBadgeTone.Pink, soft = true, uppercase = true)
        Text("A MATCH IN 6 MONTHS,\nOR YOUR MONEY BACK", fontFamily = JMFontFamily.Display, fontSize = 38.sp,
            color = JMColors.ink, lineHeight = 36.sp)
        Text("Dating apps profit when you stay single. We only win when you marry — so we put the fee on the line.",
            color = JMColors.textSecondary, fontFamily = JMFontFamily.Sans, fontSize = 15.5.sp, lineHeight = 23.sp)

        Column(verticalArrangement = Arrangement.spacedBy(JMSpace.x3)) {
            steps.forEach { s ->
                Row(Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.surfaceCard)
                    .border(1.dp, JMColors.borderSubtle, JMShapes.lg).padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(s.n, fontFamily = JMFontFamily.Display, fontSize = 26.sp, color = JMColors.primary, modifier = Modifier.width(34.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(s.icon, null, tint = if (s.accent) JMColors.info else JMPalette.Ink700, modifier = Modifier.size(20.dp))
                            Text(s.title, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                        }
                        Text(s.desc, color = JMColors.textSecondary, fontFamily = JMFontFamily.Sans, fontSize = 14.sp, lineHeight = 20.sp)
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth().clip(JMShapes.md).background(JMPalette.Cyan50).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Filled.CheckCircle, null, tint = JMPalette.Cyan700, modifier = Modifier.size(20.dp))
            Text("Keeping it simple: stay active and complete your profile to qualify. A wali-approved match counts as a match.",
                color = JMPalette.Cyan900, fontFamily = JMFontFamily.Sans, fontSize = 13.5.sp, lineHeight = 19.sp)
        }

        JMButton("See membership", onClick = onSeeMembership, variant = JMButtonVariant.Ink, size = JMButtonSize.Lg, fullWidth = true)
    }
}
