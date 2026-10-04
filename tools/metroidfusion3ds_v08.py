#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "src/platform/3ds/main.c"
text = main.read_text(encoding="utf-8")

old_init = '''\tmfPauseCore = mCoreCreate(mPLATFORM_GBA);
\tif (!mfPauseCore || !mfPauseCore->init(mfPauseCore)) {
\t\t_mfDestroyPauseCore();
\t\treturn false;
\t}

\t/* The forwarder keeps RomFS mounted for the lifetime of the app. Load the
\t * same embedded ROM into the helper core, but never attach save/audio I/O. */
'''
new_init = '''\tmfPauseCore = mCoreCreate(mPLATFORM_GBA);
\tif (!mfPauseCore || !mfPauseCore->init(mfPauseCore)) {
\t\t_mfDestroyPauseCore();
\t\treturn false;
\t}

\t/* A standalone mCore must have its configuration initialized before reset().
\t * v0.7 skipped this normal mGBA lifecycle step, leaving reset-time config
\t * queries pointed at uninitialized storage. Keep the helper deliberately
\t * simple and single-threaded. */
\tmCoreInitConfig(mfPauseCore, "3ds-map-helper");
\tmCoreConfigSetDefaultIntValue(&mfPauseCore->config, "threadedVideo", 0);

\t/* The forwarder keeps RomFS mounted for the lifetime of the app. Load the
\t * same embedded ROM into the helper core, but never attach save/audio I/O. */
'''
if old_init not in text:
    raise SystemExit("v0.7 pause-core init block not found")
text = text.replace(old_init, new_init, 1)

old_video = '''\tmemset(mfPauseFrameBuffer, 0, 256 * 224 * sizeof(mColor));
\tmfPauseCore->setVideoBuffer(mfPauseCore, mfPauseFrameBuffer, 256);

\tmfPauseStateSize = runner->core->stateSize(runner->core);
'''
new_video = '''\tmemset(mfPauseFrameBuffer, 0, 256 * 224 * sizeof(mColor));
\tmfPauseCore->setVideoBuffer(mfPauseCore, mfPauseFrameBuffer, 256);

\t/* Critical v0.8 fix: initialize the GBA timing/video/audio/IO event graph
\t * before deserializing a live state into this second core. In v0.7 the first
\t * helper runFrame() entered GBAProcessEvents with an uninitialized timing
\t * event callback and could branch to address 0 (Undefined Instruction). */
\tmfPauseCore->reset(mfPauseCore);

\tmfPauseStateSize = runner->core->stateSize(runner->core);
'''
if old_video not in text:
    raise SystemExit("v0.7 pause-core video block not found")
text = text.replace(old_video, new_video, 1)

main.write_text(text, encoding="utf-8")
print(f"Applied v0.8 helper-core lifecycle fix to {main}")
