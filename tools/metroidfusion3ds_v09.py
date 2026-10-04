#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / 'src/platform/3ds/main.c'
text = main.read_text(encoding='utf-8')

# Extra mode/state constants and touch state.
needle = '''#define MF_MODE_IN_GAME 1\n#define MF_MODE_MAP_SCREEN 3\n'''
repl = '''#define MF_MODE_TITLE 0\n#define MF_MODE_IN_GAME 1\n#define MF_MODE_MAP_SCREEN 3\n#define MF_MODE_CUTSCENE 4\n#define MF_MODE_ERASE_SRAM_MENU 6\n#define MF_MODE_FILE_SELECT_OR_INTRO 7\n#define MF_MODE_GAME_OVER 8\n#define MF_MODE_ENDING 9\n#define MF_MODE_CREDITS 11\n#define MF_MODE_DEMO 12\n#define MF_SUB_GAME_MODE1 0x03000BE0\n#define MF_SUB_GAME_MODE2 0x03000BE2\n#define MF_PAUSE_DATA_BASE 0x03001484\n#define MF_PAUSE_DATA_MAP_X (MF_PAUSE_DATA_BASE + 0x210)\n#define MF_PAUSE_DATA_MAP_Y (MF_PAUSE_DATA_BASE + 0x211)\n#define MF_PAUSE_DATA_AREA  (MF_PAUSE_DATA_BASE + 0x212)\n'''
if needle not in text:
    raise SystemExit('mode constants block not found')
text = text.replace(needle, repl, 1)

needle = 'static unsigned mfPauseSnapshotAge = 9999;\n'
repl = '''static unsigned mfPauseSnapshotAge = 9999;\nstatic int mfTouchPendingPauseKey = -1;\nstatic int mfTouchPendingDelay = 0;\n'''
if needle not in text:
    raise SystemExit('pause state tail not found')
text = text.replace(needle, repl, 1)

# Replace exact-map refresh with persistent helper map. Full clone only on first map / area change;
# ordinary movement only syncs the data the real pause renderer consumes and advances one frame.
start = text.index('static bool _mfRefreshExactPauseMap(struct mGUIRunner* runner, bool force) {')
end = text.index('\nstatic void _mfDrawLiveMapBottom', start)
new_refresh = r'''static void _mfSyncPauseMapRuntime(struct mGUIRunner* runner, int mapX, int mapY, int area) {
	/* Keep the helper inside Fusion's real pause screen. Only copy gameplay data
	 * that the map/status renderer needs; never overwrite its GAME_MODE_MAP_SCREEN
	 * state. This turns an update into one emulated frame instead of ~50. */
	mfPauseCore->rawWrite8(mfPauseCore, MF_MINIMAP_X, -1, (u8)mapX);
	mfPauseCore->rawWrite8(mfPauseCore, MF_MINIMAP_Y, -1, (u8)mapY);
	mfPauseCore->rawWrite8(mfPauseCore, MF_CURRENT_AREA, -1, (u8)area);
	mfPauseCore->rawWrite8(mfPauseCore, MF_PAUSE_DATA_MAP_X, -1, (u8)mapX);
	mfPauseCore->rawWrite8(mfPauseCore, MF_PAUSE_DATA_MAP_Y, -1, (u8)mapY);
	mfPauseCore->rawWrite8(mfPauseCore, MF_PAUSE_DATA_AREA, -1, (u8)area);

	/* Visited/known map tiles. */
	for (unsigned i = 0; i < 32 * 32; ++i) {
		u32 addr = MF_MINIMAP_TILEMAP + i * 2;
		u16 v = (u16)runner->core->rawRead16(runner->core, addr, -1);
		mfPauseCore->rawWrite16(mfPauseCore, addr, -1, v);
	}

	/* Equipment/status data used by the native status and security displays. */
	for (u32 addr = 0x03001310; addr < 0x03001380; ++addr) {
		u8 v = (u8)runner->core->rawRead8(runner->core, addr, -1);
		mfPauseCore->rawWrite8(mfPauseCore, addr, -1, v);
	}
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
	int subMode = (s16)runner->core->rawRead16(runner->core, MF_SUB_GAME_MODE1, -1);

	/* Do not spend helper-core time during door fades/loading. Keep the last
	 * genuine Fusion map frame until normal gameplay resumes. */
	if (subMode != 2 && mfPauseSnapshotValid && !force) {
		return true;
	}

	bool areaChanged = area != mfPauseLastArea;
	bool changed = mapX != mfPauseLastX || mapY != mfPauseLastY || areaChanged ||
			security != mfPauseLastSecurity || downloadedMaps != mfPauseLastDownloadedMaps;
	if (!force && !changed && mfPauseSnapshotValid) {
		return true;
	}

	if (!mfPauseSnapshotValid || areaChanged || force) {
		/* Expensive operation, but only once when a real pause-map for an area is
		 * first needed. Clone the state and let Fusion initialize its own UI. */
		if (!runner->core->saveState(runner->core, mfPauseState)) {
			return mfPauseSnapshotValid;
		}
		if (!mfPauseCore->loadState(mfPauseCore, mfPauseState)) {
			return mfPauseSnapshotValid;
		}
		mfPauseCore->setVideoBuffer(mfPauseCore, mfPauseFrameBuffer, 256);

		/* Guarantee a fresh START edge even if the source state was sampled while
		 * START happened to be held. */
		mfPauseCore->setKeys(mfPauseCore, 0);
		mfPauseCore->runFrame(mfPauseCore);
		mfPauseCore->setKeys(mfPauseCore, 1u << GBA_KEY_START);
		mfPauseCore->runFrame(mfPauseCore);
		mfPauseCore->setKeys(mfPauseCore, 0);

		int stableMapFrames = 0;
		for (int i = 0; i < 48; ++i) {
			mfPauseCore->runFrame(mfPauseCore);
			int mode = (s16)mfPauseCore->rawRead16(mfPauseCore, MF_MAIN_GAME_MODE, -1);
			if (mode == MF_MODE_MAP_SCREEN) {
				++stableMapFrames;
				if (stableMapFrames >= 6) {
					break;
				}
			} else {
				stableMapFrames = 0;
			}
		}
		if (stableMapFrames < 1) {
			return mfPauseSnapshotValid;
		}
	} else {
		/* Normal movement: the helper is already paused on the native map page.
		 * Synchronize the map data and render exactly one Fusion frame. */
		_mfSyncPauseMapRuntime(runner, mapX, mapY, area);
		mfPauseCore->setKeys(mfPauseCore, 0);
		mfPauseCore->runFrame(mfPauseCore);
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
'''
text = text[:start] + new_refresh + text[end:]

