// ChatScreen.kt — wali-supervised post-match conversation (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun ChatScreen(modifier: Modifier = Modifier, onBack: () -> Unit = {}) {
    data class Msg(val me: Boolean, val text: String)
    val msgs = listOf(
        Msg(false, "Assalamu alaikum — our walis have connected us. Looking forward to getting to know your family."),
        Msg(true, "Wa alaikum assalam. Likewise, alhamdulillah."),
        Msg(false, "Shall we set a supervised call this weekend?"),
    )

    Column(modifier.fillMaxSize().background(JMColors.surfacePage)) {
        // Header
        Row(Modifier.fillMaxWidth().background(JMColors.surfaceCard)
            .border(0.dp, JMColors.borderSubtle).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Filled.ArrowBack, "Back", tint = JMPalette.Ink700)
            JMAvatar(initials = "A", size = 40.dp)
            Column(Modifier.weight(1f)) {
                Text("Matched · 99%", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text("Wali-supervised", color = JMColors.success, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
            }
            Box(Modifier.size(40.dp).clip(CircleShape).background(JMPalette.Pink50), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Videocam, null, tint = JMColors.primary, modifier = Modifier.size(20.dp))
            }
        }

        // Thread
        LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("Both walis are in this conversation", color = JMColors.textTertiary, fontSize = 12.sp,
                        modifier = Modifier.clip(CircleShape).background(JMPalette.Ink100).padding(horizontal = 12.dp, vertical = 5.dp))
                }
            }
            items(msgs) { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.me) Arrangement.End else Arrangement.Start) {
                    Text(m.text, color = if (m.me) JMPalette.White else JMColors.ink,
                        fontFamily = JMFontFamily.Sans, fontSize = 14.5.sp, lineHeight = 20.sp,
                        modifier = Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(18.dp))
                            .background(if (m.me) JMColors.primary else JMColors.surfaceCard)
                            .then(if (m.me) Modifier else Modifier.border(1.dp, JMColors.borderSubtle, RoundedCornerShape(18.dp)))
                            .padding(horizontal = 14.dp, vertical = 10.dp))
                }
            }
        }

        // Composer
        Row(Modifier.fillMaxWidth().background(JMColors.surfaceCard).padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Write a message…", color = JMColors.textTertiary, fontSize = 14.sp,
                modifier = Modifier.weight(1f).clip(CircleShape).background(JMPalette.Ink100).padding(horizontal = 16.dp, vertical = 11.dp))
            Box(Modifier.size(40.dp).clip(CircleShape).background(JMColors.primary), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Send, null, tint = JMPalette.White, modifier = Modifier.size(19.dp))
            }
        }
    }
}
