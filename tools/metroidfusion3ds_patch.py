#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "src/platform/3ds/main.c"
text = main.read_text(encoding="utf-8")

anchor = "static bool core2;\n"
insert = r'''

#ifdef M_CORE_GBA
/* Metroid Fusion (USA/AMTE) live 3DS companion UI.
 * The Ukrainian ROM used for testing is based on this revision, so these
 * IWRAM addresses are unchanged by the translation patch. */
#define MF_PAUSE_SCREEN_FLAG 0x03000B84
#define MF_PAUSE_SCREEN_USER 0x02

static bool mfPauseActive = false;
static int mfGameplayTextureIndex = 0;
static int mfPauseTextureIndex = 1;

static bool _mfIsUserPause(struct mGUIRunner* runner) {
	if (!runner || !runner->core || runner->core->platform(runner->core) != mPLATFORM_GBA) {
		return false;
	}
	return runner->core->rawRead8(runner->core, MF_PAUSE_SCREEN_FLAG, -1) == MF_PAUSE_SCREEN_USER;
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

static void _mfDrawGameplayTop(const C3D_Tex* texture) {
	int wide = gfxIsWide() ? 2 : 1;
	int screenW = gfxIsWide() ? 800 : 400;
	int dstW = 360 * wide;
	_mfDrawTexture(texture, topScreen, screenW, 240,
			0, 0, 240, 160,
			(screenW - dstW) / 2, 0, dstW, 240);
}

static void _mfDrawLiveMapBottom(const C3D_Tex* texture) {
	/* Fusion's HUD minimap lives in the upper-right portion of the GBA frame.
	 * A slightly oversized crop keeps the player marker and map border visible.
	 * It is sampled from the current emulated frame, so movement updates every frame. */
	_mfDrawTexture(texture, bottomScreen, 320, 240,
			176, 0, 64, 64,
			40, 0, 240, 240);
}

static void _mfDrawPauseBottom(const C3D_Tex* texture) {
	/* Original Fusion pause/map/status screen, aspect-correct on the touch screen. */
	_mfDrawTexture(texture, bottomScreen, 320, 240,
			0, 0, 240, 160,
			0, 13, 320, 213);
}
#endif
'''
if anchor not in text:
    raise SystemExit("anchor core2 not found")
text = text.replace(anchor, anchor + insert, 1)

old_prepare = r'''static void _prepareForFrame(struct mGUIRunner* runner) {
	UNUSED(runner);
	activeOutputTexture ^= 1;
}
'''
new_prepare = r'''static void _prepareForFrame(struct mGUIRunner* runner) {
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
if old_prepare not in text:
    raise SystemExit("prepareForFrame block not found")
text = text.replace(old_prepare, new_prepare, 1)

old_draw_tail = r'''	_drawTex(runner->core, faded, interframeBlending);
}

static void _drawScreenshot'''
new_draw_tail = r'''#ifdef M_CORE_GBA
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
	_drawTex(runner->core, faded, interframeBlending);
}

static void _drawScreenshot'''
if old_draw_tail not in text:
    raise SystemExit("drawFrame tail not found")
text = text.replace(old_draw_tail, new_draw_tail, 1)

# mGUIGetRom() writes "romfs:/" plus the filename into initialPath, but does
# not append NUL unless the filename file ends with a newline. The stock 3DS
# main starts with a zeroed buffer; keep that guarantee even if launch args
# populated it before RomFS is mounted.
old_romfs = r'''	Result res = romfsInit();
	bool useRomfs = false;
	if (R_SUCCEEDED(res)) {
		useRomfs = mGUIGetRom(&runner, initialPath, sizeof(initialPath));
'''
new_romfs = r'''	Result res = romfsInit();
	bool useRomfs = false;
	if (R_SUCCEEDED(res)) {
		memset(initialPath, 0, sizeof(initialPath));
		useRomfs = mGUIGetRom(&runner, initialPath, sizeof(initialPath));
'''
if old_romfs not in text:
    raise SystemExit("romfs boot block not found")
text = text.replace(old_romfs, new_romfs, 1)

# Disable screen-mode cycling while the game is running; the two-screen layout is fixed.
old_key = r'''	_map3DSKey(&runner.params.keyMap, KEY_Y, mGUI_INPUT_SCREEN_MODE);
'''
new_key = r'''	/* KEY_Y screen-mode cycling intentionally disabled in the Fusion-specialized build. */
'''
if old_key in text:
    text = text.replace(old_key, new_key, 1)

main.write_text(text, encoding="utf-8")
print(f"Patched {main}")
