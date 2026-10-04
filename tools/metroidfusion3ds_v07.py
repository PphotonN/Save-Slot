#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / 'src/platform/3ds/main.c'
text = main.read_text(encoding='utf-8')

# Ensure direct VFS helpers are available for the secondary ROM core.
inc = '#include <mgba-util/memory.h>\n'
if '#include <mgba-util/vfs.h>\n' not in text:
    if inc not in text:
        raise SystemExit('memory include anchor missing')
    text = text.replace(inc, inc + '#include <mgba-util/vfs.h>\n', 1)

# Secondary core state: it renders the real Fusion pause/map screen off-screen.
ganchor = 'static int mfMapViewY = 0;\n'
ginsert = r'''

/* v0.7: exact live pause-map mirror.
 * A second GBA core receives a copy of the current gameplay state, opens the
 * game's real pause/map screen and renders it into a private 240x160 buffer.
 * The primary core never pauses, so gameplay continues on the upper screen. */
static struct mCore* mfPauseCore = NULL;
static mColor* mfPauseFrameBuffer = NULL;
static void* mfPauseState = NULL;
static size_t mfPauseStateSize = 0;
static bool mfPauseCoreReady = false;
static bool mfPauseSnapshotValid = false;
static int mfPauseLastX = -1;
static int mfPauseLastY = -1;
static int mfPauseLastArea = -1;
static int mfPauseLastSecurity = -1;
static int mfPauseLastDownloadedMaps = -1;
static unsigned mfPauseSnapshotAge = 9999;

#define MF_CURRENT_AREA 0x0300002C
#define MF_EQUIPMENT_SECURITY 0x0300131D
#define MF_EQUIPMENT_DOWNLOADED_MAPS 0x0300131E
'''
if ganchor not in text:
    raise SystemExit('v0.6 globals anchor missing')
text = text.replace(ganchor, ganchor + ginsert, 1)

# Inject exact pause-map mirror helpers before the old live-map draw function.
anchor = 'static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {'
pos = text.find(anchor)
if pos < 0:
    raise SystemExit('live map function anchor missing')
end = text.find('\n}\n', pos)
if end < 0:
    raise SystemExit('live map function end missing')
end += 3

