// MatchmakingScreen.kt — best 99% match + search list, with a detail bottom sheet (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchmakingScreen(modifier: Modifier = Modifier) {
    var showDetail by remember { mutableStateOf(false) }

    Box(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .blur(if (showDetail) 4.dp else 0.dp)
                .verticalScroll(rememberScrollState())
                .padding(JMSpace.gutter),
            verticalArrangement = Arrangement.spacedBy(JMSpace.x5),
        ) {

            SectionHeader("Matches") { JMBadge("1 new", tone = JMBadgeTone.Pink, soft = true, uppercase = true) }

            JMCard(variant = JMCardVariant.Hard) {
                JMBadge("BEST MATCH YET", tone = JMBadgeTone.Ink, tilt = true)
                Spacer(Modifier.height(JMSpace.x2))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(JMSpace.x4)) {
                    JMProgressRing(value = Mock.bestMatch.score.toFloat(), size = 104.dp, sublabel = "match")
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        JMAvatar(locked = true, size = 44.dp)
                        Text(Mock.bestMatch.label, style = JMText.headingSm)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Filled.LocationOn, null, tint = JMColors.textSecondary, modifier = Modifier.size(14.dp))
                            Text(Mock.bestMatch.city, color = JMColors.textSecondary, fontSize = 13.sp)
                        }
                    }
                }
                Spacer(Modifier.height(JMSpace.x4))
                JMButton("Review match", onClick = { showDetail = true }, variant = JMButtonVariant.Primary, fullWidth = true)
            }

            Text("SEARCHING FOR A 99% MATCH", color = JMColors.textTertiary, fontFamily = JMFontFamily.Sans,
                fontWeight = FontWeight.Bold, fontSize = 13.sp)

            Mock.prospects.forEach { p -> ProspectRow(p) }
        }

        if (showDetail) {
            ModalBottomSheet(
                onDismissRequest = { showDetail = false },
                containerColor = JMColors.surfaceCard,
                scrimColor = JMColors.ink.copy(alpha = 0.42f),
            ) {
                MatchDetail(Mock.bestMatch) { showDetail = false }
            }
        }
    }
}

@Composable
private fun ProspectRow(p: Prospect) {
    Row(
        Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.surfaceCard)
            .border(1.dp, JMColors.borderSubtle, JMShapes.lg).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(JMSpace.x4),
    ) {
        JMAvatar(locked = true, size = 48.dp)
        Column(Modifier.weight(1f)) {
            Text(p.label, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.LocationOn, null, tint = JMColors.textTertiary, modifier = Modifier.size(12.dp))
                Text(p.city, color = JMColors.textTertiary, fontSize = 12.5.sp)
            }
        }
        JMProgressRing(value = p.score.toFloat(), size = 52.dp, thickness = 6.dp)
    }
}

@Composable
private fun MatchDetail(p: Prospect, onClose: () -> Unit) {
    val highlights = listOf(
        "Both practising, family-oriented",
        "Wants children in 1–2 years",
        "Open to relocating within UK",
    )
    Column(Modifier.fillMaxWidth().padding(JMSpace.x5).padding(bottom = JMSpace.x6),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(JMSpace.x4)) {
        Text("Best match · ${p.score}%", style = JMText.headingMd)
        JMProgressRing(value = p.score.toFloat(), size = 130.dp, sublabel = "compatibility")
        JMAvatar(locked = true, size = 56.dp)
        Text("Photos stay private until you both accept. Your wali reviews this match with you.",
            color = JMColors.textSecondary, fontSize = 14.sp, style = JMText.bodySm)
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            highlights.forEach { Text("•  $it", fontFamily = JMFontFamily.Sans, fontSize = 14.sp) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(JMSpace.x3)) {
            JMButton("Not now", onClick = onClose, variant = JMButtonVariant.Outline, modifier = Modifier.weight(1f))
            JMButton("Accept & notify wali", onClick = onClose, variant = JMButtonVariant.Primary, modifier = Modifier.weight(1f))
        }
    }
}

// Shared section header (Anton, uppercase).
@Composable
fun SectionHeader(title: String, trailing: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title.uppercase(), fontFamily = JMFontFamily.Display, fontSize = 30.sp, color = JMColors.ink)
        Spacer(Modifier.weight(1f))
        trailing?.invoke()
    }
}
