#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "src/platform/3ds/main.c"
text = main.read_text(encoding="utf-8")

old_globals = r'''static bool mfPauseActive = false;
static int mfGameplayTextureIndex = 0;
static int mfPauseTextureIndex = 1;
'''
new_globals = r'''static bool mfPauseActive = false;
static int mfGameplayTextureIndex = 0;
static int mfPauseTextureIndex = 1;

/* Fusion US/AMTE runtime state used by the 3DS companion screen. */
#define MF_MAIN_GAME_MODE 0x03000BDE
#define MF_MODE_IN_GAME 1
#define MF_MODE_MAP_SCREEN 3
#define MF_MINIMAP_TILEMAP 0x02034000
#define MF_MINIMAP_X 0x03000031
#define MF_MINIMAP_Y 0x03000032
#define MF_MINIMAP_GFX 0x08561FA8

static C3D_Tex mfMapTexture;
static u16* mfMapBuffer = NULL;
static bool mfMapTextureReady = false;
static bool mfMapValid = false;
static int mfMapCropX = 0;
static int mfMapCropY = 0;
static int mfMapCropW = 256;
static int mfMapCropH = 256;
static unsigned mfMapRefreshCounter = 0;
'''
if old_globals not in text:
    raise SystemExit("v0.4 Fusion globals not found")
text = text.replace(old_globals, new_globals, 1)

start = text.index("static bool _mfIsUserPause(struct mGUIRunner* runner) {")
end_marker = "static void _mfDrawPauseBottom(const C3D_Tex* texture) {"
end_start = text.index(end_marker, start)
end = text.index("\n}\n", end_start) + 3

