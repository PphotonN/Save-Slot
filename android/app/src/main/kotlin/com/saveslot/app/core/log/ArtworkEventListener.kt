package com.saveslot.app.core.log

import coil3.EventListener
import coil3.request.ErrorResult
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.size.Size

/**
 * Traces every Coil request the app makes.
 *
 * Attached loader-wide rather than per call site, so `AsyncImage` in the cards, the detail hero, and
 * the explicit `execute` calls behind the GL renderer all report through one place.
 *
 * The two lines worth watching:
 *
 *  - `cancel` — the request was dropped before it produced anything, which is what a card scrolling
 *    out of composition looks like. A cancel immediately followed by a fresh `start` for the same
 *    key means the work is being redone, not reused.
 *  - `ok … from=NETWORK` for a cover that already loaded once — the memory cache missed. Compare the
 *    `size=` on the two requests: Coil includes the resolved size in the memory cache key, so the
 *    same URL requested at two different sizes is two different entries.
 */
class ArtworkEventListener : EventListener() {

    override fun onStart(request: ImageRequest) {
        ImageLog.d(ImageLog.TAG_COIL) { "start   ${ImageLog.key(request.data)}" }
    }

    override fun resolveSizeEnd(request: ImageRequest, size: Size) {
        ImageLog.d(ImageLog.TAG_COIL) { "size    ${ImageLog.key(request.data)} size=$size" }
    }

    override fun onSuccess(request: ImageRequest, result: SuccessResult) {
        ImageLog.d(ImageLog.TAG_COIL) {
            val image = result.image
            "ok      ${ImageLog.key(request.data)} from=${result.dataSource} " +
                "${image.width}x${image.height} sampled=${result.isSampled}"
        }
    }

    override fun onCancel(request: ImageRequest) {
        ImageLog.d(ImageLog.TAG_COIL) { "cancel  ${ImageLog.key(request.data)}" }
    }

    override fun onError(request: ImageRequest, result: ErrorResult) {
        ImageLog.w(ImageLog.TAG_COIL) {
            "fail    ${ImageLog.key(request.data)} ${result.throwable::class.java.simpleName}: " +
                "${result.throwable.message}"
        }
    }
}
