from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()

def replace(rel, old, new):
    path = root / rel
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{rel}: expected one match for {old!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('refined', rel)

replace('arm9/source/romBrowser/views/RomBrowserTopScreenView.cpp',
        '_coverPosition.x + 124', '_coverPosition.x + 106')
replace('arm9/source/romBrowser/Theme/Material/MaterialFileInfoCardView.cpp',
        'Label2DView::CreateShared(108, 16, 48, fonts->GetFont(FontType::Medium7_5))',
        'Label2DView::CreateShared(116, 16, 48, fonts->GetFont(FontType::Medium7_5))')
replace('arm9/source/romBrowser/Theme/Material/MaterialFileInfoCardView.cpp',
        'line->SetPosition(140, 49 + i * 17)',
        'line->SetPosition(128, 49 + i * 17)')
replace('arm9/source/romBrowser/Theme/Material/MaterialFileInfoCardView.cpp',
        'u"A  PLAY        X  OPTIONS        B  BACK"',
        'u"A  PLAY          Y  INFO          B  BACK"')

print('DSpico UI v2 refinement complete')
