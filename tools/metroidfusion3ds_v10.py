#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "src/platform/3ds/main.c"
text = main.read_text(encoding="utf-8")

needle = "static int mfTouchPendingDelay = 0;\n"
insert = r'''static int mfTouchPendingDelay = 0;

/* v0.10: one-core native-map cache.
 *
 * Running a second complete GBA core on 3DS is too expensive. Instead, keep a
 * savestate of Fusion's own MAP_SCREEN and briefly swap the *same* core into it
 * only when the map actually needs an update. Normal gameplay therefore runs
 * one GBA core at full speed. No replacement map UI is drawn by the frontend. */
static void* mfNativeMapGameplayState = NULL;
static void* mfNativeMapState = NULL;
static size_t mfNativeMapStateSize = 0;
static bool mfNativeMapStateValid = false;
static unsigned mfNativeMapVisibleFrames = 0;
static unsigned mfNativeMapGameplayFrames = 0;
static unsigned mfNativeMapUpdateCooldown = 0;
static u16 mfNativeMapTilemap[32 * 32];
static u8 mfNativeMapEquipment[0x70];
'''
if needle not in text:
    raise SystemExit("touch state marker not found")
text = text.replace(needle, insert, 1)

# Extend cleanup so changing/unloading games cannot leave cached state allocated.
needle = "\tmfTouchPendingPauseKey = -1;\n\tmfTouchPendingDelay = 0;\n}\n\nstatic bool _mfInitPauseCore"
replacement = r'''\tif (mfNativeMapGameplayState) {
\t\tlinearFree(mfNativeMapGameplayState);
\t\tmfNativeMapGameplayState = NULL;
\t}
\tif (mfNativeMapState) {
\t\tlinearFree(mfNativeMapState);
\t\tmfNativeMapState = NULL;
\t}
\tmfNativeMapStateSize = 0;
\tmfNativeMapStateValid = false;
\tmfNativeMapVisibleFrames = 0;
\tmfNativeMapGameplayFrames = 0;
\tmfNativeMapUpdateCooldown = 0;
\tmfTouchPendingPauseKey = -1;
\tmfTouchPendingDelay = 0;
}

static bool _mfInitPauseCore'''
if needle not in text:
    raise SystemExit("cleanup marker not found")
text = text.replace(needle, replacement, 1)

start = text.find("static bool _mfRefreshExactPauseMap(struct mGUIRunner* runner, bool force) {")
end = text.find("static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {", start)
if start < 0 or end < 0:
    raise SystemExit("v0.9 map refresh block not found")
