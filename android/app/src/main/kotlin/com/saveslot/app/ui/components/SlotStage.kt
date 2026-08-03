package com.saveslot.app.ui.components

import android.graphics.Bitmap
import android.opengl.GLSurfaceView
import android.view.MotionEvent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.saveslot.app.render.CartridgeModel
import com.saveslot.app.render.SlotTarget
import com.saveslot.app.render.SlotSceneRenderer
import com.saveslot.app.ui.theme.ConsoleAccent
import com.saveslot.app.ui.theme.ConsoleBackground
import com.saveslot.app.ui.theme.ConsolePanel

/** What the slot should currently be showing, as far as the UI is concerned. */
data class SlotStageState(
    val model: CartridgeModel? = null,
    val cover: Bitmap? = null,
    /** Stable identity of the seated cartridge; null means the slot is empty. */
    val loadedGameId: String? = null,
    val loadedGameTitle: String? = null,
    val reducedMotion: Boolean = false,
)

/**
 * The console face at the top of the app: a 3D slot that a cartridge slides into.
 *
 * Rendering is on demand — the surface only redraws while something is animating — and the GL
 * surface is paused with the lifecycle so a backgrounded app costs nothing.
 *
 * Must be hosted *outside* any scrolling or animating container and instantiated once for the app.
 * A `GLSurfaceView` draws into its own surface, whose position the compositor updates independently
 * of the view hierarchy, so inside a scrolling list it lags its layout slot and appears at the wrong
 * height. One fixed instance also keeps the cartridge seated across navigation instead of building a
 * fresh EGL context — and replaying the insert — per screen.
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

    // One declarative statement of what the slot should show. The renderer decides whether that
    // means animating a new cartridge in or just re-labelling the one already seated, so artwork
    // resolving late never replays the insert and a superseded game never animates at all.
    LaunchedEffect(state.loadedGameId, state.cover, state.reducedMotion) {
        renderer.setTarget(
            SlotTarget(
                cartridgeId = state.loadedGameId,
                cover = state.cover,
                reducedMotion = state.reducedMotion,
            ),
        )
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
            // drawWithCache, not drawBehind: each Brush.radialGradient builds a native Shader, and
            // rebuilding two of them per frame is native allocation churn on the main thread. This
            // rebuilds them only when the stage is resized.
            .drawWithCache {
                val backdrop = slotBackdrop(size)
                onDrawBehind { backdrop() }
            }
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
            // Top padding rather than an offset: it moves the surface's layout bounds down without
            // pushing its bottom edge outside the stage. A SurfaceView is composited from its own
            // buffer and is not clipped by the parent's rounded corners, so anything hanging past
            // the edge would be drawn rather than trimmed.
            modifier = Modifier
                .fillMaxSize()
                .padding(top = SLOT_DROP),
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

        // The empty slot's "NO GAME" plate, as in the web build. Drawn from the Compose layer, so
        // the translucent GL surface composites over it; it reads through wherever the scene is
        // transparent, which when the slot is empty is everything but the slot mouth itself.
        if (state.loadedGameId == null) {
            Text(
                text = "NO GAME",
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.18.em,
                color = ConsoleAccent.copy(alpha = 0.42f * emptyGlow),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxHeight(EMPTY_LABEL_HEIGHT_FRACTION)
                    .wrapContentHeight(Alignment.Bottom),
            )
        }
    }
}

/** Puts the plate at 44% of the stage height, matching the web build's placement. */
private const val EMPTY_LABEL_HEIGHT_FRACTION = 0.44f

/** How far down the stage the slot itself is drawn. */
private val SLOT_DROP = 10.dp

/**
 * The lit recess the slot sits in.
 *
 * A port of the web build's slot backdrop: a warm off-centre key light falling away to near-black,
 * plus a soft bloom above and left of centre. Two radial gradients rather than one, because the
 * bloom is offset from the main light and covers only part of the stage — a single gradient cannot
 * express that, and a plain vertical gradient loses the sense of a light source entirely.
 *
 * Stops and positions come from the CSS, expressed as fractions of the stage so they hold at any
 * size. The GL surface composites on top of this, so it shows through wherever the scene is
 * transparent.
 */
private fun slotBackdrop(size: Size): DrawScope.() -> Unit {
    val width = size.width
    val height = size.height

    // `radial-gradient(circle at 58% 20%, …)` with CSS's default farthest-corner extent.
    val keyCenter = Offset(x = width * 0.58f, y = height * 0.20f)
    val keyRadius = maxOf(
        Offset(0f, 0f).minus(keyCenter).getDistance(),
        Offset(width, 0f).minus(keyCenter).getDistance(),
        Offset(0f, height).minus(keyCenter).getDistance(),
        Offset(width, height).minus(keyCenter).getDistance(),
    )
    val keyBrush = Brush.radialGradient(
        colorStops = arrayOf(
            0.00f to Color(0xFFFFE1BB).copy(alpha = 0.13f),
            0.18f to Color(0xFFFFC684).copy(alpha = 0.06f),
            0.34f to Color(0xFF414F5F).copy(alpha = 0.84f),
            0.58f to Color(0xFF1B242D),
            0.88f to Color(0xFF0C1218),
            1.00f to Color(0xFF0C1218),
        ),
        center = keyCenter,
        radius = keyRadius,
    )

    // The `:before` bloom: an ellipse offset up and left, at 74% opacity in the final CSS pass.
    val bloomLeft = width * 0.37f
    val bloomTop = height * 0.02f
    val bloomWidth = width * 0.51f
    val bloomHeight = height * 0.57f
    val bloomCenter = Offset(
        x = bloomLeft + bloomWidth * 0.57f,
        y = bloomTop + bloomHeight * 0.34f,
    )
    val bloomRadius = maxOf(bloomWidth, bloomHeight) * 0.75f
    val bloomBrush = Brush.radialGradient(
        colorStops = arrayOf(
            0.00f to Color(0xFFFFE8C7).copy(alpha = 0.30f),
            0.20f to Color(0xFFFFC889).copy(alpha = 0.14f),
            0.46f to Color(0xFF80A5E2).copy(alpha = 0.07f),
            0.76f to Color(0xFF273A5C).copy(alpha = 0f),
            1.00f to Color.Transparent,
        ),
        center = bloomCenter,
        radius = bloomRadius,
    )
    val bloomTopLeft = Offset(bloomLeft, bloomTop)
    val bloomSize = Size(bloomWidth, bloomHeight)

    // Both brushes are built once per size and only replayed per frame.
    return {
        drawRect(brush = keyBrush)
        drawOval(brush = bloomBrush, topLeft = bloomTopLeft, size = bloomSize, alpha = 0.74f)
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
