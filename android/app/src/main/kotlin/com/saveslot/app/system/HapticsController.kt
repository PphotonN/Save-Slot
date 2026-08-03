package com.saveslot.app.system

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * The tactile half of the slot: a double click as a cartridge seats, a single one as it ejects.
 *
 * The original build had to go through a JavaScript bridge for this. Native code can address the
 * vibrator directly, so the app uses composition primitives where the hardware supports them —
 * `CLICK` then `TICK` reads as a mechanical catch engaging, which a flat buzz does not — and steps
 * down to waveforms and then a plain duration on older or simpler devices.
 */
class HapticsController(context: Context) {

    private val vibrator: Vibrator? = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(VibratorManager::class.java)
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
    }.getOrNull()

    private val supportsComposition: Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
            vibrator?.areAllPrimitivesSupported(
                VibrationEffect.Composition.PRIMITIVE_CLICK,
                VibrationEffect.Composition.PRIMITIVE_TICK,
            ) == true

    val hasVibrator: Boolean get() = vibrator?.hasVibrator() == true

    /** Cartridge seating: a firm click, then a lighter one as it bottoms out. */
    fun insert(enabled: Boolean) {
        if (!enabled) return
        when {
            supportsComposition -> playComposition {
                addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.85f, 0)
                addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.55f, 45)
            }
            else -> playWaveform(timings = longArrayOf(0, 11, 38, 18), amplitudes = intArrayOf(0, 200, 0, 150))
        }
    }

    /** Cartridge release: one short click. */
    fun eject(enabled: Boolean) {
        if (!enabled) return
        when {
            supportsComposition -> playComposition {
                addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.6f, 0)
            }
            else -> playWaveform(timings = longArrayOf(0, 13), amplitudes = intArrayOf(0, 170))
        }
    }

    /** Light confirmation for ordinary taps. */
    fun tap(enabled: Boolean) {
        if (!enabled) return
        when {
            supportsComposition -> playComposition {
                addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.4f, 0)
            }
            else -> playWaveform(timings = longArrayOf(0, 10), amplitudes = intArrayOf(0, 120))
        }
    }

    private inline fun playComposition(build: VibrationEffect.Composition.() -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        runCatching {
            val composition = VibrationEffect.startComposition().apply(build).compose()
            vibrate(composition)
        }
    }

    private fun playWaveform(timings: LongArray, amplitudes: IntArray) {
        runCatching {
            val effect = if (vibrator?.hasAmplitudeControl() == true) {
                VibrationEffect.createWaveform(timings, amplitudes, NO_REPEAT)
            } else {
                VibrationEffect.createWaveform(timings, NO_REPEAT)
            }
            vibrate(effect)
        }
    }

    private fun vibrate(effect: VibrationEffect) {
        val device = vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            device.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            device.vibrate(effect)
        }
    }

    private companion object {
        const val NO_REPEAT = -1
    }
}
