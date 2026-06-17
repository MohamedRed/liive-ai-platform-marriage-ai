// ChatScreen.kt — wali-supervised post-match conversation (Compose).
package com.justmarriage.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.justmarriage.design.*

@Composable
fun ChatScreen(modifier: Modifier = Modifier, onBack: () -> Unit = {}) {
    data class Msg(val me: Boolean, val text: String)
    var msgs by remember {
        mutableStateOf(
            listOf(
                Msg(false, "Assalamu alaikum — our walis have connected us. Looking forward to getting to know your family."),
                Msg(true, "Wa alaikum assalam. Likewise, alhamdulillah."),
                Msg(false, "Shall we set a supervised call this weekend?"),
            ),
        )
    }
    var draft by remember { mutableStateOf("") }
    var callNotice by remember { mutableStateOf<String?>(null) }
    val canSend = draft.trim().isNotEmpty()

    Column(modifier.fillMaxSize().background(JMPalette.White)) {
        Row(
            Modifier.fillMaxWidth().background(JMColors.surfaceCard).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(34.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = JMPalette.Ink700)
            }
            JMAvatar(initials = "A", size = 40.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Matched · 99%", fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text(
                    "Wali-supervised",
                    color = JMColors.success,
                    fontFamily = JMFontFamily.Sans,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 11.sp,
                    modifier = Modifier.clip(CircleShape).background(JMPalette.Green50).padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(JMColors.primary).clickable {
                    callNotice = PreviewJustMarriageServices.current.chat.startSupervisedVideoCall().message()
                },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.Videocam, null, tint = JMPalette.White, modifier = Modifier.size(20.dp)) }
        }

        LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { SupervisionPill() }
            callNotice?.let {
                item {
                    Text(
                        it,
                        color = JMColors.textSecondary,
                        fontFamily = JMFontFamily.Sans,
                        fontSize = 12.5.sp,
                        modifier = Modifier.fillMaxWidth().clip(JMShapes.md).background(JMPalette.Amber50).padding(10.dp),
                    )
                }
            }
            items(msgs) { m -> Bubble(m.me, m.text) }
        }

        Row(
            Modifier.fillMaxWidth().background(JMColors.surfaceCard).padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.weight(1f).clip(CircleShape).background(JMPalette.Ink100).padding(horizontal = 16.dp, vertical = 11.dp)) {
                if (draft.isEmpty()) Text("Write a message…", color = JMColors.textTertiary, fontSize = 14.sp)
                BasicTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    textStyle = TextStyle(color = JMColors.ink, fontFamily = JMFontFamily.Sans, fontSize = 14.sp),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Box(
                Modifier.size(40.dp).clip(CircleShape)
                    .background(JMColors.primary)
                    .clickable {
                        if (canSend) {
                            msgs = msgs + Msg(true, draft.trim())
                            draft = ""
                        }
                    },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.AutoMirrored.Filled.Send, null, tint = JMPalette.White, modifier = Modifier.size(19.dp)) }
        }
    }
}

@Composable
private fun SupervisionPill() {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Text("Both walis are in this conversation", color = JMColors.textTertiary, fontSize = 12.sp,
            modifier = Modifier.clip(CircleShape).background(JMPalette.Ink100).padding(horizontal = 12.dp, vertical = 5.dp))
    }
}

@Composable
private fun Bubble(me: Boolean, text: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (me) Arrangement.End else Arrangement.Start) {
        Text(text, color = if (me) JMPalette.White else JMColors.ink,
            fontFamily = JMFontFamily.Sans, fontSize = 14.5.sp, lineHeight = 20.sp,
            modifier = Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(18.dp))
                .background(if (me) JMColors.primary else JMColors.surfaceCard)
                .then(if (me) Modifier else Modifier.border(1.dp, JMColors.borderSubtle, RoundedCornerShape(18.dp)))
                .padding(horizontal = 14.dp, vertical = 10.dp))
    }
}
