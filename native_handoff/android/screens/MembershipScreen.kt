// MembershipScreen.kt — premium paywall, guarantee-first (Compose).
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

const val JM_PRICE = "£2,500" // one-time. Set the real figure here.

@Composable
fun MembershipScreen(onClose: () -> Unit, onGuarantee: () -> Unit) {
    val included = listOf(
        Icons.Filled.VerifiedUser to "Verified, marriage-intent members only",
        Icons.Filled.Mic to "Unlimited AI counselor sessions",
        Icons.Filled.Favorite to "Curated matches scored to 99% compatibility",
        Icons.Filled.Shield to "Wali kept in the loop at every step",
    )
    Column(Modifier.fillMaxSize().background(JMColors.ink).verticalScroll(rememberScrollState()).padding(JMSpace.x5),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x4)) {

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(JMPalette.White.copy(alpha = 0.1f)).clickable(onClick = onClose),
                contentAlignment = Alignment.Center) { Icon(Icons.Filled.Close, "Close", tint = JMPalette.White, modifier = Modifier.size(18.dp)) }
            Text("Membership", style = JMText.headingSm, color = JMPalette.White)
        }

        JMBadge("One membership · one purpose", tone = JMBadgeTone.Cyan, uppercase = true)

        Text("THE 99%\nGUARANTEE", fontFamily = JMFontFamily.Display, fontSize = 46.sp, color = JMPalette.White, lineHeight = 43.sp)
        Text("We're so confident we'll find your match, we'll stake the whole fee on it.",
            color = JMPalette.White.copy(alpha = 0.82f), fontFamily = JMFontFamily.Sans, fontSize = 16.sp, lineHeight = 24.sp)

        // Promise sticker card (pink solid offset shadow behind a bordered white card)
        Box(Modifier.fillMaxWidth().padding(vertical = JMSpace.x2)) {
            Column(
                Modifier.fillMaxWidth()
                    .drawBehind {
                        val o = 6.dp.toPx()
                        drawRoundRect(JMColors.primary, topLeft = Offset(o, o), size = size, cornerRadius = CornerRadius(28.dp.toPx()))
                    }
                    .clip(JMShapes.xl).background(JMPalette.White)
                    .border(2.5.dp, JMColors.ink, JMShapes.xl).padding(22.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    JMProgressRing(value = 99f, size = 88.dp, thickness = 9.dp, sublabel = "match")
                    Column {
                        Text("MATCHED IN 6 MONTHS", fontFamily = JMFontFamily.Display, fontSize = 24.sp, color = JMColors.ink, lineHeight = 24.sp)
                        Text("— or every penny back.", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = JMPalette.Pink600)
                    }
                }
            }
        }

        // Price
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(JM_PRICE, fontFamily = JMFontFamily.Display, fontSize = 56.sp, color = JMPalette.White)
            Text("one-time · fully refundable", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = JMPalette.White.copy(alpha = 0.7f))
        }
        Text("No swiping subscriptions. One serious step, backed by a promise.",
            color = JMPalette.White.copy(alpha = 0.6f), fontFamily = JMFontFamily.Sans, fontSize = 13.5.sp)

        Column(Modifier.padding(top = JMSpace.x3), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            included.forEach { (icon, t) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(icon, null, tint = JMColors.secondary, modifier = Modifier.size(22.dp))
                    Text(t, color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontSize = 15.sp)
                }
            }
        }

        JMButton("Join Just Marriage", onClick = onClose, variant = JMButtonVariant.Primary, size = JMButtonSize.Lg, fullWidth = true)
        Box(Modifier.fillMaxWidth().clickable(onClick = onGuarantee).padding(top = 8.dp), contentAlignment = Alignment.Center) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Info, null, tint = JMColors.secondary, modifier = Modifier.size(18.dp))
                Text("How the guarantee works", color = JMColors.secondary, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
        Text("Refund applies when your profile is complete and you stay active. A wali-approved match counts as a match.",
            color = JMPalette.White.copy(alpha = 0.5f), fontFamily = JMFontFamily.Sans, fontSize = 12.sp, lineHeight = 18.sp,
            modifier = Modifier.fillMaxWidth())
    }
}
