package com.saveslot.app.render

import android.graphics.Bitmap
import android.opengl.GLES20
import android.opengl.GLUtils
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * The single GLES2 program the app draws with, plus the buffers for one model.
 *
 * The shading is a hand-rolled approximation rather than real PBR: two fixed directional lights, a
 * cheap specular term and a rim highlight, tuned so dark plastic and gold contacts stay legible on
 * a phone. Textured surfaces (the box-art label) are lit much more flatly so the artwork reads as
 * artwork rather than as a lit object.
 */
internal class CartridgeProgram {

    private var programId = 0
    private var attributePosition = 0
    private var attributeNormal = 0
    private var attributeUv = 0
    private var uniformModel = 0
    private var uniformViewProjection = 0
    private var uniformColor = 0
    private var uniformMetal = 0
    private var uniformRough = 0
    private var uniformTextured = 0
    private var uniformTexture = 0
    private var uniformCamera = 0

    val isReady: Boolean get() = programId != 0

    fun compile() {
        val vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, VERTEX_SOURCE)
        val fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SOURCE)
        programId = GLES20.glCreateProgram()
        GLES20.glAttachShader(programId, vertexShader)
        GLES20.glAttachShader(programId, fragmentShader)
        GLES20.glLinkProgram(programId)
        val status = IntArray(1)
        GLES20.glGetProgramiv(programId, GLES20.GL_LINK_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES20.glGetProgramInfoLog(programId)
            GLES20.glDeleteProgram(programId)
            programId = 0
            error("Cartridge program link failed: $log")
        }
        // Shader objects are retained by the linked program; the handles are no longer needed.
        GLES20.glDeleteShader(vertexShader)
        GLES20.glDeleteShader(fragmentShader)

        attributePosition = GLES20.glGetAttribLocation(programId, "aPosition")
        attributeNormal = GLES20.glGetAttribLocation(programId, "aNormal")
        attributeUv = GLES20.glGetAttribLocation(programId, "aUv")
        uniformModel = GLES20.glGetUniformLocation(programId, "uModel")
        uniformViewProjection = GLES20.glGetUniformLocation(programId, "uViewProj")
        uniformColor = GLES20.glGetUniformLocation(programId, "uColor")
        uniformMetal = GLES20.glGetUniformLocation(programId, "uMetal")
        uniformRough = GLES20.glGetUniformLocation(programId, "uRough")
        uniformTextured = GLES20.glGetUniformLocation(programId, "uTextured")
        uniformTexture = GLES20.glGetUniformLocation(programId, "uTexture")
        uniformCamera = GLES20.glGetUniformLocation(programId, "uCamera")
    }

    fun use() = GLES20.glUseProgram(programId)

    fun setCamera(viewProjection: FloatArray, cameraPosition: FloatArray) {
        GLES20.glUniformMatrix4fv(uniformViewProjection, 1, false, viewProjection, 0)
        GLES20.glUniform3fv(uniformCamera, 1, cameraPosition, 0)
        GLES20.glUniform1i(uniformTexture, 0)
    }

    fun draw(group: GpuGroup, modelMatrix: FloatArray, textureId: Int?) {
        GLES20.glUniformMatrix4fv(uniformModel, 1, false, modelMatrix, 0)
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, group.bufferId)

        GLES20.glEnableVertexAttribArray(attributePosition)
        GLES20.glVertexAttribPointer(attributePosition, 3, GLES20.GL_FLOAT, false, STRIDE_BYTES, 0)
        GLES20.glEnableVertexAttribArray(attributeNormal)
        GLES20.glVertexAttribPointer(attributeNormal, 3, GLES20.GL_FLOAT, false, STRIDE_BYTES, 3 * 4)
        GLES20.glEnableVertexAttribArray(attributeUv)
        GLES20.glVertexAttribPointer(attributeUv, 2, GLES20.GL_FLOAT, false, STRIDE_BYTES, 6 * 4)

        val textured = group.material == CartridgeModel.MATERIAL_BOXART && textureId != null
        GLES20.glUniform1i(uniformTextured, if (textured) 1 else 0)
        GLES20.glUniform3fv(uniformColor, 1, group.color, 0)
        GLES20.glUniform1f(uniformMetal, group.metalness)
        GLES20.glUniform1f(uniformRough, group.roughness)
        if (textured) {
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId!!)
        }
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, group.vertexCount)
    }

    fun release() {
        if (programId != 0) {
            GLES20.glDeleteProgram(programId)
            programId = 0
        }
    }

    private fun compileShader(type: Int, source: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, source)
        GLES20.glCompileShader(shader)
        val status = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES20.glGetShaderInfoLog(shader)
            GLES20.glDeleteShader(shader)
            error("Shader compile failed: $log")
        }
        return shader
    }

    companion object {
        const val STRIDE_BYTES = CartridgeModel.VERTEX_STRIDE_FLOATS * 4

        private val VERTEX_SOURCE = """
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec2 aUv;
            uniform mat4 uModel;
            uniform mat4 uViewProj;
            varying vec3 vNormal;
            varying vec3 vWorld;
            varying vec2 vUv;
            void main() {
                vec4 world = uModel * vec4(aPosition, 1.0);
                vWorld = world.xyz;
                vNormal = normalize(mat3(uModel) * aNormal);
                vUv = aUv;
                gl_Position = uViewProj * world;
            }
        """.trimIndent()

        private val FRAGMENT_SOURCE = """
            precision mediump float;
            varying vec3 vNormal;
            varying vec3 vWorld;
            varying vec2 vUv;
            uniform vec3 uColor;
            uniform float uMetal;
            uniform float uRough;
            uniform bool uTextured;
            uniform sampler2D uTexture;
            uniform vec3 uCamera;
            void main() {
                vec3 base = uTextured ? texture2D(uTexture, vUv).rgb : uColor;
                vec3 n = normalize(vNormal);
                vec3 v = normalize(uCamera - vWorld);
                // Normals are read as two-sided (abs) because the model is drawn without face
                // culling; without this, interior shell faces render black.
                float nv = abs(dot(n, v));
                vec3 keyDir = normalize(vec3(0.34, 0.58, 0.74));
                vec3 fillDir = normalize(vec3(-0.44, 0.30, 0.84));
                float key = abs(dot(n, keyDir));
                float fill = abs(dot(n, fillDir));
                float top = abs(n.y);
                float side = abs(n.x);
                vec3 h = normalize(keyDir + v);
                float spec = pow(abs(dot(n, h)), mix(68.0, 18.0, uRough)) * mix(0.04, 0.16, uMetal);
                float rim = pow(1.0 - nv, 2.0) * (0.035 + side * 0.035);
                vec3 col;
                if (uTextured) {
                    // Box art is shaded almost flat so the printed artwork stays readable.
                    float light = 0.86 + key * 0.11 + fill * 0.06 + nv * 0.05;
                    col = base * light;
                } else {
                    float light = 0.62 + key * 0.22 + fill * 0.13 + nv * 0.08 + top * 0.05;
                    col = base * light + vec3(1.0, 0.92, 0.82) * spec + vec3(0.20, 0.32, 0.54) * rim;
                }
                // Floor the result so unlit faces keep their material identity instead of crushing.
                col = max(col, base * 0.42);
                col = clamp(col, 0.0, 1.0);
                gl_FragColor = vec4(pow(col, vec3(0.94)), 1.0);
            }
        """.trimIndent()
    }
}

