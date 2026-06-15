// Components.kt — Just Marriage Jetpack Compose component recipes.
// Mirror the web design system's contracts (see ../components.md). Depend only on
// Color.kt / Dimens.kt / Shape.kt / Type.kt.
package com.justmarriage.design

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ---------------------------------------------------------------- Button

enum class JMButtonVariant { Primary, Secondary, Ink, Outline, Ghost }
enum class JMButtonSize { Sm, Md, Lg }

@Composable
fun JMButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: JMButtonVariant = JMButtonVariant.Primary,
    size: JMButtonSize = JMButtonSize.Md,
    pill: Boolean = false,
    fullWidth: Boolean = false,
    enabled: Boolean = true,
) {
    val height = when (size) { JMButtonSize.Sm -> 36.dp; JMButtonSize.Md -> 46.dp; JMButtonSize.Lg -> 56.dp }
    val fontSize = when (size) { JMButtonSize.Sm -> 13.sp; JMButtonSize.Md -> 15.sp; JMButtonSize.Lg -> 16.sp }
    val bg = when (variant) {
        JMButtonVariant.Primary -> JMColors.primary
        JMButtonVariant.Secondary -> JMColors.secondary
        JMButtonVariant.Ink -> JMColors.ink
        else -> Color.Transparent
    }
    val fg = when (variant) {
        JMButtonVariant.Primary, JMButtonVariant.Ink -> JMColors.onPrimary
        JMButtonVariant.Secondary -> JMColors.onSecondary
        else -> JMColors.ink
    }
    val shape = if (pill) JMShapes.pill else JMShapes.md
    Box(
        modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(height)
            .clip(shape)
            .background(if (enabled) bg else bg.copy(alpha = 0.45f))
            .then(if (variant == JMButtonVariant.Outline) Modifier.border(JMBorder.widthBold, JMColors.ink, shape) else Modifier)
            .clickableNoRipple(enabled, onClick)
            .padding(horizontal = if (size == JMButtonSize.Lg) 30.dp else 22.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = fg, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = fontSize)
    }
}

// ---------------------------------------------------------------- Badge

enum class JMBadgeTone { Ink, Pink, Cyan, Yellow, Success, Warning, Error }

@Composable
fun JMBadge(
    text: String,
    tone: JMBadgeTone = JMBadgeTone.Ink,
    soft: Boolean = false,
    tilt: Boolean = false,
    uppercase: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val (bg, fg) = when (tone) {
        JMBadgeTone.Ink     -> if (soft) JMPalette.Ink100 to JMPalette.Ink900   else JMPalette.Ink900 to JMPalette.White
        JMBadgeTone.Pink    -> if (soft) JMPalette.Pink50 to JMPalette.Pink700  else JMPalette.Pink500 to JMPalette.White
        JMBadgeTone.Cyan    -> if (soft) JMPalette.Cyan50 to JMPalette.Cyan700  else JMPalette.CyanBright to JMPalette.Ink900
        JMBadgeTone.Yellow  -> JMPalette.Yellow400 to JMPalette.Ink900
        JMBadgeTone.Success -> if (soft) JMPalette.Green50 to JMPalette.Green500 else JMPalette.Green500 to JMPalette.White
        JMBadgeTone.Warning -> if (soft) JMPalette.Amber50 to JMPalette.Amber500 else JMPalette.Amber500 to JMPalette.Ink900
        JMBadgeTone.Error   -> if (soft) JMPalette.Red50 to JMPalette.Red500     else JMPalette.Red500 to JMPalette.White
    }
    Box(
        modifier
            .rotate(if (tilt) -4f else 0f)
            .clip(JMShapes.xs)
            .background(bg)
            .padding(horizontal = 11.dp, vertical = 4.dp)
    ) {
        Text(
            if (uppercase) text.uppercase() else text,
            color = fg, fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
        )
    }
}

// ---------------------------------------------------------------- Card

enum class JMCardVariant { Plain, Hard, Tinted }

