package com.saveslot.app.core.net

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Null-tolerant accessors for the loosely typed upstream payloads.
 *
 * Wikidata, MediaWiki, Steam and GOG all return structures that vary by entity, so navigation is
 * done defensively rather than by deserialising into strict classes.
 */

internal operator fun JsonElement?.get(key: String): JsonElement? =
    (this as? JsonObject)?.get(key)?.takeUnless { it is kotlinx.serialization.json.JsonNull }

internal operator fun JsonElement?.get(index: Int): JsonElement? =
    (this as? JsonArray)?.getOrNull(index)?.takeUnless { it is kotlinx.serialization.json.JsonNull }

internal val JsonElement?.asString: String?
    get() = (this as? JsonPrimitive)?.takeIf { it.isString || it.intOrNull != null }?.content

internal val JsonElement?.asInt: Int?
    get() = (this as? JsonPrimitive)?.let { it.intOrNull ?: it.content.toIntOrNull() }

internal val JsonElement?.asDouble: Double?
    get() = (this as? JsonPrimitive)?.let { it.doubleOrNull ?: it.content.toDoubleOrNull() }

internal val JsonElement?.asBoolean: Boolean
    get() = (this as? JsonPrimitive)?.content?.equals("true", ignoreCase = true) == true

internal val JsonElement?.asArray: List<JsonElement>
    get() = (this as? JsonArray)?.filterNot { it is kotlinx.serialization.json.JsonNull } ?: emptyList()

internal val JsonElement?.asObject: JsonObject?
    get() = this as? JsonObject

internal fun JsonElement?.stringField(vararg path: String): String? {
    var cursor: JsonElement? = this
    for (segment in path) cursor = cursor[segment]
    return cursor.asString
}

internal fun JsonElement?.objectValues(): List<JsonElement> =
    (this as? JsonObject)?.values?.toList() ?: emptyList()

internal fun JsonElement.primitiveContentOrNull(): String? = runCatching { jsonPrimitive.content }.getOrNull()
