package com.saveslot.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.saveslot.app.ui.SaveSlotApp
import com.saveslot.app.ui.theme.SaveSlotTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as SaveSlotApplication).container
        setContent {
            SaveSlotTheme {
                SaveSlotApp(container = container)
            }
        }
    }
}
