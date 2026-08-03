from pathlib import Path
import shutil, subprocess, zipfile, hashlib

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
WRAPPER = ROOT / "android-wrapper"
OUT = ROOT / "out-valid"
OUT.mkdir(exist_ok=True)
KEYSTORE = ROOT / "signing" / "save-slot-test.keystore"

required = [APP / 'index.html', APP / 'app.js', APP / 'style.css', APP / 'assets' / 'model.json', APP / 'assets' / 'model-data.js', APP / 'assets' / 'fallback-cover.jpg', WRAPPER / 'AndroidManifest.xml', WRAPPER / 'classes.dex', KEYSTORE]
missing = [str(path) for path in required if not path.is_file()]
if missing:
    raise SystemExit(f'Missing required build files: {missing}')
if not (WRAPPER / 'classes.dex').read_bytes().startswith(b'dex\n'):
    raise SystemExit('Invalid classes.dex header')
if (WRAPPER / 'AndroidManifest.xml').stat().st_size < 256:
    raise SystemExit('AndroidManifest.xml is unexpectedly small')
UNSIGNED = OUT / "SaveSlot-unsigned.apk"
SIGNED = OUT / "SaveSlot.apk"

for path in (UNSIGNED, SIGNED):
    if path.exists():
        path.unlink()

with zipfile.ZipFile(UNSIGNED, "w", compression=zipfile.ZIP_DEFLATED) as z:
    z.write(WRAPPER / "AndroidManifest.xml", "AndroidManifest.xml")
    z.write(WRAPPER / "classes.dex", "classes.dex")
    for path in sorted(APP.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(APP).as_posix()
        # Launcher icon/resources are deliberately excluded. The stable wrapper has no icon resource reference.
        if rel in {"assets/app-icon.png", "assets/slot-fallback.jpg"}:
            continue
        z.write(path, f"assets/{rel}")

shutil.copy2(UNSIGNED, SIGNED)
subprocess.run([
    "jarsigner", "-keystore", str(KEYSTORE),
    "-storepass", "saveslot", "-keypass", "saveslot",
    "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256",
    str(SIGNED), "saveslot"
], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
verify = subprocess.run(["jarsigner", "-verify", "-verbose", "-certs", str(SIGNED)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
(OUT / "signature-verification.txt").write_text(verify.stdout)
if verify.returncode != 0 or "jar verified" not in verify.stdout.lower():
    raise SystemExit("Signature verification failed")

with zipfile.ZipFile(SIGNED) as z:
    bad_entry = z.testzip()
    if bad_entry:
        raise SystemExit(f'Corrupt APK entry: {bad_entry}')
    all_names = z.namelist()
    if len(all_names) != len(set(all_names)):
        raise SystemExit('Duplicate APK entries detected')
    names = set(all_names)
    required_entries = {"AndroidManifest.xml", "classes.dex", "assets/index.html", "assets/app.js", "assets/style.css", "assets/assets/model-data.js", "assets/assets/model.json"}
    if not required_entries.issubset(names):
        raise SystemExit(f'Missing APK entries: {required_entries - names}')
    forbidden = {"resources.arsc", "res/drawable/icon.png"}
    if names & forbidden:
        raise SystemExit(f"Forbidden resources found: {names & forbidden}")
    if z.read("AndroidManifest.xml") != (WRAPPER / "AndroidManifest.xml").read_bytes():
        raise SystemExit("Manifest changed")
    if z.read("classes.dex") != (WRAPPER / "classes.dex").read_bytes():
        raise SystemExit("DEX changed")

sha = hashlib.sha256(SIGNED.read_bytes()).hexdigest()
(OUT / "sha256.txt").write_text(sha + "\n")
print(f"Built: {SIGNED}")
print(f"SHA-256: {sha}")