helpers = r'''static bool _mfIsUserPause(struct mGUIRunner* runner) {
	if (!runner || !runner->core || runner->core->platform(runner->core) != mPLATFORM_GBA) {
		return false;
	}
	return runner->core->rawRead8(runner->core, MF_PAUSE_SCREEN_FLAG, -1) == MF_PAUSE_SCREEN_USER;
}

static int _mfMainMode(struct mGUIRunner* runner) {
	if (!runner || !runner->core || runner->core->platform(runner->core) != mPLATFORM_GBA) {
		return -1;
	}
	return (s16)runner->core->rawRead16(runner->core, MF_MAIN_GAME_MODE, -1);
}

static bool _mfIsMapScreen(struct mGUIRunner* runner) {
	return _mfMainMode(runner) == MF_MODE_MAP_SCREEN || _mfIsUserPause(runner);
}

static void _mfDrawTexture(const C3D_Tex* texture, C3D_RenderTarget* target,
		int screenW, int screenH,
		int srcX, int srcY, int srcW, int srcH,
		int dstX, int dstY, int dstW, int dstH) {
	C3D_FrameDrawOn(target);
	ctrSetViewportSize(screenW, screenH, true);
	ctrActivateTexture(texture);
	ctrAddRectEx(0xFFFFFFFF, dstX, dstY, dstW, dstH,
			srcX, srcY, srcW, srcH, 0);
	ctrFlushBatch();
}

static void _mfDrawTopFull(const C3D_Tex* texture) {
	int screenW = gfxIsWide() ? 800 : 400;
	/* v0.5 intentionally fills the physical 3DS display. The previous 360x240
	 * aspect-preserved image created the visible side margins in emulator. */
	_mfDrawTexture(texture, topScreen, screenW, 240,
			0, 0, 240, 160,
			0, 0, screenW, 240);
}

static void _mfDrawBottomFull(const C3D_Tex* texture) {
	_mfDrawTexture(texture, bottomScreen, 320, 240,
			0, 0, 240, 160,
			0, 0, 320, 240);
}

static u16 _mfMapColor(unsigned pixel, unsigned palette) {
	/* RGB565 approximation of Fusion's map language: dark navy field,
	 * blue/grey rooms, white explored detail, magenta/yellow highlights. */
	static const u16 colors[16] = {
		0x0821, 0x18A6, 0x318C, 0x5AD6,
		0xBDF7, 0xFFFF, 0xF81F, 0xFFE0,
		0x07FF, 0x7BEF, 0xA514, 0xD69A,
		0x39CE, 0x6318, 0xC618, 0xFFFF
	};
	if (!pixel) {
		return colors[0];
	}
	/* Palette bank changes as Fusion marks explored/special map tiles. Blend
	 * it into the small 4bpp index without depending on GBA palette RAM. */
	unsigned index = pixel & 0xF;
	if (palette >= 8 && index < 4) {
		index += 2;
	}
	return colors[index & 0xF];
}

static void _mfMapPutPixel(int x, int y, u16 color) {
	if (!mfMapBuffer || x < 0 || y < 0 || x >= 256 || y >= 256) {
		return;
	}
	mfMapBuffer[y * 256 + x] = color;
}

static void _mfUpdateMapTexture(struct mGUIRunner* runner, bool force) {
	if (!mfMapTextureReady || !mfMapBuffer || !runner || !runner->core) {
		mfMapValid = false;
		return;
	}

	/* A refresh every four video frames is enough for map discovery while keeping
	 * raw core reads small. Force is used when gameplay first becomes active. */
	++mfMapRefreshCounter;
	if (!force && (mfMapRefreshCounter & 3)) {
		return;
	}

	for (int i = 0; i < 256 * 256; ++i) {
		mfMapBuffer[i] = 0x0821;
	}

	int minTx = 32, minTy = 32, maxTx = -1, maxTy = -1;
	for (int ty = 0; ty < 32; ++ty) {
		for (int tx = 0; tx < 32; ++tx) {
			u16 entry = runner->core->rawRead16(runner->core,
					MF_MINIMAP_TILEMAP + (ty * 32 + tx) * 2, -1);
			unsigned tile = entry & 0x3FF;
			if (!tile || tile == 0x3FF) {
				continue;
			}

			if (tx < minTx) minTx = tx;
			if (tx > maxTx) maxTx = tx;
			if (ty < minTy) minTy = ty;
			if (ty > maxTy) maxTy = ty;

			bool flipX = (entry & 0x0400) != 0;
			bool flipY = (entry & 0x0800) != 0;
			unsigned palette = entry >> 12;
			for (int py = 0; py < 8; ++py) {
				int sy = flipY ? 7 - py : py;
				for (int px = 0; px < 8; ++px) {
					int sx = flipX ? 7 - px : px;
					u32 addr = MF_MINIMAP_GFX + tile * 32 + sy * 4 + (sx >> 1);
					u8 packed = runner->core->rawRead8(runner->core, addr, -1);
					unsigned pixel = (sx & 1) ? (packed >> 4) : (packed & 0xF);
					if (pixel) {
						_mfMapPutPixel(tx * 8 + px, ty * 8 + py, _mfMapColor(pixel, palette));
					}
				}
			}
		}
	}

	if (maxTx < minTx || maxTy < minTy) {
		mfMapValid = false;
		return;
	}

	/* Live Samus position. These are the same map coordinates the game's own
	 * HUD minimap uses, so the marker tracks room movement without pausing. */
	int playerX = runner->core->rawRead8(runner->core, MF_MINIMAP_X, -1);
	int playerY = runner->core->rawRead8(runner->core, MF_MINIMAP_Y, -1);
	if (playerX >= 0 && playerX < 32 && playerY >= 0 && playerY < 32) {
		int cx = playerX * 8 + 4;
		int cy = playerY * 8 + 4;
		for (int dy = -3; dy <= 3; ++dy) {
			for (int dx = -3; dx <= 3; ++dx) {
				if (dx == 0 || dy == 0 || (dx * dx + dy * dy <= 5)) {
					_mfMapPutPixel(cx + dx, cy + dy, (dx == 0 || dy == 0) ? 0xFFE0 : 0xF81F);
				}
			}
		}
	}

	/* Crop empty 32x32 margins and let the 3DS bottom display scale the useful
	 * map area to the full 320x240 panel. Keep one tile of breathing room. */
	minTx = minTx > 0 ? minTx - 1 : 0;
	minTy = minTy > 0 ? minTy - 1 : 0;
	maxTx = maxTx < 31 ? maxTx + 1 : 31;
	maxTy = maxTy < 31 ? maxTy + 1 : 31;
	mfMapCropX = minTx * 8;
	mfMapCropY = minTy * 8;
	mfMapCropW = (maxTx - minTx + 1) * 8;
	mfMapCropH = (maxTy - minTy + 1) * 8;

	GSPGPU_FlushDataCache(mfMapBuffer, 256 * 256 * 2);
	C3D_SyncDisplayTransfer(
			(u32*)mfMapBuffer, GX_BUFFER_DIM(256, 256),
			mfMapTexture.data, GX_BUFFER_DIM(256, 256),
			GX_TRANSFER_IN_FORMAT(GX_TRANSFER_FMT_RGB565) |
				GX_TRANSFER_OUT_FORMAT(GX_TRANSFER_FMT_RGB565) |
				GX_TRANSFER_OUT_TILED(1) | GX_TRANSFER_FLIP_VERT(1));
	mfMapValid = true;
}

static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {
	bool wasValid = mfMapValid;
	_mfUpdateMapTexture(runner, !wasValid);
	if (!mfMapValid) {
		_mfDrawBottomFull(fallback);
		return;
	}
	_mfDrawTexture(&mfMapTexture, bottomScreen, 320, 240,
			mfMapCropX, mfMapCropY, mfMapCropW, mfMapCropH,
			0, 0, 320, 240);
}

static void _mfDrawPauseBottom(const C3D_Tex* texture) {
	/* Original localized Fusion map/status page, now filling the touch screen. */
	_mfDrawBottomFull(texture);
}
'''
text = text[:start] + helpers + text[end:]

