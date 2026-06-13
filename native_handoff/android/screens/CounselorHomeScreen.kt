// CounselorHomeScreen.kt — voice-first home with a Talk / Type toggle (Compose).
package com.justmarriage.app

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*
import kotlinx.coroutines.delay

private enum class Mode { Voice, Text }

@Composable
fun CounselorHomeScreen(modifier: Modifier = Modifier, onTab: (AppTab) -> Unit) {
    var mode by remember { mutableStateOf(Mode.Voice) }
    var connected by remember { mutableStateOf(true) }

    Column(
        modifier.fillMaxSize().background(JMColors.ink).padding(JMSpace.x5),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x4),
    ) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text("JUST", fontFamily = JMFontFamily.Display, fontSize = 22.sp, color = JMPalette.White)
                Spacer(Modifier.width(5.dp))
                Text("MARRIAGE", fontFamily = JMFontFamily.Display, fontSize = 18.sp, color = JMColors.primary,
                    modifier = Modifier.clip(JMShapes.xs).background(JMColors.secondary).padding(horizontal = 6.dp, vertical = 1.dp))
            }
            Spacer(Modifier.weight(1f))
            Icon(Icons.Filled.Notifications, contentDescription = null, tint = JMPalette.White.copy(alpha = 0.8f))
        }

        // Toggle
        Row(
            Modifier.align(Alignment.CenterHorizontally).clip(CircleShape)
                .background(JMPalette.White.copy(alpha = 0.1f)).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            toggleChip("Talk", Icons.Filled.Mic, mode == Mode.Voice) { mode = Mode.Voice }
            toggleChip("Type", Icons.Filled.ChatBubble, mode == Mode.Text) { mode = Mode.Text }
        }

        if (mode == Mode.Voice) {
            VoiceBody(connected, onToggleConnect = { connected = !connected }, onTab = onTab)
        } else {
            TextCounsel(Modifier.weight(1f))
        }
    }
}

@Composable
private fun toggleChip(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, on: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.clip(CircleShape).background(if (on) JMPalette.White else Color.Transparent)
            .clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (on) JMColors.ink else JMPalette.White.copy(alpha = 0.75f),
            modifier = Modifier.size(16.dp))
        Text(label, color = if (on) JMColors.ink else JMPalette.White.copy(alpha = 0.75f),
            fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp)
    }
}

@Composable
private fun ColumnScope.VoiceBody(connected: Boolean, onToggleConnect: () -> Unit, onTab: (AppTab) -> Unit) {
    Spacer(Modifier.weight(1f))
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(JMSpace.x6)) {
        JMBadge("AI marriage counselor", tone = JMBadgeTone.Cyan, uppercase = true)
        Box(
            Modifier.size(150.dp).clip(CircleShape)
                .background(Brush.radialGradient(listOf(JMColors.primary.copy(alpha = 0.35f), JMColors.secondary.copy(alpha = 0.12f), Color.Transparent))),
            contentAlignment = Alignment.Center,
        ) { JMVoiceBars(active = connected, tint = JMColors.primary, height = 64.dp) }
        Text(
            if (connected) "“What matters most to you in a spouse?”" else "Tap to start your session",
            color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.SemiBold,
            fontSize = 19.sp, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 300.dp),
        )
        if (connected) {
            Row(Modifier.clip(CircleShape).clickable(onClick = onToggleConnect)
                .padding(horizontal = 22.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Mic, null, tint = JMPalette.White, modifier = Modifier.size(18.dp))
                Text("End session", color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        } else {
            JMButton("Start talking", onClick = onToggleConnect, variant = JMButtonVariant.Primary, size = JMButtonSize.Lg, pill = true)
        }
    }
    Spacer(Modifier.weight(1f))
    Row(horizontalArrangement = Arrangement.spacedBy(JMSpace.x3)) {
        shortcut(Modifier.weight(1f), Icons.Filled.Favorite, "Matches", "1 new") { onTab(AppTab.Matches) }
        shortcut(Modifier.weight(1f), Icons.Filled.Person, "Profile", "62%") { onTab(AppTab.Profile) }
    }
}