helpers = r'''static void _mfDestroyPauseCore(void) {
	if (mfPauseCore) {
		mfPauseCore->deinit(mfPauseCore);
		mfPauseCore = NULL;
	}
	if (mfPauseFrameBuffer) {
		linearFree(mfPauseFrameBuffer);
		mfPauseFrameBuffer = NULL;
	}
	if (mfPauseState) {
		linearFree(mfPauseState);
		mfPauseState = NULL;
	}
	mfPauseStateSize = 0;
	mfPauseCoreReady = false;
	mfPauseSnapshotValid = false;
	mfPauseLastX = -1;
	mfPauseLastY = -1;
	mfPauseLastArea = -1;
	mfPauseLastSecurity = -1;
	mfPauseLastDownloadedMaps = -1;
	mfPauseSnapshotAge = 9999;
}

static bool _mfInitPauseCore(struct mGUIRunner* runner) {
	if (mfPauseCoreReady) {
		return true;
	}
	if (!runner || !runner->core || runner->core->platform(runner->core) != mPLATFORM_GBA) {
		return false;
	}

	mfPauseCore = mCoreCreate(mPLATFORM_GBA);
	if (!mfPauseCore || !mfPauseCore->init(mfPauseCore)) {
		_mfDestroyPauseCore();
		return false;
	}

	/* The forwarder keeps RomFS mounted for the lifetime of the app. Load the
	 * same embedded ROM into the helper core, but never attach save/audio I/O. */
	if (!mCoreLoadFile(mfPauseCore, "romfs:/MetroidFusionUA.gba")) {
		_mfDestroyPauseCore();
		return false;
	}

	mfPauseFrameBuffer = linearMemAlign(256 * 224 * sizeof(mColor), 0x80);
	if (!mfPauseFrameBuffer) {
		_mfDestroyPauseCore();
		return false;
	}
	memset(mfPauseFrameBuffer, 0, 256 * 224 * sizeof(mColor));
	mfPauseCore->setVideoBuffer(mfPauseCore, mfPauseFrameBuffer, 256);

	mfPauseStateSize = runner->core->stateSize(runner->core);
	if (!mfPauseStateSize) {
		_mfDestroyPauseCore();
		return false;
	}
	mfPauseState = linearMemAlign(mfPauseStateSize, 0x80);
	if (!mfPauseState) {
		_mfDestroyPauseCore();
		return false;
	}

	mfPauseCoreReady = true;
	return true;
}

static bool _mfRefreshExactPauseMap(struct mGUIRunner* runner, bool force) {
	if (!_mfInitPauseCore(runner)) {
		return false;
	}

	int mapX = runner->core->rawRead8(runner->core, MF_MINIMAP_X, -1);
	int mapY = runner->core->rawRead8(runner->core, MF_MINIMAP_Y, -1);
	int area = runner->core->rawRead8(runner->core, MF_CURRENT_AREA, -1);
	int security = runner->core->rawRead8(runner->core, MF_EQUIPMENT_SECURITY, -1);
	int downloadedMaps = runner->core->rawRead8(runner->core, MF_EQUIPMENT_DOWNLOADED_MAPS, -1);
	++mfPauseSnapshotAge;

	bool changed = mapX != mfPauseLastX || mapY != mfPauseLastY ||
			area != mfPauseLastArea || security != mfPauseLastSecurity ||
			downloadedMaps != mfPauseLastDownloadedMaps;
	if (!force && !changed && mfPauseSnapshotValid && mfPauseSnapshotAge < 60) {
		return true;
	}

	if (!runner->core->saveState(runner->core, mfPauseState)) {
		return mfPauseSnapshotValid;
	}
	if (!mfPauseCore->loadState(mfPauseCore, mfPauseState)) {
		return mfPauseSnapshotValid;
	}
	mfPauseCore->setVideoBuffer(mfPauseCore, mfPauseFrameBuffer, 256);

	/* Generate an actual START edge inside the cloned state. Fusion itself then
	 * performs its normal fade/initialization and draws the localized map UI. */
	mfPauseCore->setKeys(mfPauseCore, 1u << GBA_KEY_START);
	mfPauseCore->runFrame(mfPauseCore);
	mfPauseCore->setKeys(mfPauseCore, 0);

	int stableMapFrames = 0;
	for (int i = 0; i < 48; ++i) {
		mfPauseCore->runFrame(mfPauseCore);
		int mode = (s16)mfPauseCore->rawRead16(mfPauseCore, MF_MAIN_GAME_MODE, -1);
		if (mode == MF_MODE_MAP_SCREEN) {
			++stableMapFrames;
			/* A few frames after entering map mode are needed for the complete
			 * header/OAM/text composition visible in the normal pause screen. */
			if (stableMapFrames >= 8) {
				break;
			}
		} else {
			stableMapFrames = 0;
		}
	}
	if (stableMapFrames < 1) {
		return mfPauseSnapshotValid;
	}

	GSPGPU_FlushDataCache(mfPauseFrameBuffer, 256 * GBA_VIDEO_VERTICAL_PIXELS * sizeof(mColor));
	C3D_SyncDisplayTransfer(
			(u32*)mfPauseFrameBuffer, GX_BUFFER_DIM(256, GBA_VIDEO_VERTICAL_PIXELS),
			mfMapTexture.data, GX_BUFFER_DIM(256, 256),
			GX_TRANSFER_IN_FORMAT(GX_TRANSFER_FMT_RGB565) |
				GX_TRANSFER_OUT_FORMAT(GX_TRANSFER_FMT_RGB565) |
				GX_TRANSFER_OUT_TILED(1) | GX_TRANSFER_FLIP_VERT(1));

	mfPauseSnapshotValid = true;
	mfMapValid = true;
	mfPauseLastX = mapX;
	mfPauseLastY = mapY;
	mfPauseLastArea = area;
	mfPauseLastSecurity = security;
	mfPauseLastDownloadedMaps = downloadedMaps;
	mfPauseSnapshotAge = 0;
	return true;
}

static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {
	bool force = !mfPauseSnapshotValid;
	if (!_mfRefreshExactPauseMap(runner, force)) {
		/* Startup/transitions where Fusion refuses pause: retain the v0.6 live
		 * renderer as a temporary fallback rather than leaving the screen blank. */
		bool wasValid = mfMapValid;
		_mfUpdateMapTexture(runner, !wasValid);
		if (!mfMapValid) {
			_mfDrawBottomFull(fallback);
			return;
		}
	}

	/* This texture is a literal 240x160 frame generated by Fusion's own
	 * pause-map renderer, so the lower screen gets the complete localized UI. */
	_mfDrawTexture(&mfMapTexture, bottomScreen, 320, 240,
			0, 0, 240, 160,
			0, 0, 320, 240);
}
'''
text = text[:pos] + helpers + text[end:]

# Tear down the helper core when the game is unloaded, before the main core disappears.
unload_anchor = 'static void _gameUnloaded(struct mGUIRunner* runner) {\n'
if unload_anchor not in text:
    raise SystemExit('gameUnloaded anchor missing')
text = text.replace(unload_anchor, unload_anchor + '#ifdef M_CORE_GBA\n\t_mfDestroyPauseCore();\n#endif\n', 1)

# Force standard 400x240 top framebuffer. Wide mode is unnecessary for a GBA
# image and was the remaining source of emulator-dependent horizontal stretch.
old_wide = '''\tu8 model = 0;
\tcfguInit();
\tCFGU_GetSystemModel(&model);
\tif (model != CFG_MODEL_2DS) {
\t\tgfxSetWide(true);
\t}
\tcfguExit();
'''
new_wide = '''\t/* Fusion is 240x160 (3:2). Keep the physical top framebuffer at the
\t * standard 400x240 size on every 3DS model; draw 360x240 centered. */
\tgfxSetWide(false);
'''
if old_wide not in text:
    raise SystemExit('wide-mode initialization block missing')
text = text.replace(old_wide, new_wide, 1)

main.write_text(text, encoding='utf-8')
print(f'Applied v0.7 exact pause-map mirror + fixed 400x240 top mode to {main}')
