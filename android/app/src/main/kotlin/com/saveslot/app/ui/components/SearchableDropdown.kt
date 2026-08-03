package com.saveslot.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.saveslot.app.core.text.normalizeLoose

/**
 * A searchable single-choice selector for long platform and genre vocabularies.
 *
 * The component owns only transient menu state; the selected value remains controlled by its
 * caller. Filtering is local and capped, so a learned taxonomy with hundreds of terms does not
 * create an oversized composition.
 */
@Composable
fun SearchableDropdown(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    val selectedLabel = options.firstOrNull { it.first == selected }?.second
        ?: options.firstOrNull()?.second.orEmpty()
    val normalizedQuery = normalizeLoose(query)
    val filtered = remember(options, normalizedQuery) {
        if (normalizedQuery.isEmpty()) options
        else options.filter { (_, text) -> normalizeLoose(text).contains(normalizedQuery) }
    }

    Column(modifier = modifier) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = {
                IconButton(
                    onClick = {
                        query = ""
                        expanded = true
                    },
                ) {
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = "Відкрити список")
                }
            },
            modifier = Modifier,
        )

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = {
                expanded = false
                query = ""
            },
            modifier = Modifier
                .widthIn(min = 280.dp, max = 380.dp)
                .heightIn(max = 440.dp),
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Пошук у списку…") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    imeAction = ImeAction.Done,
                ),
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            )

            if (filtered.isEmpty()) {
                DropdownMenuItem(
                    text = { Text("Нічого не знайдено") },
                    onClick = {},
                    enabled = false,
                )
            } else {
                filtered.take(MAX_VISIBLE_OPTIONS).forEach { (value, text) ->
                    DropdownMenuItem(
                        text = { Text(text) },
                        onClick = {
                            expanded = false
                            query = ""
                            onSelect(value)
                        },
                    )
                }
            }
        }
    }
}

private const val MAX_VISIBLE_OPTIONS = 80
