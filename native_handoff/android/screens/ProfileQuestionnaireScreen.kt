// ProfileQuestionnaireScreen.kt — sections + the 1–10 importance scale (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun ProfileQuestionnaireScreen(modifier: Modifier = Modifier) {
    var rating by remember { mutableStateOf<Int?>(8) }
    val sections = listOf(
        "Personal & family background" to "done",
        "Religious understanding" to "done",
        "Roles & responsibilities" to "active",
        "Children & future plans" to "todo",
        "Finances & lifestyle" to "todo",
    )

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(JMSpace.gutter),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x5)) {

        SectionHeader("Profile")

        // Progress card
        Column(Modifier.fillMaxWidth().clip(JMShapes.lg).background(JMColors.surfaceCard)
            .border(1.dp, JMColors.borderSubtle, JMShapes.lg).padding(JMSpace.x4),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth()) {
                Text("62% complete", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(Modifier.weight(1f))
                Text("10 of 16 sections", color = JMColors.textTertiary, fontSize = 13.sp)
            }
            Box(Modifier.fillMaxWidth().height(10.dp).clip(JMShapes.pill).background(JMPalette.Ink100)) {
                Box(Modifier.fillMaxWidth(0.62f).fillMaxHeight().clip(JMShapes.pill)
                    .background(Brush.horizontalGradient(listOf(JMColors.primary, JMColors.secondary))))
            }
        }

        // Current question
        JMCard(variant = JMCardVariant.Tinted, tint = JMPalette.Pink50) {
            Text("ROLES & RESPONSIBILITIES", color = JMPalette.Pink700, fontFamily = JMFontFamily.Sans,
                fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(Modifier.height(6.dp))
            Text("How important is it that household responsibilities follow Islamic guidance?",
                fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 23.sp)
            Spacer(Modifier.height(JMSpace.x4))
            JMScaleRating(value = rating, onChange = { rating = it }, lowLabel = "Flexible", highLabel = "Essential")
            Spacer(Modifier.height(JMSpace.x3))
            JMButton("Save & continue", onClick = {}, variant = JMButtonVariant.Ink,
                fullWidth = true, icon = Icons.Filled.ArrowForward)
        }

        Text("SECTIONS", color = JMColors.textTertiary, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        Column(verticalArrangement = Arrangement.spacedBy(JMSpace.x2)) {
            sections.forEach { (title, state) -> SectionRow(title, state) }
        }
    }
}

@Composable
private fun SectionRow(title: String, state: String) {
    val active = state == "active"; val done = state == "done"
    Row(
        Modifier.fillMaxWidth().clip(JMShapes.md).background(JMColors.surfaceCard)
            .border(1.5.dp, if (active) JMColors.primary else JMColors.borderSubtle, JMShapes.md)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            if (done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, null,
            tint = if (done) JMColors.success else if (active) JMColors.primary else JMPalette.Ink300,
        )
        Text(title, color = if (done || active) JMColors.ink else JMColors.textTertiary,
            fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp, modifier = Modifier.weight(1f))
        if (active) JMBadge("Now", tone = JMBadgeTone.Pink, soft = true)
    }
}
