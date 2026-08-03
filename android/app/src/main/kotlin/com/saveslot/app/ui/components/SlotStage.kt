package com.saveslot.app.ui.components

import android.graphics.Bitmap
import android.opengl.GLSurfaceView
import android.view.MotionEvent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.saveslot.app.render.CartridgeModel
import com.saveslot.app.render.SlotCommand
import com.saveslot.app.render.SlotSceneRenderer
import com.saveslot.app.ui.theme.ConsoleBackground
import com.saveslot.app.ui.theme.ConsolePanel

/** What the slot should currently be showing, as far as the UI is concerned. */
data class SlotStageState(
    val model: CartridgeModel? = null,
    val cover: Bitmap? = null,
    val loadedGameTitle: String? = null,
    val reducedMotion: Boolean = false,
)

/**
 * The console face at the top of the app: a 3D slot that a cartridge slides into.
 *
 * Rendering is on demand — the surface only redraws while something is animating — and the GL
 * surface is paused with the lifecycle so a backgrounded app costs nothing.
 */
@Composable
fun SlotStage(
    state: SlotStageState,
    onEjectRequested: () -> Unit,
    onInsertComplete: () -> Unit,
    onEjectComplete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val surfaceRef = remember { SlotSurfaceHolder() }

    val renderer = remember {
        SlotSceneRenderer(
            onRequestRender = { surfaceRef.view?.requestRender() },
            onInsertComplete = onInsertComplete,
            onEjectComplete = onEjectComplete,
        )
    }

    // The model arrives asynchronously; hand it over as soon as it is parsed.
    LaunchedEffect(state.model) {
        state.model?.let { renderer.setModel(it) }
    }

    // A game becoming loaded or unloaded drives the insert/eject animation.
    LaunchedEffect(state.loadedGameTitle) {
        val title = state.loadedGameTitle
        if (title != null) {
            renderer.enqueue(
                SlotCommand.Insert(cover = state.cover, reducedMotion = state.reducedMotion),
            )
        } else {
            renderer.enqueue(SlotCommand.Eject(reducedMotion = state.reducedMotion))
        }
        surfaceRef.view?.requestRender()
    }

    // Better artwork often resolves after the game opened, and switching platform changes the
    // cover outright. Both only swap the label — replaying the insert would look like a glitch.
    LaunchedEffect(state.cover) {
        if (state.loadedGameTitle != null) {
            renderer.enqueue(SlotCommand.SetCover(state.cover))
            surfaceRef.view?.requestRender()
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> surfaceRef.view?.onResume()
                Lifecycle.Event.ON_PAUSE -> surfaceRef.view?.onPause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val emptyGlow by animateFloatAsState(
        targetValue = if (state.loadedGameTitle == null) 0.55f else 1f,
        animationSpec = tween(durationMillis = if (state.reducedMotion) 0 else 420),
        label = "slotGlow",
    )

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(268.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.verticalGradient(
                    listOf(ConsolePanel, ConsoleBackground),
                ),
            )
            .semantics {
                contentDescription = state.loadedGameTitle
                    ?.let { "Картридж у слоті: $it. Торкнись, щоб витягнути." }
                    ?: "Слот порожній"
            },
    ) {
        AndroidView(
            factory = { context ->
                GLSurfaceView(context).apply {
                    setEGLContextClientVersion(2)
                    // Translucent so the console shell behind the slot shows through.
                    setEGLConfigChooser(8, 8, 8, 8, 16, 0)
                    holder.setFormat(android.graphics.PixelFormat.TRANSLUCENT)
                    setZOrderOnTop(true)
                    setRenderer(renderer)
                    renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
                    // Recreating GL resources on every pause is cheaper here than holding a
                    // context for a screen the user often navigates away from.
                    preserveEGLContextOnPause = true
                    setOnTouchListener { view, event -> handleTouch(view, event, renderer, onEjectRequested) }
                    surfaceRef.view = this
                }
            },
            onRelease = {
                surfaceRef.view = null
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Glass reflection over the slot, fading in when the slot is empty.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color.White.copy(alpha = 0.05f * emptyGlow),
                        0.45f to Color.Transparent,
                        1f to Color.Black.copy(alpha = 0.18f),
                    ),
                ),
        )
    }
}

/** Mutable handle so callbacks can reach the surface without recomposing on every frame. */
private class SlotSurfaceHolder {
    var view: GLSurfaceView? = null
}

/**
 * Drag tilts the scene; a tap with no meaningful movement ejects the cartridge.
 *
 * Distinguishing the two by total travel keeps a slightly imprecise tap from being swallowed as a
 * drag, which on a stage this small happens constantly.
 */
private fun handleTouch(
    view: android.view.View,
    event: MotionEvent,
    renderer: SlotSceneRenderer,
    onEjectRequested: () -> Unit,
): Boolean {
    when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
            view.setTag(R_TAG_START_X, event.x)
            view.setTag(R_TAG_START_Y, event.y)
            return true
        }
        MotionEvent.ACTION_MOVE -> {
            val startX = view.getTag(R_TAG_START_X) as? Float ?: return false
            val startY = view.getTag(R_TAG_START_Y) as? Float ?: return false
            renderer.setTiltTarget(
                x = (event.y - startY) / TILT_DIVISOR_Y,
                y = (event.x - startX) / TILT_DIVISOR_X,
            )
            return true
        }
        MotionEvent.ACTION_UP -> {
            val startX = view.getTag(R_TAG_START_X) as? Float
            val startY = view.getTag(R_TAG_START_Y) as? Float
            renderer.setTiltTarget(0f, 0f)
            if (startX != null && startY != null) {
                val travel = kotlin.math.hypot(event.x - startX, event.y - startY)
                if (travel < TAP_SLOP_PX && renderer.hasCartridge) onEjectRequested()
            }
            return true
        }
        MotionEvent.ACTION_CANCEL -> {
            renderer.setTiltTarget(0f, 0f)
            return true
        }
    }
    return false
}

/** View tag ids for the touch origin; arbitrary but stable and collision-free. */
private const val R_TAG_START_X = 0x53_4C_00_01
private const val R_TAG_START_Y = 0x53_4C_00_02

private const val TILT_DIVISOR_X = 380f
private const val TILT_DIVISOR_Y = 500f
private const val TAP_SLOP_PX = 24f
