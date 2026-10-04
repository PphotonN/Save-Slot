#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "src/platform/3ds/main.c"
text = main.read_text(encoding="utf-8")

# v0.10 patch was intentionally generated from raw Python strings. Normalize
# only its inserted C regions so literal backslash+t does not reach the compiler.
start = text.find("static void _mfDestroyPauseCore(void) {")
end = text.find("static bool _mfInitPauseCore(struct mGUIRunner* runner) {", start)
if start < 0 or end < 0:
    raise SystemExit("v0.10 cleanup region not found")
text = text[:start] + text[start:end].replace(r"\t", "\t") + text[end:]

start = text.find("static bool _mfEnsureNativeMapStateBuffers(struct mGUIRunner* runner) {")
end = text.find("static void _mfDrawLiveMapBottom(struct mGUIRunner* runner, const C3D_Tex* fallback) {", start)
if start < 0 or end < 0:
    raise SystemExit("v0.10 native-map region not found")
text = text[:start] + text[start:end].replace(r"\t", "\t") + text[end:]

main.write_text(text, encoding="utf-8")
print(f"Normalized v0.10 generated C indentation in {main}")
