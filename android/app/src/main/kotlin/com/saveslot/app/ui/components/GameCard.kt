package com.saveslot.app.ui.components

import android.os.SystemClock
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.saveslot.app.core.log.ImageLog
import com.saveslot.app.domain.model.Game
import com.saveslot.app.ui.theme.LocalSaveSlotColors

/** How the artwork for one card is currently doing. */
sealed interface CardArtwork {
    /** Nothing found yet; the artwork chain is still working. */
    data object Searching : CardArtwork

    /** Artwork the providers validated for this exact release. */
    data class Verified(val url: String) : CardArtwork

    /** An unvalidated entity image, shown while a better one is still being looked for. */
    data class Provisional(val url: String) : CardArtwork

    /** Every source came up empty. */
    data object Missing : CardArtwork
}

fun Game.cardArtwork(): CardArtwork {
    verifiedCover?.let { return CardArtwork.Verified(it) }
    provisionalCover?.let { return CardArtwork.Provisional(it) }
    return if (mediaFor().boxArtResolved) CardArtwork.Missing else CardArtwork.Searching
}

/**
 * A game as a 3D cartridge with its title beneath.
 *
 * The cartridge is a bitmap produced once per cover by the off-screen renderer, so a long rail
 * scrolls as cheaply as a list of photos. Until that render finishes the cover art is shown flat,
 * which keeps the card useful rather than blank.
 */
@Composable
fun GameCard(
    game: Game,
    artwork: CardArtwork,
    onClick: () -> Unit,
    cartridgePreview: suspend (String) -> androidx.compose.ui.graphics.ImageBitmap?,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val extraColors = LocalSaveSlotColors.current
    val coverUrl = when (artwork) {
        is CardArtwork.Verified -> artwork.url
        is CardArtwork.Provisional -> artwork.url
        else -> null
    }
    val previewKey = coverUrl ?: FALLBACK_PREVIEW_KEY

    // Rendering the cartridge is asynchronous and cache-backed; a cache hit resolves immediately.
    val preview by produceState<androidx.compose.ui.graphics.ImageBitmap?>(
        initialValue = null,
        key1 = previewKey,
    ) {
        val startedAt = SystemClock.elapsedRealtime()
        ImageLog.d(ImageLog.TAG_CARD) {
            "want   '${game.title}' artwork=${artwork.javaClass.simpleName} key=${ImageLog.key(previewKey)}"
        }
        value = cartridgePreview(previewKey)
        ImageLog.d(ImageLog.TAG_CARD) {
            val outcome = if (value == null) "no cartridge" else "cartridge"
            "got    '${game.title}' $outcome in ${SystemClock.elapsedRealtime() - startedAt}ms"
        }
    }

    val fallback = rememberFallbackCover()

    // What the card has on screen right now. Logged on every change, because "the artwork appeared
    // and then went away" is this value moving from cartridge or flatCover back to fallback — and
    // the reason is whichever stage logged just before it.
    val shown = when {
        preview != null -> "cartridge"
        coverUrl != null -> "flatCover"
        fallback != null -> "fallback"
        else -> "blank"
    }
    LaunchedEffect(shown, previewKey) {
        ImageLog.d(ImageLog.TAG_CARD) {
            "shows  '${game.title}' $shown artwork=${artwork.javaClass.simpleName} " +
                "key=${ImageLog.key(previewKey)}"
        }
    }

    // A card leaving composition abandons its preview request and starts over on the way back, so
    // this line marks where any repeated work below it comes from.
    DisposableEffect(previewKey) {
        onDispose { ImageLog.d(ImageLog.TAG_CARD) { "gone   '${game.title}' key=${ImageLog.key(previewKey)}" } }
    }

    Column(
        modifier = modifier
            .width(if (compact) 118.dp else 152.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(CARD_ASPECT_RATIO)
                .clip(RoundedCornerShape(10.dp))
                .background(extraColors.plastic)
                .clearAndSetSemantics {
                    contentDescription = "Обкладинка ${game.title}"
                },
            contentAlignment = Alignment.Center,
        ) {
            Crossfade(targetState = preview, label = "cartridgePreview") { rendered ->
                when {
                    rendered != null -> androidx.compose.foundation.Image(
                        bitmap = rendered,
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        // Sits low in the frame rather than centred, so the cartridge reads as
                        // resting in the card instead of floating in the middle of it.
                        modifier = Modifier
                            .fillMaxSize()
                            .offset(y = CARTRIDGE_DROP),
                    )
                    coverUrl != null -> AsyncImage(
                        model = coverUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    // Null only for the frame or two before the placeholder finishes rasterising
                    // off-thread; the plastic backing shows through in the meantime.
                    fallback != null -> androidx.compose.foundation.Image(
                        bitmap = fallback,
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }

            if (artwork is CardArtwork.Searching) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }

        Text(
            text = game.title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = buildString {
                append(game.year?.toString() ?: "Рік невідомий")
                game.genres.firstOrNull()?.let { append(" · $it") }
            },
            style = MaterialTheme.typography.bodySmall,
            color = extraColors.muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (artwork is CardArtwork.Missing || artwork is CardArtwork.Provisional) {
            Text(
                text = if (artwork is CardArtwork.Missing) "Немає обкладинки" else "Резервне зображення",
                style = MaterialTheme.typography.labelSmall,
                color = extraColors.muted,
                textAlign = TextAlign.Start,
                maxLines = 1,
            )
        }
    }
}

/** How far down the card the rendered cartridge sits. */
private val CARTRIDGE_DROP = 0.dp

/** Cartridge proportions, matching the model's label face. */
internal const val CARD_ASPECT_RATIO = 0.77f

/** Cache key for the cartridge rendered with the placeholder label. */
internal const val FALLBACK_PREVIEW_KEY = "__save_slot_fallback__"
