package com.saveslot.app.render

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The cartridge-and-slot geometry, exported from the source FBX.
 *
 * Vertices are interleaved as position(3) + normal(3) + uv(2), which is what the shader expects, so
 * the buffer is uploaded to GL verbatim with no repacking.
 */
@Serializable
data class CartridgeModel(
    val version: Int? = null,
    val meshes: List<ModelMesh> = emptyList(),
) {
    /** Axis-aligned centre of every group belonging to [role], used as the rotation pivot. */
    fun centerOf(role: String): FloatArray {
        var minX = Float.MAX_VALUE
        var minY = Float.MAX_VALUE
        var minZ = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE
        var maxY = -Float.MAX_VALUE
        var maxZ = -Float.MAX_VALUE
        var seen = false
        for (mesh in meshes) {
            if (mesh.role != role) continue
            for (group in mesh.groups) {
                var index = 0
                while (index + 2 < group.vertices.size) {
                    val x = group.vertices[index]
                    val y = group.vertices[index + 1]
                    val z = group.vertices[index + 2]
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                    if (z < minZ) minZ = z
                    if (z > maxZ) maxZ = z
                    seen = true
                    index += VERTEX_STRIDE_FLOATS
                }
            }
        }
        if (!seen) return floatArrayOf(0f, 0f, 0f)
        return floatArrayOf((minX + maxX) / 2f, (minY + maxY) / 2f, (minZ + maxZ) / 2f)
    }

    companion object {
        /** position(3) + normal(3) + uv(2) */
        const val VERTEX_STRIDE_FLOATS = 8
        const val ROLE_CARTRIDGE = "cartridge"
        const val ROLE_SLOT = "slot"

        /** The one material that is texture-mapped: the cartridge's box-art label. */
        const val MATERIAL_BOXART = "boxart"
    }
}

@Serializable
data class ModelMesh(
    val role: String = "",
    val groups: List<ModelGroup> = emptyList(),
)

@Serializable
data class ModelGroup(
    val material: String = "",
    val color: List<Float> = emptyList(),
    val metalness: Float = 0f,
    val roughness: Float = 0.5f,
    val vertices: List<Float> = emptyList(),
)

/**
 * Loads and caches the model asset.
 *
 * The file is ~290 KB of JSON, and both the slot stage and the card previews need it, so it is
 * parsed once off the main thread and shared.
 */
class CartridgeModelLoader(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val mutex = Mutex()
    private var cached: CartridgeModel? = null

    suspend fun load(): CartridgeModel = cached ?: mutex.withLock {
        cached ?: withContext(Dispatchers.IO) {
            val raw = context.assets.open(ASSET_NAME).bufferedReader().use { it.readText() }
            json.decodeFromString(CartridgeModel.serializer(), raw)
        }.also { cached = it }
    }

    private companion object {
        const val ASSET_NAME = "cartridge-slot-model.json"
    }
}

/**
 * Material tints applied on top of the exported colours.
 *
 * The FBX export carries near-black plastic and dim gold, which read as flat grey on a phone
 * screen; these brighter values restore the intended look without re-exporting the asset.
 */
internal fun materialColor(material: String, exported: List<Float>): FloatArray = when (material) {
    "gold pin" -> floatArrayOf(0.88f, 0.75f, 0.32f)
    "cartridge mat" -> floatArrayOf(0.52f, 0.56f, 0.63f)
    "slot mat" -> floatArrayOf(0.46f, 0.50f, 0.57f)
    else -> FloatArray(3) { exported.getOrElse(it) { 0.8f } }
}
