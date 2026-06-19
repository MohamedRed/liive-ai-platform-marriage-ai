// WaliScreen.kt — guardian explainer + verification stepper (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun WaliScreen(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(JMSpace.gutter),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x5)) {

        SectionHeader("Wali")

        JMCard(variant = JMCardVariant.Tinted, tint = JMPalette.Cyan50) {
            Icon(Icons.Filled.Shield, null, tint = JMPalette.Cyan700, modifier = Modifier.size(28.dp))
            Spacer(Modifier.height(8.dp))
            Text("Your wali guides the process", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(4.dp))
            Text("A trusted guardian who reviews matches with you and is notified at every step — keeping everything halal.",
                color = JMPalette.Cyan900, fontFamily = JMFontFamily.Sans, fontSize = 14.sp, lineHeight = 21.sp)
        }

        // Stepper
        Row(Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.surfaceCard)
            .border(1.dp, JMColors.borderSubtle, JMShapes.lg).padding(horizontal = 14.dp, vertical = 18.dp),
            verticalAlignment = Alignment.Top) {
            Step(Modifier.weight(1f), "Phone", Icons.Filled.Phone, "done")
            Connector(Modifier.weight(1f), true)
            Step(Modifier.weight(1f), "Identity", Icons.Filled.Badge, "active")
            Connector(Modifier.weight(1f), false)
            Step(Modifier.weight(1f), "Confirm", Icons.Filled.Verified, "todo")
        }

        // Wali contact
        Row(Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.surfaceCard)
            .border(1.dp, JMColors.borderSubtle, JMShapes.lg).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(JMSpace.x4)) {
            JMAvatar(initials = "YB", size = 48.dp, tint = JMPalette.Ink200)
            Column(Modifier.weight(1f)) {
                Text("Yusuf (Father)", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text("+44 7•• ••• 204", color = JMColors.textTertiary, fontSize = 13.sp)
            }
            JMBadge("Verifying", tone = JMBadgeTone.Warning, soft = true)
        }

        JMButton("Continue verification", onClick = {}, variant = JMButtonVariant.Primary, fullWidth = true)
        JMButton("Invite a different wali", onClick = {}, variant = JMButtonVariant.Ghost, fullWidth = true)
    }
}

@Composable
private fun Step(modifier: Modifier, label: String, icon: ImageVector, state: String) {
    val done = state == "done"; val active = state == "active"
    val bg = if (done) JMColors.success else if (active) JMColors.primary else JMColors.surfaceCard
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(bg)
            .then(if (state == "todo") Modifier.border(1.5.dp, JMPalette.Ink200, CircleShape) else Modifier),
            contentAlignment = Alignment.Center) {
            Icon(if (done) Icons.Filled.Check else icon, null,
                tint = if (state == "todo") JMPalette.Ink400 else Color.White, modifier = Modifier.size(18.dp))
        }
        Text(label, color = if (state == "todo") JMColors.textTertiary else JMColors.ink,
            fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
    }
}

@Composable
private fun Connector(modifier: Modifier, done: Boolean) {
    Box(modifier.padding(top = 19.dp).height(2.dp).background(if (done) JMColors.success else JMPalette.Ink200))
}