# No custom map fallback: only game-rendered map, otherwise keep a game frame.
start = text.index('static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {')
end = text.index('\nstatic void _mfDrawPauseBottom', start)
new_draw_live = r'''static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {
	bool force = !mfPauseSnapshotValid;
	if (!_mfRefreshExactPauseMap(runner, force) && !mfPauseSnapshotValid) {
		/* No synthetic replacement. During a transition/startup, show only a
		 * frame originating from the game until Fusion can produce its own map. */
		_mfDrawBottomFull(fallback);
		return;
	}

	_mfDrawTexture(&mfMapTexture, bottomScreen, 320, 240,
			0, 0, 240, 160,
			0, 0, 320, 240);
}
'''
text = text[:start] + new_draw_live + text[end:]

# Add a native-frame menu layout helper before _drawFrame.
marker = 'static void _drawFrame(struct mGUIRunner* runner, bool faded) {'
idx = text.index(marker)
helper = r'''static bool _mfModeUsesBottomMenu(int mode, int sub2) {
	if (mode == MF_MODE_TITLE) {
		return sub2 == 2 || sub2 == 4;
	}
	if (mode == MF_MODE_FILE_SELECT_OR_INTRO) {
		return sub2 == 0;
	}
	return mode == MF_MODE_ERASE_SRAM_MENU || mode == MF_MODE_GAME_OVER;
}

static void _mfDrawNativeMenuLayout(const C3D_Tex* texture) {
	/* The lower screen is the untouched game UI. The upper screen uses only the
	 * upper artwork/header of that same game frame, so controls are visually
	 * concentrated on the touch screen without drawing replacement widgets. */
	_mfDrawTexture(texture, topScreen, 400, 240,
			0, 0, 240, 104,
			20, 42, 360, 156);
	_mfDrawBottomFull(texture);
}

'''
text = text[:idx] + helper + text[idx:]

# Patch non-game branch in drawFrame.
old = '''\t\t} else {\n\t\t\t/* Title, intro, elevators/cutscenes, file menus, game over and ending:\n\t\t\t * use both physical displays instead of leaving the touch screen black. */\n\t\t\t_mfDrawTopAspect(&outputTexture[activeOutputTexture]);\n\t\t\t_mfDrawBottomFull(&outputTexture[activeOutputTexture]);\n\t\t}\n'''
new = '''\t\t} else {\n\t\t\tint sub2 = (s8)runner->core->rawRead8(runner->core, MF_SUB_GAME_MODE2, -1);\n\t\t\tif (_mfModeUsesBottomMenu(mode, sub2)) {\n\t\t\t\t_mfDrawNativeMenuLayout(&outputTexture[activeOutputTexture]);\n\t\t\t} else {\n\t\t\t\t/* Intro/cutscene/loading/ending: both displays are still sourced from\n\t\t\t\t * the game's own frame; no custom interface is drawn. */\n\t\t\t\t_mfDrawTopAspect(&outputTexture[activeOutputTexture]);\n\t\t\t\t_mfDrawBottomFull(&outputTexture[activeOutputTexture]);\n\t\t\t}\n\t\t}\n'''
if old not in text:
    raise SystemExit('drawFrame non-game branch not found')