old_prepare = r'''static void _prepareForFrame(struct mGUIRunner* runner) {
#ifdef M_CORE_GBA
	if (runner && runner->core && runner->core->platform(runner->core) == mPLATFORM_GBA) {
		bool paused = _mfIsUserPause(runner);
		if (paused) {
			if (!mfPauseActive) {
				mfPauseActive = true;
				mfGameplayTextureIndex = activeOutputTexture;
				mfPauseTextureIndex = activeOutputTexture ^ 1;
			}
			activeOutputTexture = mfPauseTextureIndex;
			return;
		}

		mfPauseActive = false;
		activeOutputTexture ^= 1;
		mfGameplayTextureIndex = activeOutputTexture;
		mfPauseTextureIndex = activeOutputTexture ^ 1;
		return;
	}
#endif
	UNUSED(runner);
	activeOutputTexture ^= 1;
}
'''
new_prepare = r'''static void _prepareForFrame(struct mGUIRunner* runner) {
#ifdef M_CORE_GBA
	if (runner && runner->core && runner->core->platform(runner->core) == mPLATFORM_GBA) {
		bool mapScreen = _mfIsMapScreen(runner);
		if (mapScreen) {
			if (!mfPauseActive) {
				mfPauseActive = true;
				mfGameplayTextureIndex = activeOutputTexture;
				mfPauseTextureIndex = activeOutputTexture ^ 1;
			}
			activeOutputTexture = mfPauseTextureIndex;
			return;
		}

		mfPauseActive = false;
		activeOutputTexture ^= 1;
		mfGameplayTextureIndex = activeOutputTexture;
		mfPauseTextureIndex = activeOutputTexture ^ 1;
		return;
	}
#endif
	UNUSED(runner);
	activeOutputTexture ^= 1;
}
'''
if old_prepare not in text:
    raise SystemExit("v0.4 prepareForFrame not found")
text = text.replace(old_prepare, new_prepare, 1)

