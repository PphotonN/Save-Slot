package com.pphotonn.saveslot

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pphotonn.saveslot.ui.MainViewModel
import com.pphotonn.saveslot.ui.SaveSlotApp
import com.pphotonn.saveslot.ui.theme.SaveSlotTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SaveSlotTheme {
                val viewModel: MainViewModel = viewModel()
                SaveSlotApp(viewModel)
            }
        }
    }
}
