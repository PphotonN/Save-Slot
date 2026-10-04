#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "src/platform/3ds/main.c"
text = main.read_text(encoding="utf-8")


def replace_function(src: str, marker: str, replacement: str) -> str:
    start = src.index(marker)
    brace = src.index('{', start)
    depth = 0
    i = brace
    while i < len(src):
        ch = src[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                return src[:start] + replacement.rstrip() + src[end:]
        i += 1
    raise RuntimeError(f"unterminated function: {marker}")

old_defs = '''#define MF_MINIMAP_GFX 0x08561FA8\n'''
new_defs = '''#define MF_MINIMAP_GFX 0x08561FA8\n#define MF_MINIMAP_LOOKUP_LOW 0x08576190\n#define MF_OBJ_MINIMAP_PALETTE 0x050002C0\n#define MF_CURRENT_AREA 0x0300002C\n#define MF_SECURITY_HATCH_LEVEL 0x0300131D\n'''
if old_defs not in text:
    raise SystemExit("v0.5 minimap definitions not found")
text = text.replace(old_defs, new_defs, 1)

old_state = '''static unsigned mfMapRefreshCounter = 0;\n'''
new_state = '''static unsigned mfMapRefreshCounter = 0;\nstatic int mfMapViewX = 0;\nstatic int mfMapViewY = 0;\n'''
if old_state not in text:
    raise SystemExit("v0.5 map state not found")
text = text.replace(old_state, new_state, 1)

new_top = r'''static void _mfDrawTopAspect(const C3D_Tex* texture) {
	int screenW = gfxIsWide() ? 800 : 400;
	int dstW = gfxIsWide() ? 720 : 360;
	_mfDrawTexture(texture, topScreen, screenW, 240,
			0, 0, 240, 160,
			(screenW - dstW) / 2, 0, dstW, 240);
}'''
text = replace_function(text, "static void _mfDrawTopFull(", new_top)
text = text.replace("_mfDrawTopFull(", "_mfDrawTopAspect(")

new_color = r'''static u16 _mfGba555ToRgb565(u16 color) {
	unsigned r = color & 0x1F;
	unsigned g = (color >> 5) & 0x1F;
	unsigned b = (color >> 10) & 0x1F;
	unsigned g6 = (g << 1) | (g >> 4);
	return (u16)((r << 11) | (g6 << 5) | b);
}

static u8 _mfMapPaletteIndex(struct mGUIRunner* runner, unsigned pixel, unsigned palette) {
	if (!pixel) {
		return 0;
	}
	if (palette > 2) {
		palette = 0;
	}
	return runner->core->rawRead8(runner->core,
			MF_MINIMAP_LOOKUP_LOW + palette * 16 + (pixel & 0xF), -1) & 0xF;
}

static u16 _mfMapColor(struct mGUIRunner* runner, unsigned mapped) {
	static const u16 fallback[16] = {
		0x2109, 0x294F, 0x31B2, 0x73AE,
		0xA514, 0xFFFF, 0xF81F, 0xFFE0,
		0x07FF, 0x7BEF, 0xA514, 0xD69A,
		0x39CE, 0x6318, 0xC618, 0xFFFF
	};
	if (!mapped) {
		return 0;
	}
	u16 gbaColor = runner->core->rawRead16(runner->core,
			MF_OBJ_MINIMAP_PALETTE + (mapped & 0xF) * 2, -1);
	if (gbaColor) {
		return _mfGba555ToRgb565(gbaColor);
	}
	return fallback[mapped & 0xF];
}'''
text = replace_function(text, "static u16 _mfMapColor(", new_color)

insert_marker = "static void _mfUpdateMapTexture(struct mGUIRunner* runner, bool force) {"
idx = text.index(insert_marker)
helpers = r'''
static void _mfMapFillRect(int x, int y, int w, int h, u16 color) {
	if (!mfMapBuffer || w <= 0 || h <= 0) {
		return;
	}
	for (int py = 0; py < h; ++py) {
		for (int px = 0; px < w; ++px) {
			_mfMapPutPixel(x + px, y + py, color);
		}
	}
}

static void _mfMapHLine(int x, int y, int w, u16 color) {
	_mfMapFillRect(x, y, w, 1, color);
}

static void _mfMapVLine(int x, int y, int h, u16 color) {
	_mfMapFillRect(x, y, 1, h, color);
}

static u16 _mfTinyGlyph(char c) {
	switch (c) {
	case '0': return 0x7B6F; case '1': return 0x2492; case '2': return 0x73E7;
	case '3': return 0x73CF; case '4': return 0x5BC9; case '5': return 0x79CF;
	case '6': return 0x79EF; case '7': return 0x7249; case '8': return 0x7BEF;
	case '9': return 0x7BCF;
	case 'A': return 0x2BED; case 'B': return 0x79EF; case 'C': return 0x72E7;
	case 'D': return 0x36ED; case 'E': return 0x79E7; case 'G': return 0x7249;
	case 'I': return 0x7497; case 'K': return 0x5AAD; case 'L': return 0x2D6D;
	case 'M': return 0x5FED; case 'N': return 0x5BED; case 'O': return 0x7B6F;
	case 'P': return 0x7B6D; case 'R': return 0x7BED; case 'S': return 0x72C7;
	case 'T': return 0x7492; case 'U': return 0x5BCF; case 'V': return 0x5F6F;
	case 'Y': return 0x5B92; case 'Z': return 0x72C7;
	case '.': return 0x0001; case '-': return 0x01C0;
	default: return 0;
	}
}

static void _mfMapText(int x, int y, const char* text, u16 color) {
	for (const char* p = text; *p; ++p) {
		if (*p == ' ') {
			x += 4;
			continue;
		}
		u16 bits = _mfTinyGlyph(*p);
		for (int gy = 0; gy < 5; ++gy) {
			for (int gx = 0; gx < 3; ++gx) {
				int bit = 14 - (gy * 3 + gx);
				if (bits & (1u << bit)) {
					_mfMapPutPixel(x + gx, y + gy, color);
				}
			}
		}
		x += 4;
	}
}

static void _mfDrawPauseChrome(struct mGUIRunner* runner, int area) {
	const u16 navy = 0x2109;
	const u16 grid = 0x31B2;
	const u16 edge = 0xCE79;
	const u16 white = 0xFFFF;
	const u16 teal = 0x05B4;
	const u16 darkTeal = 0x0430;

	_mfMapFillRect(0, 0, 240, 160, navy);
	_mfMapFillRect(3, 17, 234, 140, navy);
	for (int x = 4; x <= 236; x += 8) {
		_mfMapVLine(x, 18, 137, grid);
	}
	for (int y = 18; y <= 154; y += 8) {
		_mfMapHLine(4, y, 233, grid);
	}

	_mfMapHLine(0, 0, 240, edge);
	_mfMapHLine(0, 159, 240, edge);
	_mfMapVLine(0, 0, 160, edge);
	_mfMapVLine(239, 0, 160, edge);
	_mfMapFillRect(2, 2, 43, 13, darkTeal);
	_mfMapFillRect(93, 2, 60, 13, teal);
	_mfMapFillRect(189, 2, 49, 13, darkTeal);
	_mfMapHLine(2, 15, 236, edge);
	_mfMapText(5, 6, "L SON", white);
	_mfMapText(195, 6, "STATUS R", white);
	if (area <= 0) {
		_mfMapText(106, 6, "G.PALUBA", white);
	} else {
		_mfMapText(105, 6, "SEKTOR", white);
		char digit[2] = { (char)('0' + (area > 9 ? 9 : area)), 0 };
		_mfMapText(134, 6, digit, white);
	}

	int security = runner->core->rawRead8(runner->core, MF_SECURITY_HATCH_LEVEL, -1);
	const u16 hatch[4] = { 0x05FF, 0x07E0, 0xFFE0, 0xF920 };
	_mfMapFillRect(174, 20, 63, 34, 0x18C7);
	for (int i = 0; i < 4; ++i) {
		char row[3] = { 'P', (char)('1' + i), 0 };
		_mfMapText(177, 23 + i * 7, row, white);
		u16 c = hatch[i];
		if (security < i + 1) {
			_mfMapFillRect(188, 23 + i * 7, 9, 4, (u16)(c >> 1));
			_mfMapFillRect(200, 24 + i * 7, 33, 2, 0xD817);
		} else {
			_mfMapFillRect(188, 23 + i * 7, 9, 4, c);
			_mfMapFillRect(200, 24 + i * 7, 33, 2, c);
		}
	}

	_mfMapFillRect(171, 145, 66, 12, navy);
	_mfMapFillRect(174, 148, 7, 7, edge);
	_mfMapText(176, 149, "A", navy);
	_mfMapText(184, 150, "ZAVDANNIA", 0xFFE0);
}

static void _mfDrawPlayerMarker(int sx, int sy) {
	const u16 magenta = 0xF81F;
	const u16 yellow = 0xFFE0;
	for (int dy = -3; dy <= 3; ++dy) {
		for (int dx = -4; dx <= 4; ++dx) {
			int d = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
			if (d <= 4) {
				_mfMapPutPixel(sx + dx, sy + dy, d <= 2 ? yellow : magenta);
			}
		}
	}
}

'''
text = text[:idx] + helpers + text[idx:]

new_update = r'''static void _mfUpdateMapTexture(struct mGUIRunner* runner, bool force) {
	if (!mfMapTextureReady || !mfMapBuffer || !runner || !runner->core) {
		mfMapValid = false;
		return;
	}

	++mfMapRefreshCounter;
	if (!force && (mfMapRefreshCounter & 3)) {
		return;
	}

	for (int i = 0; i < 256 * 256; ++i) {
		mfMapBuffer[i] = 0;
	}

	int area = runner->core->rawRead8(runner->core, MF_CURRENT_AREA, -1);
	_mfDrawPauseChrome(runner, area);

	int playerX = runner->core->rawRead8(runner->core, MF_MINIMAP_X, -1);
	int playerY = runner->core->rawRead8(runner->core, MF_MINIMAP_Y, -1);
	const int mapX = 4;
	const int mapY = 18;
	const int cols = 29;
	const int rows = 17;

	if (playerX >= 0 && playerX < 32 && playerY >= 0 && playerY < 32) {
		mfMapViewX = playerX - cols / 2;
		mfMapViewY = playerY - rows / 2;
		if (mfMapViewX < 0) mfMapViewX = 0;
		if (mfMapViewY < 0) mfMapViewY = 0;
		if (mfMapViewX > 32 - cols) mfMapViewX = 32 - cols;
		if (mfMapViewY > 32 - rows) mfMapViewY = 32 - rows;
	}

	bool drewTile = false;
	for (int vy = 0; vy < rows; ++vy) {
		int ty = mfMapViewY + vy;
		if (ty < 0 || ty >= 32) continue;
		for (int vx = 0; vx < cols; ++vx) {
			int tx = mfMapViewX + vx;
			if (tx < 0 || tx >= 32) continue;
			u16 entry = runner->core->rawRead16(runner->core,
					MF_MINIMAP_TILEMAP + (ty * 32 + tx) * 2, -1);
			unsigned tile = entry & 0x3FF;
			if (tile == 0x3FF) {
				continue;
			}
			bool flipX = (entry & 0x0400) != 0;
			bool flipY = (entry & 0x0800) != 0;
			unsigned palette = (entry >> 12) & 0xF;
			for (int py = 0; py < 8; ++py) {
				int sy = flipY ? 7 - py : py;
				for (int px = 0; px < 8; ++px) {
					int sx = flipX ? 7 - px : px;
					u32 addr = MF_MINIMAP_GFX + tile * 32 + sy * 4 + (sx >> 1);
					u8 packed = runner->core->rawRead8(runner->core, addr, -1);
					unsigned sourcePixel = (sx & 1) ? (packed >> 4) : (packed & 0xF);
					u8 mapped = _mfMapPaletteIndex(runner, sourcePixel, palette);
					if (!mapped) {
						continue;
					}
					_mfMapPutPixel(mapX + vx * 8 + px, mapY + vy * 8 + py,
							_mfMapColor(runner, mapped));
					drewTile = true;
				}
			}
		}
	}

	if (playerX >= mfMapViewX && playerX < mfMapViewX + cols &&
			playerY >= mfMapViewY && playerY < mfMapViewY + rows) {
		int sx = mapX + (playerX - mfMapViewX) * 8 + 4;
		int sy = mapY + (playerY - mfMapViewY) * 8 + 4;
		_mfDrawPlayerMarker(sx, sy);
	}

	_mfDrawPauseChrome(runner, area);

	GSPGPU_FlushDataCache(mfMapBuffer, 256 * 256 * 2);
	C3D_SyncDisplayTransfer(
			(u32*)mfMapBuffer, GX_BUFFER_DIM(256, 256),
			mfMapTexture.data, GX_BUFFER_DIM(256, 256),
			GX_TRANSFER_IN_FORMAT(GX_TRANSFER_FMT_RGB565) |
				GX_TRANSFER_OUT_FORMAT(GX_TRANSFER_FMT_RGB565) |
				GX_TRANSFER_OUT_TILED(1) | GX_TRANSFER_FLIP_VERT(1));
	mfMapValid = drewTile;
}'''
text = replace_function(text, "static void _mfUpdateMapTexture(", new_update)

new_draw_map = r'''static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {
	bool wasValid = mfMapValid;
	_mfUpdateMapTexture(runner, !wasValid);
	if (!mfMapValid) {
		_mfDrawBottomFull(fallback);
		return;
	}
	_mfDrawTexture(&mfMapTexture, bottomScreen, 320, 240,
			0, 0, 240, 160,
			0, 0, 320, 240);
}'''
text = replace_function(text, "static void _mfDrawLiveMapBottom(", new_draw_map)

main.write_text(text, encoding="utf-8")
print(f"Applied v0.6 aspect/pause-map patch to {main}")