/** One uploaded vertex buffer with the material parameters it is drawn with. */
internal class GpuGroup(
    val role: String,
    val material: String,
    val color: FloatArray,
    val metalness: Float,
    val roughness: Float,
    val bufferId: Int,
    val vertexCount: Int,
)

/** Uploads every group of [model], optionally restricted to a single [role]. */
internal fun uploadModel(model: CartridgeModel, role: String? = null): List<GpuGroup> {
    val groups = mutableListOf<GpuGroup>()
    for (mesh in model.meshes) {
        if (role != null && mesh.role != role) continue
        for (group in mesh.groups) {
            if (group.vertices.isEmpty()) continue
            val buffer = ByteBuffer.allocateDirect(group.vertices.size * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()
                .apply {
                    // One bulk copy rather than a put() per float.
                    put(group.vertices)
                    position(0)
                }
            val handles = IntArray(1)
            GLES20.glGenBuffers(1, handles, 0)
            GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, handles[0])
            GLES20.glBufferData(
                GLES20.GL_ARRAY_BUFFER,
                group.vertices.size * 4,
                buffer,
                GLES20.GL_STATIC_DRAW,
            )
            groups += GpuGroup(
                role = mesh.role,
                material = group.material,
                color = materialColor(group.material, group.color),
                metalness = group.metalness,
                roughness = group.roughness,
                bufferId = handles[0],
                vertexCount = group.vertices.size / CartridgeModel.VERTEX_STRIDE_FLOATS,
            )
        }
    }
    return groups
}

internal fun releaseGroups(groups: List<GpuGroup>) {
    if (groups.isEmpty()) return
    val handles = groups.map { it.bufferId }.toIntArray()
    GLES20.glDeleteBuffers(handles.size, handles, 0)
}

/** Uploads [bitmap] as the box-art texture, returning the new texture handle. */
internal fun uploadTexture(bitmap: Bitmap): Int {
    val handles = IntArray(1)
    GLES20.glGenTextures(1, handles, 0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, handles[0])
    // Covers are drawn at roughly their own size and never tiled, so linear filtering with
    // clamped edges is enough and avoids needing power-of-two mipmaps.
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
    return handles[0]
}

internal fun releaseTexture(textureId: Int) {
    if (textureId != 0) GLES20.glDeleteTextures(1, intArrayOf(textureId), 0)
}
