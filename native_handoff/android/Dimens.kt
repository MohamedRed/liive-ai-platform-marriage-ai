// Dimens.kt — spacing, radius, borders, motion (Jetpack Compose)
package com.justmarriage.design

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.ui.unit.dp

object JMSpace {
    val x0  = 0.dp
    val x1  = 4.dp
    val x2  = 8.dp
    val x3  = 12.dp
    val x4  = 16.dp
    val x5  = 20.dp
    val x6  = 24.dp
    val x8  = 32.dp
    val x10 = 40.dp
    val x12 = 48.dp
    val x16 = 64.dp
    val x20 = 80.dp
    val x24 = 96.dp
    val gutter = 20.dp
}

object JMRadius {
    val xs   = 6.dp
    val sm   = 10.dp
    val md   = 14.dp
    val lg   = 20.dp
    val xl   = 28.dp
    val xxl  = 36.dp
    val pill = 999.dp
}

object JMBorder {
    val width     = 1.5.dp
    val widthBold = 2.5.dp
}

object JMMotion {
    const val FAST = 120
    const val BASE = 200
    const val SLOW = 360
    // Snappy ease-out (matches the web cubic-bezier(0.22,1,0.36,1)).
    val EaseOut = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
    fun <T> easeOut() = tween<T>(durationMillis = BASE, easing = EaseOut)
    // Springy — for presses & toggles.
    fun <T> springy() = spring<T>(dampingRatio = 0.62f, stiffness = Spring.StiffnessMediumLow)
}
