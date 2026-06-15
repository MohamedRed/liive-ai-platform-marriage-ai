// OnboardingScreen.kt — intent + brother/sister selection (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    var role by remember { mutableStateOf<String?>(null) }
    Column(
        Modifier.fillMaxSize().background(JMColors.ink).padding(JMSpace.x6),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x6),
    ) {
        // Wordmark
        Row(verticalAlignment = Alignment.Bottom) {
            Text("JUST", fontFamily = JMFontFamily.Display, fontSize = 34.sp, color = JMPalette.White)
            Spacer(Modifier.width(6.dp))
            Text("MARRIAGE", fontFamily = JMFontFamily.Display, fontSize = 28.sp, color = JMColors.primary,
                modifier = Modifier.clip(JMShapes.xs).background(JMColors.secondary).padding(horizontal = 8.dp, vertical = 2.dp))
        }

        Spacer(Modifier.weight(1f))

        Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
            Text("NO SWAP.", fontFamily = JMFontFamily.Display, fontSize = 46.sp,
                color = JMPalette.White, lineHeight = 44.sp)
            Text("NO CHAT.", fontFamily = JMFontFamily.Display, fontSize = 46.sp,
                color = JMPalette.White, lineHeight = 44.sp)
            Text("NO DATE.", fontFamily = JMFontFamily.Display, fontSize = 46.sp,
                color = JMColors.ink, lineHeight = 44.sp,
                modifier = Modifier.clip(JMShapes.sm).background(JMPalette.Yellow400)
                    .padding(horizontal = 8.dp))
        }
        Text("A calm, guided path to marriage — led by an AI counselor, kept halal by your wali.",
            color = JMPalette.White.copy(alpha = 0.85f), fontFamily = JMFontFamily.Sans, fontSize = 16.sp, lineHeight = 24.sp)

        Column(verticalArrangement = Arrangement.spacedBy(JMSpace.x3)) {
            Text("I AM A…", color = JMPalette.White.copy(alpha = 0.7f), fontFamily = JMFontFamily.Sans,
                fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(JMSpace.x3)) {
                roleCard(Modifier.weight(1f), "brother", "Brother", role) { role = it }
                roleCard(Modifier.weight(1f), "sister", "Sister", role) { role = it }
            }
        }

        Spacer(Modifier.weight(1f))

        JMButton("Create my profile", onClick = onDone, variant = JMButtonVariant.Primary,
            size = JMButtonSize.Lg, pill = true, fullWidth = true, enabled = role != null,
            icon = Icons.AutoMirrored.Filled.ArrowForward)
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Text("Already a member? Sign in", color = JMPalette.White.copy(alpha = 0.7f), fontSize = 13.sp)
        }
    }
}

@Composable
private fun roleCard(modifier: Modifier, id: String, label: String, selected: String?, onPick: (String) -> Unit) {
    val on = selected == id
    Column(
        modifier
            .clip(JMShapes.lg)
            .background(if (on) JMColors.primary else JMPalette.White.copy(alpha = 0.08f))
            .then(if (on) Modifier.border(2.dp, JMColors.primary, JMShapes.lg) else Modifier)
            .clickable { onPick(id) }
            .padding(vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.Person, contentDescription = null, tint = JMPalette.White)
        Text(label, color = JMPalette.White, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}
