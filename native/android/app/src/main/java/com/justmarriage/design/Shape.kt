// Shape.kt — corner shapes (Jetpack Compose / Material 3)
package com.justmarriage.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

object JMShapes {
    val xs   = RoundedCornerShape(6.dp)
    val sm   = RoundedCornerShape(10.dp)
    val md   = RoundedCornerShape(14.dp)
    val lg   = RoundedCornerShape(20.dp)
    val xl   = RoundedCornerShape(28.dp)
    val pill = RoundedCornerShape(999.dp)
}

// Material 3 Shapes mapping (friendly, generous rounding).
val JMMaterialShapes = Shapes(
    extraSmall = JMShapes.xs,
    small      = JMShapes.sm,
    medium     = JMShapes.md,
    large      = JMShapes.lg,
    extraLarge = JMShapes.xl,
)
