package com.saveslot.app.render

import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/**
 * Column-major 4x4 matrix helpers, matching the layout `glUniformMatrix4fv` expects.
 *
 * `android.opengl.Matrix` covers most of this, but these are allocation-light and keep the render
 * path readable: the scene is a handful of transforms per frame, composed as plain expressions.
 */
internal object Mat4 {

    fun identity(): FloatArray = floatArrayOf(
        1f, 0f, 0f, 0f,
        0f, 1f, 0f, 0f,
        0f, 0f, 1f, 0f,
        0f, 0f, 0f, 1f,
    )

    fun multiply(a: FloatArray, b: FloatArray, out: FloatArray = FloatArray(16)): FloatArray {
        for (column in 0 until 4) {
            for (row in 0 until 4) {
                var sum = 0f
                for (k in 0 until 4) sum += a[k * 4 + row] * b[column * 4 + k]
                out[column * 4 + row] = sum
            }
        }
        return out
    }

    fun translate(x: Float, y: Float, z: Float): FloatArray = floatArrayOf(
        1f, 0f, 0f, 0f,
        0f, 1f, 0f, 0f,
        0f, 0f, 1f, 0f,
        x, y, z, 1f,
    )

    fun scale(s: Float): FloatArray = floatArrayOf(
        s, 0f, 0f, 0f,
        0f, s, 0f, 0f,
        0f, 0f, s, 0f,
        0f, 0f, 0f, 1f,
    )

    fun rotateX(angle: Float): FloatArray {
        val c = cos(angle)
        val s = sin(angle)
        return floatArrayOf(
            1f, 0f, 0f, 0f,
            0f, c, s, 0f,
            0f, -s, c, 0f,
            0f, 0f, 0f, 1f,
        )
    }

    fun rotateY(angle: Float): FloatArray {
        val c = cos(angle)
        val s = sin(angle)
        return floatArrayOf(
            c, 0f, -s, 0f,
            0f, 1f, 0f, 0f,
            s, 0f, c, 0f,
            0f, 0f, 0f, 1f,
        )
    }

    fun perspective(fovYRadians: Float, aspect: Float, near: Float, far: Float): FloatArray {
        val f = 1f / tan(fovYRadians / 2f)
        val nf = 1f / (near - far)
        return floatArrayOf(
            f / aspect, 0f, 0f, 0f,
            0f, f, 0f, 0f,
            0f, 0f, (far + near) * nf, -1f,
            0f, 0f, 2f * far * near * nf, 0f,
        )
    }

    fun lookAt(eye: FloatArray, center: FloatArray, up: FloatArray): FloatArray {
        val z = normalize(subtract(eye, center))
        val x = normalize(cross(up, z))
        val y = cross(z, x)
        return floatArrayOf(
            x[0], y[0], z[0], 0f,
            x[1], y[1], z[1], 0f,
            x[2], y[2], z[2], 0f,
            -dot(x, eye), -dot(y, eye), -dot(z, eye), 1f,
        )
    }

    /**
     * Rotates and scales about [center] rather than the origin, then lifts by [translateY].
     *
     * The exported geometry is not centred on its own origin, so rotating it directly would swing
     * the cartridge through an arc instead of turning it in place.
     */
    fun centeredTransform(
        center: FloatArray,
        translateY: Float,
        rotationX: Float,
        rotationY: Float,
        scale: Float,
    ): FloatArray {
        val pivotIn = translate(-center[0], -center[1], -center[2])
        val rotation = multiply(rotateX(rotationX), multiply(rotateY(rotationY), scale(scale)))
        val pivotOut = translate(center[0], center[1], center[2])
        return multiply(
            translate(0f, translateY, 0f),
            multiply(pivotOut, multiply(rotation, pivotIn)),
        )
    }

    private fun subtract(a: FloatArray, b: FloatArray) =
        floatArrayOf(a[0] - b[0], a[1] - b[1], a[2] - b[2])

    private fun dot(a: FloatArray, b: FloatArray) = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    private fun cross(a: FloatArray, b: FloatArray) = floatArrayOf(
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )

    private fun normalize(v: FloatArray): FloatArray {
        val length = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
        if (length == 0f) return v
        return floatArrayOf(v[0] / length, v[1] / length, v[2] / length)
    }
}

/** Overshoot-and-settle easing: the cartridge seats with a small mechanical bounce. */
internal fun easeOutBackSoft(t: Float): Float {
    val c = 1.15f
    val p = t - 1f
    return 1f + (c + 1f) * p * p * p + c * p * p
}

internal fun easeInOut(t: Float): Float =
    if (t < 0.5f) 2f * t * t else 1f - (-2f * t + 2f) * (-2f * t + 2f) / 2f