new_block = r'''static bool _mfEnsureNativeMapStateBuffers(struct mGUIRunner* runner) {
\tif (mfNativeMapGameplayState && mfNativeMapState) {
\t\treturn true;
\t}
\tif (!runner || !runner->core) {
\t\treturn false;
\t}
\tmfNativeMapStateSize = runner->core->stateSize(runner->core);
\tif (!mfNativeMapStateSize) {
\t\treturn false;
\t}
\tmfNativeMapGameplayState = linearMemAlign(mfNativeMapStateSize, 0x80);
\tmfNativeMapState = linearMemAlign(mfNativeMapStateSize, 0x80);
\tif (!mfNativeMapGameplayState || !mfNativeMapState) {
\t\tif (mfNativeMapGameplayState) {
\t\t\tlinearFree(mfNativeMapGameplayState);
\t\t\tmfNativeMapGameplayState = NULL;
\t\t}
\t\tif (mfNativeMapState) {
\t\t\tlinearFree(mfNativeMapState);
\t\t\tmfNativeMapState = NULL;
\t\t}
\t\tmfNativeMapStateSize = 0;
\t\treturn false;
\t}
\treturn true;
}

static void _mfCopyOutputBufferToMapTexture(void) {
\tif (!mfMapTextureReady || !outputBuffer) {
\t\treturn;
\t}
\tGSPGPU_FlushDataCache(outputBuffer, 256 * GBA_VIDEO_VERTICAL_PIXELS * sizeof(mColor));
\tC3D_SyncDisplayTransfer(
\t\t\t(u32*)outputBuffer, GX_BUFFER_DIM(256, GBA_VIDEO_VERTICAL_PIXELS),
\t\t\tmfMapTexture.data, GX_BUFFER_DIM(256, 256),
\t\t\tGX_TRANSFER_IN_FORMAT(GX_TRANSFER_FMT_RGB565) |
\t\t\t\tGX_TRANSFER_OUT_FORMAT(GX_TRANSFER_FMT_RGB565) |
\t\t\t\tGX_TRANSFER_OUT_TILED(1) | GX_TRANSFER_FLIP_VERT(1));
\tmfPauseSnapshotValid = true;
\tmfMapValid = true;
}

static void _mfCaptureGameplayMapArrays(struct mGUIRunner* runner) {
\tfor (unsigned i = 0; i < 32 * 32; ++i) {
\t\tmfNativeMapTilemap[i] = (u16)runner->core->rawRead16(
\t\t\t\trunner->core, MF_MINIMAP_TILEMAP + i * 2, -1);
\t}
\tfor (unsigned i = 0; i < sizeof(mfNativeMapEquipment); ++i) {
\t\tmfNativeMapEquipment[i] = (u8)runner->core->rawRead8(
\t\t\t\trunner->core, 0x03001310 + i, -1);
\t}
}

static void _mfApplyGameplayMapRuntime(struct mGUIRunner* runner,
\t\tint mapX, int mapY, int area) {
\trunner->core->rawWrite8(runner->core, MF_MINIMAP_X, -1, (u8)mapX);
\trunner->core->rawWrite8(runner->core, MF_MINIMAP_Y, -1, (u8)mapY);
\trunner->core->rawWrite8(runner->core, MF_CURRENT_AREA, -1, (u8)area);
\trunner->core->rawWrite8(runner->core, MF_PAUSE_DATA_MAP_X, -1, (u8)mapX);
\trunner->core->rawWrite8(runner->core, MF_PAUSE_DATA_MAP_Y, -1, (u8)mapY);
\trunner->core->rawWrite8(runner->core, MF_PAUSE_DATA_AREA, -1, (u8)area);
\tfor (unsigned i = 0; i < 32 * 32; ++i) {
\t\trunner->core->rawWrite16(runner->core, MF_MINIMAP_TILEMAP + i * 2, -1,
\t\t\t\tmfNativeMapTilemap[i]);
\t}
\tfor (unsigned i = 0; i < sizeof(mfNativeMapEquipment); ++i) {
\t\trunner->core->rawWrite8(runner->core, 0x03001310 + i, -1,
\t\t\t\tmfNativeMapEquipment[i]);
\t}
}

static void _mfRememberVisibleNativeMap(struct mGUIRunner* runner) {
\t/* Whenever Fusion itself is visibly rendering MAP_SCREEN, cache that exact
\t * frame. This is especially important for a new game: Fusion naturally shows
\t * the map after the intro, so gameplay can reuse it at zero emulation cost. */
\t_mfCopyOutputBufferToMapTexture();
\t++mfNativeMapVisibleFrames;
\tmfNativeMapGameplayFrames = 0;

\tif (!_mfEnsureNativeMapStateBuffers(runner)) {
\t\treturn;
\t}
\t/* Wait a few frames so the native fade/initialization has completed. Keep the
\t * latest stable MAP_SCREEN state as the persistent companion-screen state. */
\tif (mfNativeMapVisibleFrames == 4 && runner->core->saveState(runner->core, mfNativeMapState)) {
\t\tmfNativeMapStateValid = true;
\t\tmfPauseLastX = runner->core->rawRead8(runner->core, MF_MINIMAP_X, -1);
\t\tmfPauseLastY = runner->core->rawRead8(runner->core, MF_MINIMAP_Y, -1);
\t\tmfPauseLastArea = runner->core->rawRead8(runner->core, MF_CURRENT_AREA, -1);
\t\tmfPauseLastSecurity = runner->core->rawRead8(runner->core, MF_EQUIPMENT_SECURITY, -1);
\t\tmfPauseLastDownloadedMaps = runner->core->rawRead8(runner->core, MF_EQUIPMENT_DOWNLOADED_MAPS, -1);
\t}
}

static bool _mfCreateNativeMapStateFromGameplay(struct mGUIRunner* runner) {
\t/* Fallback for loading a save that enters gameplay without first showing the
\t * map. Temporarily open the *real* Fusion pause screen in this same core,
\t * capture it, then restore the exact gameplay state. This can cause one short
\t * hitch once, but has no persistent CPU cost. */
\tif (!_mfEnsureNativeMapStateBuffers(runner)) {
\t\treturn false;
\t}
\tif (!runner->core->saveState(runner->core, mfNativeMapGameplayState)) {
\t\treturn false;
\t}

\tbool ok = false;
\trunner->core->setVideoBuffer(runner->core, outputBuffer, 256);
\trunner->core->setKeys(runner->core, 0);
\trunner->core->runFrame(runner->core);
\trunner->core->setKeys(runner->core, 1u << GBA_KEY_START);
\trunner->core->runFrame(runner->core);
\trunner->core->setKeys(runner->core, 0);

\tint stable = 0;
\tfor (int i = 0; i < 36; ++i) {
\t\trunner->core->runFrame(runner->core);
\t\tint mode = (s16)runner->core->rawRead16(runner->core, MF_MAIN_GAME_MODE, -1);
\t\tif (mode == MF_MODE_MAP_SCREEN) {
\t\t\t++stable;
\t\t\tif (stable >= 4) {
\t\t\t\tok = true;
\t\t\t\tbreak;
\t\t\t}
\t\t} else {
\t\t\tstable = 0;
\t\t}
\t}
\tif (ok) {
\t\t_mfCopyOutputBufferToMapTexture();
\t\tif (runner->core->saveState(runner->core, mfNativeMapState)) {
\t\t\tmfNativeMapStateValid = true;
\t\t}
\t}

\trunner->core->loadState(runner->core, mfNativeMapGameplayState);
\trunner->core->setVideoBuffer(runner->core, outputBuffer, 256);
\trunner->core->setKeys(runner->core, 0);
\tmAudioBufferClear(runner->core->getAudioBuffer(runner->core));
\treturn ok;
}

static bool _mfRefreshExactPauseMap(struct mGUIRunner* runner, bool force) {
\tif (!runner || !runner->core || runner->core->platform(runner->core) != mPLATFORM_GBA) {
\t\treturn false;
\t}
\tint subMode = (s16)runner->core->rawRead16(runner->core, MF_SUB_GAME_MODE1, -1);
\tif (subMode != 2) {
\t\tmfNativeMapGameplayFrames = 0;
\t\treturn mfPauseSnapshotValid;
\t}
\t++mfNativeMapGameplayFrames;
\tmfNativeMapVisibleFrames = 0;
\tif (mfNativeMapUpdateCooldown) {
\t\t--mfNativeMapUpdateCooldown;
\t}

\tint mapX = runner->core->rawRead8(runner->core, MF_MINIMAP_X, -1);
\tint mapY = runner->core->rawRead8(runner->core, MF_MINIMAP_Y, -1);
\tint area = runner->core->rawRead8(runner->core, MF_CURRENT_AREA, -1);
\tint security = runner->core->rawRead8(runner->core, MF_EQUIPMENT_SECURITY, -1);
\tint downloadedMaps = runner->core->rawRead8(runner->core, MF_EQUIPMENT_DOWNLOADED_MAPS, -1);
\tbool areaChanged = area != mfPauseLastArea;
\tbool changed = mapX != mfPauseLastX || mapY != mfPauseLastY || areaChanged ||
\t\t\tsecurity != mfPauseLastSecurity || downloadedMaps != mfPauseLastDownloadedMaps;

\t/* New-game path normally already has a genuine map snapshot from the map shown
\t * after the intro. Only synthesize a native MAP_SCREEN state if no such frame
\t * was ever seen (common when loading directly into gameplay). */
\tif (!mfNativeMapStateValid) {
\t\tif (mfPauseSnapshotValid && !force) {
\t\t\treturn true;
\t\t}
\t\tif (mfNativeMapGameplayFrames < 24 && !force) {
\t\t\treturn mfPauseSnapshotValid;
\t\t}
\t\tif (!_mfCreateNativeMapStateFromGameplay(runner)) {
\t\t\treturn mfPauseSnapshotValid;
\t\t}
\t\tmfPauseLastX = mapX;
\t\tmfPauseLastY = mapY;
\t\tmfPauseLastArea = area;
\t\tmfPauseLastSecurity = security;
\t\tmfPauseLastDownloadedMaps = downloadedMaps;
\t\tmfNativeMapUpdateCooldown = 8;
\t\treturn true;
\t}

\tif ((!changed && !force) || (mfNativeMapUpdateCooldown && !areaChanged && !force)) {
\t\treturn mfPauseSnapshotValid;
\t}
\t_mfCaptureGameplayMapArrays(runner);
\tif (!_mfEnsureNativeMapStateBuffers(runner) ||
\t\t\t!runner->core->saveState(runner->core, mfNativeMapGameplayState)) {
\t\treturn mfPauseSnapshotValid;
\t}

\tbool ok = false;
\tif (runner->core->loadState(runner->core, mfNativeMapState)) {
\t\trunner->core->setVideoBuffer(runner->core, outputBuffer, 256);
\t\t_mfApplyGameplayMapRuntime(runner, mapX, mapY, area);
\t\trunner->core->setKeys(runner->core, 0);
\t\trunner->core->runFrame(runner->core);
\t\tif (_mfMainMode(runner) == MF_MODE_MAP_SCREEN) {
\t\t\t_mfCopyOutputBufferToMapTexture();
\t\t\trunner->core->saveState(runner->core, mfNativeMapState);
\t\t\tok = true;
\t\t}
\t}

\trunner->core->loadState(runner->core, mfNativeMapGameplayState);
\trunner->core->setVideoBuffer(runner->core, outputBuffer, 256);
\trunner->core->setKeys(runner->core, 0);
\tmAudioBufferClear(runner->core->getAudioBuffer(runner->core));

\tif (ok) {
\t\tmfPauseLastX = mapX;
\t\tmfPauseLastY = mapY;
\t\tmfPauseLastArea = area;
\t\tmfPauseLastSecurity = security;
\t\tmfPauseLastDownloadedMaps = downloadedMaps;
\t\tmfNativeMapUpdateCooldown = 8;
\t}
\treturn mfPauseSnapshotValid;
}

'''
text = text[:start] + new_block + text[end:]

# Cache every real MAP_SCREEN frame before drawing it to the lower display.
old = '''\t\tif (mapScreen) {\n\t\t\t_mfDrawTopAspect(&outputTexture[mfGameplayTextureIndex]);\n\t\t\t_mfDrawPauseBottom(&outputTexture[activeOutputTexture]);\n'''
new = '''\t\tif (mapScreen) {\n\t\t\t_mfRememberVisibleNativeMap(runner);\n\t\t\t_mfDrawTopAspect(&outputTexture[mfGameplayTextureIndex]);\n\t\t\t_mfDrawPauseBottom(&outputTexture[activeOutputTexture]);\n'''
if old not in text:
    raise SystemExit("mapScreen draw branch not found")
text = text.replace(old, new, 1)

main.write_text(text, encoding="utf-8")
print(f"Applied v0.10 single-core native-map cache to {main}")