text = text.replace(old, new, 1)

# Touchscreen -> native GBA controls. Pause-map buttons are direct hit zones.
start = text.index('static uint16_t _pollGameInput(struct mGUIRunner* runner) {')
end = text.index('\nstatic void _incrementScreenMode', start)
new_poll = r'''static uint16_t _pollGameInput(struct mGUIRunner* runner) {
	hidScanInput();
	uint32_t activeKeys = hidKeysHeld();
	uint32_t downKeys = hidKeysDown();
	uint16_t keys = mInputMapKeyBits(&runner->core->inputMap, _3DS_INPUT, activeKeys, 0);
	keys |= (activeKeys >> 24) & 0xF0;

#ifdef M_CORE_GBA
	if (runner && runner->core && runner->core->platform(runner->core) == mPLATFORM_GBA) {
		int mode = _mfMainMode(runner);
		int sub1 = (s16)runner->core->rawRead16(runner->core, MF_SUB_GAME_MODE1, -1);
		int sub2 = (s8)runner->core->rawRead8(runner->core, MF_SUB_GAME_MODE2, -1);

		/* A touch on a page button while gameplay is live first opens Fusion's
		 * real pause screen. The requested native L/R/A action is injected only
		 * after that screen has had time to initialize. */
		if (mfTouchPendingPauseKey >= 0 && mode == MF_MODE_MAP_SCREEN) {
			if (mfTouchPendingDelay > 0) {
				--mfTouchPendingDelay;
			} else {
				keys |= (uint16_t)(1u << mfTouchPendingPauseKey);
				mfTouchPendingPauseKey = -1;
			}
		}

		if (downKeys & KEY_TOUCH) {
			touchPosition pos;
			hidTouchRead(&pos);
			int x = pos.px;
			int y = pos.py;

			if (mode == MF_MODE_IN_GAME && sub1 == 2) {
				int action = -1;
				if (y <= 38 && x <= 82) action = GBA_KEY_L;
				else if (y <= 38 && x >= 238) action = GBA_KEY_R;
				else if (y >= 190 && x >= 205) action = GBA_KEY_A;
				if (action >= 0) {
					mfTouchPendingPauseKey = action;
					mfTouchPendingDelay = 10;
					keys |= (uint16_t)(1u << GBA_KEY_START);
				}
			} else if (mode == MF_MODE_MAP_SCREEN) {
				/* Hit boxes match the buttons already drawn by Fusion itself. */
				if (y <= 42 && x <= 86) keys |= (uint16_t)(1u << GBA_KEY_L);
				else if (y <= 42 && x >= 232) keys |= (uint16_t)(1u << GBA_KEY_R);
				else if (y >= 184 && x >= 198) keys |= (uint16_t)(1u << GBA_KEY_A);
			} else if (mode == MF_MODE_TITLE && (sub2 == 2 || sub2 == 4)) {
				/* The native title screen accepts A or START. */
				keys |= (uint16_t)(1u << GBA_KEY_START);
			} else if (mode == MF_MODE_FILE_SELECT_OR_INTRO && sub2 == 0) {
				/* Keep file-select logic native. Touch supplies only the same controls
				 * the original menu already understands. */
				if (x < 52) keys |= (uint16_t)(1u << GBA_KEY_B);
				else if (y < 78) keys |= (uint16_t)(1u << GBA_KEY_UP);
				else if (y > 162) keys |= (uint16_t)(1u << GBA_KEY_DOWN);
				else keys |= (uint16_t)(1u << GBA_KEY_A);
			} else if (mode == MF_MODE_ERASE_SRAM_MENU || mode == MF_MODE_GAME_OVER) {
				if (y < 92) keys |= (uint16_t)(1u << GBA_KEY_UP);
				else if (y > 148) keys |= (uint16_t)(1u << GBA_KEY_DOWN);
				else keys |= (uint16_t)(1u << GBA_KEY_A);
			}
		}
	}
#endif
	return keys;
}
'''
text = text[:start] + new_poll + text[end:]

# Reset pending touch action when unloading.
old = '''\tmfPauseSnapshotAge = 9999;\n}\n'''
new = '''\tmfPauseSnapshotAge = 9999;\n\tmfTouchPendingPauseKey = -1;\n\tmfTouchPendingDelay = 0;\n}\n'''
if old not in text:
    raise SystemExit('destroy tail not found')
text = text.replace(old, new, 1)

main.write_text(text, encoding='utf-8')
print(f'Applied v0.9 native-UI/touch/performance patch to {main}')