@Composable
fun JMCard(
    modifier: Modifier = Modifier,
    variant: JMCardVariant = JMCardVariant.Plain,
    tint: Color = JMPalette.Cyan50,
    padding: Dp = JMSpace.x5,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = JMShapes.lg
    Box(
        modifier.then(
            if (variant == JMCardVariant.Hard)
                Modifier.drawBehind {
                    val o = 4.dp.toPx()
                    drawRoundRect(JMColors.ink, topLeft = Offset(o, o),
                        size = size, cornerRadius = androidx.compose.ui.geometry.CornerRadius(20.dp.toPx()))
                }
            else Modifier
        )
    ) {
        Column(
            Modifier
                .clip(shape)
                .background(if (variant == JMCardVariant.Tinted) tint else JMColors.surfaceCard)
                .then(
                    when (variant) {
                        JMCardVariant.Hard -> Modifier.border(JMBorder.widthBold, JMColors.borderStrong, shape)
                        JMCardVariant.Plain -> Modifier.border(JMBorder.width, JMColors.borderSubtle, shape)
                        else -> Modifier
                    }
                )
                .padding(padding),
            content = content,
        )
    }
}

// ---------------------------------------------------------------- ProgressRing (match dial)

@Composable
fun JMProgressRing(
    value: Float,              // 0..100
    modifier: Modifier = Modifier,
    size: Dp = 120.dp,
    thickness: Dp = 12.dp,
    sublabel: String? = null,
) {
    val sweep by animateFloatAsState(value.coerceIn(0f, 100f) / 100f * 360f, JMMotion.easeOut(), label = "ring")
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        androidx.compose.foundation.Canvas(Modifier.size(size)) {
            val stroke = Stroke(width = thickness.toPx(), cap = StrokeCap.Round)
            drawArc(JMPalette.Ink100, 0f, 360f, false, style = Stroke(width = thickness.toPx()))
            drawArc(
                Brush.sweepGradient(listOf(JMColors.primary, JMColors.secondary)),
                -90f, sweep, false, style = stroke,
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${value.toInt()}%", fontFamily = JMFontFamily.Display, fontSize = (size.value * 0.3).sp, color = JMColors.ink)
            sublabel?.let {
                Text(it.uppercase(), fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold,
                    fontSize = (size.value * 0.1).sp, color = JMColors.textTertiary)
            }
        }
    }
}

// ---------------------------------------------------------------- ScaleRating (1–10)

@Composable
fun JMScaleRating(
    value: Int?,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    range: IntRange = 1..10,
    lowLabel: String? = null,
    highLabel: String? = null,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            range.forEach { n ->
                val on = value == n
                Box(
                    Modifier
                        .weight(1f)
                        .height(44.dp)
                        .clip(JMShapes.sm)
                        .background(if (on) JMColors.ink else JMColors.surfaceCard)
                        .border(JMBorder.width, if (on) JMColors.ink else JMColors.borderDefault, JMShapes.sm)
                        .clickableNoRipple(true) { onChange(n) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("$n", color = if (on) JMColors.onPrimary else JMColors.textSecondary,
                        fontFamily = JMFontFamily.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }
        if (lowLabel != null || highLabel != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(lowLabel ?: "", color = JMColors.textTertiary, fontSize = 12.sp)
                Text(highLabel ?: "", color = JMColors.textTertiary, fontSize = 12.sp)
            }
        }
    }
}

// ---------------------------------------------------------------- LockedAvatar (modesty)

@Composable
fun JMAvatar(
    initials: String = "",
    locked: Boolean = false,
    size: Dp = 48.dp,
    tint: Color = JMPalette.Pink100,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier.size(size).clip(CircleShape).background(if (locked) JMPalette.Ink200 else tint),
        contentAlignment = Alignment.Center,
    ) {
        if (locked) {
            // Replace with a Solar lock vector drawable; text shown as a placeholder.
            Text("\uD83D\uDD12".let { "" }, color = JMColors.textTertiary) // intentionally blank; use Icon(painterResource(R.drawable.ic_lock))
            Text("•", color = JMColors.textTertiary, fontSize = (size.value * 0.4).sp)
        } else {
            Text(initials, color = JMPalette.Pink700, fontFamily = JMFontFamily.Sans,
                fontWeight = FontWeight.Bold, fontSize = (size.value * 0.38).sp)
        }
    }
}

// ---------------------------------------------------------------- helpers

@Composable
private fun Modifier.clickableNoRipple(enabled: Boolean, onClick: () -> Unit): Modifier {
    val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    return this.then(
        androidx.compose.foundation.clickable(
            interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick,
        )
    )
}
