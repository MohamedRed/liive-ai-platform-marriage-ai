// Models.kt — mock data + shared types for the Just Marriage screens (Compose).
package com.justmarriage.app

data class Prospect(val label: String, val city: String, val score: Int)

enum class AppTab { Talk, Matches, Profile, Wali, Settings }

object Mock {
    val bestMatch = Prospect("Sister · 27", "London, UK", 99)
    val prospects = listOf(
        Prospect("Sister · 25", "Manchester", 91),
        Prospect("Sister · 29", "Birmingham", 88),
        Prospect("Sister · 26", "Leeds", 84),
    )
}
