package com.justmarriage.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val visualScreen = intent?.getStringExtra("visual_screen")
            ?: intent?.data?.getQueryParameter("screen")
        setContent {
            RootScreen(visualScreenKey = visualScreen)
        }
    }
}
