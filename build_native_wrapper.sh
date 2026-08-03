#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_JAR="${ANDROID_JAR:-$ROOT/toolchain/android-4.1.1.4.jar}"
DX_JAR="${DX_JAR:-$ROOT/toolchain/dx.jar}"
OUT="$ROOT/native-out"
rm -rf "$OUT"
mkdir -p "$OUT/stubclasses" "$OUT/appclasses" "$OUT/dex"
javac -source 8 -target 8 -Xlint:-options -cp "$ANDROID_JAR" -d "$OUT/stubclasses" "$ROOT/native-stubs/android/webkit/JavascriptInterface.java"
javac -source 8 -target 8 -Xlint:-options -cp "$ANDROID_JAR:$OUT/stubclasses" -d "$OUT/appclasses" "$ROOT/native-src/com/saveslot/app/MainActivity.java"
python - "$OUT/appclasses" <<'PY'
from pathlib import Path
import sys
for path in Path(sys.argv[1]).rglob('*.class'):
    data=bytearray(path.read_bytes())
    if data[:4] != b'\xca\xfe\xba\xbe':
        raise SystemExit(f'Invalid class file: {path}')
    data[6:8]=(51).to_bytes(2,'big')
    path.write_bytes(data)
PY
java -cp "$DX_JAR" com.android.dx.command.Main --dex --output="$OUT/dex/classes.dex" "$OUT/appclasses"
cp "$OUT/dex/classes.dex" "$ROOT/android-wrapper/classes.dex"
