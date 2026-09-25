from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
p=root/'arm9/source/romBrowser/FileType/CustomFileType.h'
s=p.read_text(encoding='utf-8')
old='baseFileType != nullptr ? baseFileType->GetClassification() : FileTypeClassification::Misc)'
new='baseFileType != nullptr ? baseFileType->GetClassification() : FileTypeClassification::Game)'
if s.count(old)!=1:
    raise SystemExit(f'CustomFileType classification match count: {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('GB/GBC custom associations classified as games')
