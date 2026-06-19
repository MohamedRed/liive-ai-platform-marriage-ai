// SettingsScreen.kt — profile summary + preference toggles (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun SettingsScreen(modifier: Modifier = Modifier) {
    var matchNotif by remember { mutableStateOf(true) }
    var notifyWali by remember { mutableStateOf(true) }
    var hidePhoto by remember { mutableStateOf(false) }
    // overlay: null | "membership" | "guarantee"
    var overlay by remember { mutableStateOf<String?>(null) }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(JMSpace.gutter),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x5)) {

        SectionHeader("Settings")

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(JMSpace.x4)) {
            JMAvatar(initials = "AB", size = 60.dp)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Aisha B.", style = JMText.headingSm)
                JMBadge("Identity verified", tone = JMBadgeTone.Success, soft = true)
            }
        }

        // Premium membership entry
        Row(Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.ink)
            .clickable { overlay = "membership" }.padding(18.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(Icons.Filled.WorkspacePremium, null, tint = JMColors.secondary, modifier = Modifier.size(26.dp))
            Column(Modifier.weight(1f)) {
                Text("Membership & guarantee", color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                Text("99% match in 6 months — or fully refunded", color = JMPalette.White.copy(alpha = 0.7f), fontSize = 12.5.sp)
            }
            Icon(Icons.Filled.ArrowForward, null, tint = JMPalette.White.copy(alpha = 0.6f), modifier = Modifier.size(20.dp))
        }

        Column(Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.surfaceCard)
            .border(1.dp, JMColors.borderSubtle, JMShapes.lg)) {
            ToggleRow(Icons.Filled.Notifications, "Match notifications", matchNotif) { matchNotif = it }
            Divider(color = JMPalette.Ink100)
            ToggleRow(Icons.Filled.Shield, "Notify my wali", notifyWali) { notifyWali = it }
            Divider(color = JMPalette.Ink100)
            ToggleRow(Icons.Filled.VisibilityOff, "Hide my photo until match", hidePhoto) { hidePhoto = it }
            Divider(color = JMPalette.Ink100)
            Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Icon(Icons.Filled.Language, null, tint = JMColors.textTertiary, modifier = Modifier.size(22.dp))
                Text("Language", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp, modifier = Modifier.weight(1f))
                Text("English ›", color = JMColors.textTertiary, fontSize = 14.sp)
            }
        }

        JMButton("Sign out", onClick = {}, variant = JMButtonVariant.Outline, fullWidth = true)
    }

    // Premium overlays (full-screen). In a real app these would be nav destinations.
    when (overlay) {
        "membership" -> MembershipScreen(onClose = { overlay = null }, onGuarantee = { overlay = "guarantee" })
        "guarantee" -> GuaranteeScreen(onClose = { overlay = null }, onSeeMembership = { overlay = "membership" })
    }
}

@Composable
private fun ToggleRow(icon: ImageVector, label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Icon(icon, null, tint = JMColors.textTertiary, modifier = Modifier.size(22.dp))
        Text(label, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = JMColors.primary, checkedThumbColor = JMPalette.White))
    }
}