@Composable
private fun shortcut(modifier: Modifier, icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, sub: String, onClick: () -> Unit) {
    Row(
        modifier.clip(JMShapes.lg).background(JMPalette.White.copy(alpha = 0.08f)).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, null, tint = JMColors.secondary, modifier = Modifier.size(22.dp))
        Column {
            Text(label, color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(sub, color = JMPalette.White.copy(alpha = 0.7f), fontFamily = JMFontFamily.Sans, fontSize = 12.sp)
        }
    }
}

// Voice bar visualizer.
@Composable
fun JMVoiceBars(active: Boolean, tint: Color, height: Dp, barCount: Int = 7) {
    val transition = rememberInfiniteTransition(label = "bars")
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(barCount) { i ->
            val scale by transition.animateFloat(
                initialValue = 0.25f, targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    tween(900, delayMillis = (i % 4) * 120, easing = JMMotion.EaseOut), RepeatMode.Reverse),
                label = "bar$i",
            )
            Box(Modifier.width(8.dp).height(if (active) height * scale else height * 0.16f).clip(JMShapes.pill).background(tint))
        }
    }
}

// Text conversation with the counselor.
@Composable
private fun TextCounsel(modifier: Modifier = Modifier) {
    data class Msg(val me: Boolean, val text: String)
    val replies = listOf(
        "Thank you for sharing that. How important is it that they share your level of religious practice?",
        "Understood. And how do you both imagine sharing responsibilities at home, in light of Islamic guidance?",
        "That's helpful. When you picture family life, where do children fit into your plans?",
    )
    var thread by remember { mutableStateOf(listOf(Msg(false, "Assalamu alaikum. Let's pick up where we left off — what matters most to you in a future spouse?"))) }
    var draft by remember { mutableStateOf("") }
    var typing by remember { mutableStateOf(false) }
    var ri by remember { mutableStateOf(0) }
    val listState = rememberLazyListState()

    LaunchedEffect(thread.size, typing) {
        listState.animateScrollToItem((thread.size).coerceAtLeast(0))
    }
    if (typing) {
        LaunchedEffect(thread.size) {
            delay(1400); thread = thread + Msg(false, replies[ri % replies.size]); ri++; typing = false
        }
    }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(JMSpace.x3)) {
        LazyColumn(Modifier.weight(1f), state = listState, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(thread) { m ->
                Column(Modifier.fillMaxWidth(), horizontalAlignment = if (m.me) Alignment.End else Alignment.Start) {
                    if (!m.me) Text("COUNSELOR", color = JMPalette.White.copy(alpha = 0.55f),
                        fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    Text(m.text, color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontSize = 14.5.sp, lineHeight = 21.sp,
                        modifier = Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(16.dp))
                            .background(if (m.me) JMColors.primary else JMPalette.White.copy(alpha = 0.1f))
                            .padding(horizontal = 15.dp, vertical = 11.dp))
                }
            }
            if (typing) item {
                Row(Modifier.clip(RoundedCornerShape(16.dp)).background(JMPalette.White.copy(alpha = 0.1f)).padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    repeat(3) { Box(Modifier.size(7.dp).clip(CircleShape).background(JMColors.secondary)) }
                }
            }
        }
        // Composer
        Row(Modifier.clip(CircleShape).background(JMPalette.White.copy(alpha = 0.12f)).padding(start = 16.dp, end = 5.dp, top = 5.dp, bottom = 5.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) {
                if (draft.isEmpty()) Text("Write your answer…", color = JMPalette.White.copy(alpha = 0.5f), fontSize = 14.5.sp)
                BasicTextField(value = draft, onValueChange = { draft = it },
                    textStyle = TextStyle(color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontSize = 14.5.sp))
            }
            Icon(Icons.Filled.Mic, null, tint = JMPalette.White.copy(alpha = 0.6f))
            Box(Modifier.size(40.dp).clip(CircleShape).background(JMColors.primary).clickable {
                val t = draft.trim(); if (t.isNotEmpty()) { thread = thread + Msg(true, t); draft = ""; typing = true }
            }, contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Send, null, tint = JMPalette.White, modifier = Modifier.size(19.dp))
            }
        }
    }
}