old_draw = r'''#ifdef M_CORE_GBA
	if (runner->core->platform(runner->core) == mPLATFORM_GBA) {
		bool paused = _mfIsUserPause(runner);

		/* The pause flag can become active during the frame after _prepareForFrame,
		 * so handle that transition here and preserve the previous gameplay texture. */
		if (paused && !mfPauseActive) {
			mfPauseActive = true;
			mfPauseTextureIndex = activeOutputTexture;
			mfGameplayTextureIndex = activeOutputTexture ^ 1;
		}

		if (paused) {
			_mfDrawGameplayTop(&outputTexture[mfGameplayTextureIndex]);
			_mfDrawPauseBottom(&outputTexture[activeOutputTexture]);
		} else {
			mfGameplayTextureIndex = activeOutputTexture;
			mfPauseTextureIndex = activeOutputTexture ^ 1;
			_mfDrawGameplayTop(&outputTexture[activeOutputTexture]);
			_mfDrawLiveMapBottom(&outputTexture[activeOutputTexture]);
		}
		return;
	}
#endif
'''
new_draw = r'''#ifdef M_CORE_GBA
	if (runner->core->platform(runner->core) == mPLATFORM_GBA) {
		int mode = _mfMainMode(runner);
		bool mapScreen = _mfIsMapScreen(runner);

		/* The mode can change after _prepareForFrame. Preserve the last gameplay
		 * texture before the GBA starts drawing the pause/map UI. */
		if (mapScreen && !mfPauseActive) {
			mfPauseActive = true;
			mfPauseTextureIndex = activeOutputTexture;
			mfGameplayTextureIndex = activeOutputTexture ^ 1;
		}

		if (mapScreen) {
			_mfDrawTopFull(&outputTexture[mfGameplayTextureIndex]);
			_mfDrawPauseBottom(&outputTexture[activeOutputTexture]);
		} else if (mode == MF_MODE_IN_GAME) {
			mfGameplayTextureIndex = activeOutputTexture;
			mfPauseTextureIndex = activeOutputTexture ^ 1;
			_mfDrawTopFull(&outputTexture[activeOutputTexture]);
			_mfDrawLiveMapBottom(runner, &outputTexture[activeOutputTexture]);
		} else {
			/* Title, intro, elevators/cutscenes, file menus, game over and ending:
			 * use both physical displays instead of leaving the touch screen black. */
			_mfDrawTopFull(&outputTexture[activeOutputTexture]);
			_mfDrawBottomFull(&outputTexture[activeOutputTexture]);
		}
		return;
	}
#endif
'''
if old_draw not in text:
    raise SystemExit("v0.4 drawFrame Fusion block not found")
text = text.replace(old_draw, new_draw, 1)

old_cleanup = r'''	C3D_TexDelete(&upscaleBufferTex);
	C3D_TexDelete(&outputTexture[0]);
	C3D_TexDelete(&outputTexture[1]);
	C3D_Fini();
'''
new_cleanup = r'''	C3D_TexDelete(&upscaleBufferTex);
	C3D_TexDelete(&outputTexture[0]);
	C3D_TexDelete(&outputTexture[1]);
#ifdef M_CORE_GBA
	if (mfMapTextureReady) {
		C3D_TexDelete(&mfMapTexture);
		mfMapTextureReady = false;
	}
	if (mfMapBuffer) {
		linearFree(mfMapBuffer);
		mfMapBuffer = NULL;
	}
#endif
	C3D_Fini();
'''
if old_cleanup not in text:
    raise SystemExit("cleanup texture block not found")
text = text.replace(old_cleanup, new_cleanup, 1)

init_anchor = r'''	for (i = 0; i < 2; ++i) {
		if (!C3D_TexInitVRAM(&outputTexture[i], 256, 256, GPU_RGB565)) {
			_cleanup();
			return 1;
		}
		C3D_TexSetWrap(&outputTexture[i], GPU_CLAMP_TO_EDGE, GPU_CLAMP_TO_EDGE);
		C3D_TexSetFilter(&outputTexture[i], GPU_NEAREST, GPU_NEAREST);
		void* outputTextureEnd = (u8*)outputTexture[i].data + 256 * 256 * 2;

		// Zero texture data to make sure no garbage around the border interferes with filtering
		GX_MemoryFill(
				outputTexture[i].data, 0x0000, outputTextureEnd, GX_FILL_16BIT_DEPTH | GX_FILL_TRIGGER,
				NULL, 0, NULL, 0);
		gspWaitForPSC0();
	}
'''
init_repl = init_anchor + r'''
#ifdef M_CORE_GBA
	if (!C3D_TexInitVRAM(&mfMapTexture, 256, 256, GPU_RGB565)) {
		_cleanup();
		return 1;
	}
	mfMapTextureReady = true;
	C3D_TexSetWrap(&mfMapTexture, GPU_CLAMP_TO_EDGE, GPU_CLAMP_TO_EDGE);
	C3D_TexSetFilter(&mfMapTexture, GPU_NEAREST, GPU_NEAREST);
	mfMapBuffer = linearMemAlign(256 * 256 * sizeof(u16), 0x80);
	if (!mfMapBuffer) {
		_cleanup();
		return 1;
	}
	memset(mfMapBuffer, 0, 256 * 256 * sizeof(u16));
#endif
'''
if init_anchor not in text:
    raise SystemExit("output texture init loop not found")
text = text.replace(init_anchor, init_repl, 1)

main.write_text(text, encoding="utf-8")
print(f"Applied v0.5 layout/live-map patch to {main}")
