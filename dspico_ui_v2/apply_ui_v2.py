from pathlib import Path
import sys

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path('.').resolve()

def p(rel): return ROOT / rel

def replace(rel, old, new):
    f=p(rel); s=f.read_text(encoding='utf-8')
    n=s.count(old)
    if n != 1: raise SystemExit(f'{rel}: expected 1 match, found {n}')
    f.write_text(s.replace(old,new,1), encoding='utf-8')
    print('patched',rel)

def write(rel, data):
    f=p(rel); f.parent.mkdir(parents=True, exist_ok=True); f.write_text(data, encoding='utf-8'); print('wrote',rel)

# Persistent display dim control.
replace('arm9/source/services/settings/RomBrowserDisplaySettings.h',
'''#pragma once\n#include "RomBrowserLayout.h"''',
'''#pragma once\n#include "common.h"\n#include "RomBrowserLayout.h"''')
replace('arm9/source/services/settings/RomBrowserDisplaySettings.h',
'''    RomBrowserSortMode sortMode = RomBrowserSortMode::NameAscending;\n};''',
'''    RomBrowserSortMode sortMode = RomBrowserSortMode::NameAscending;\n    u8 screenDim = 0; // 0..12, even values; 0 is full brightness\n};''')

rel='arm9/source/services/settings/JsonAppSettingsSerializer.thumb.cpp'
replace(rel, '#define KEY_ROM_BROWSER_SORT_MODE    "romBrowserSortMode"\n#define KEY_THEME', '#define KEY_ROM_BROWSER_SORT_MODE    "romBrowserSortMode"\n#define KEY_SCREEN_DIM               "screenDim"\n#define KEY_THEME')
replace(rel, '    json[KEY_ROM_BROWSER_SORT_MODE] = serializeRomBrowserSortMode(appSettings->romBrowserDisplaySettings.sortMode);\n    json[KEY_THEME]', '    json[KEY_ROM_BROWSER_SORT_MODE] = serializeRomBrowserSortMode(appSettings->romBrowserDisplaySettings.sortMode);\n    json[KEY_SCREEN_DIM] = appSettings->romBrowserDisplaySettings.screenDim;\n    json[KEY_THEME]')
replace(rel,
'''    if (tryParseRomBrowserSortMode(json[KEY_ROM_BROWSER_SORT_MODE].as<const char*>(),\n            romBrowserSortMode))\n    {\n        appSettings->romBrowserDisplaySettings.sortMode = romBrowserSortMode;\n    }\n\n    tryParseFileAssociations''',
'''    if (tryParseRomBrowserSortMode(json[KEY_ROM_BROWSER_SORT_MODE].as<const char*>(),\n            romBrowserSortMode))\n    {\n        appSettings->romBrowserDisplaySettings.sortMode = romBrowserSortMode;\n    }\n    u32 screenDim = json[KEY_SCREEN_DIM] | appSettings->romBrowserDisplaySettings.screenDim;\n    if (screenDim > 12) screenDim = 12;\n    appSettings->romBrowserDisplaySettings.screenDim = (u8)(screenDim & ~1u);\n\n    tryParseFileAssociations''')

rel='arm9/source/romBrowser/viewModels/DisplaySettingsViewModel.h'
replace(rel, '#pragma once\n#include "../IRomBrowserController.h"', '#pragma once\n#include "common.h"\n#include <libtwl/gfx/gfx.h>\n#include "../IRomBrowserController.h"')
replace(rel,
'''    void Close()\n    {\n        _romBrowserController->HideDisplaySettings();\n    }''',
'''    constexpr u8 GetScreenDim() const { return _romBrowserDisplaySettings.screenDim; }\n\n    void SetScreenDim(u8 value)\n    {\n        if (value > 12) value = 12;\n        value &= ~1u;\n        if (_romBrowserDisplaySettings.screenDim == value) return;\n        _romBrowserDisplaySettings.screenDim = value;\n        _romBrowserController->SetRomBrowserDisplaySettings(_romBrowserDisplaySettings);\n        const u16 reg = value ? (0x8000 | value) : 0;\n        REG_MASTER_BRIGHT = reg;\n        REG_MASTER_BRIGHT_SUB = reg;\n    }\n\n    void Close()\n    {\n        _romBrowserController->HideDisplaySettings();\n    }''')

replace('arm9/source/App.cpp',
'''                    REG_BLDCNT_SUB = 0;\n                    REG_DISPCNT_SUB &= ~(1 << 9);\n                    REG_MASTER_BRIGHT = 0;\n                }''',
'''                    REG_BLDCNT_SUB = 0;\n                    REG_DISPCNT_SUB &= ~(1 << 9);\n                    u8 dim = _appSettingsService.GetAppSettings().romBrowserDisplaySettings.screenDim;\n                    if (dim > 12) dim = 12;\n                    const u16 reg = dim ? (0x8000 | dim) : 0;\n                    REG_MASTER_BRIGHT = reg;\n                    REG_MASTER_BRIGHT_SUB = reg;\n                }''')
replace('arm9/source/settings/SettingsProcess.cpp',
'''                fadeIn = false;\n                REG_BLDCNT_SUB = 0;\n                REG_MASTER_BRIGHT = 0;\n                REG_MASTER_BRIGHT_SUB = 0;\n            }''',
'''                fadeIn = false;\n                REG_BLDCNT_SUB = 0;\n                u8 dim = _appSettingsService.GetAppSettings().romBrowserDisplaySettings.screenDim;\n                if (dim > 12) dim = 12;\n                const u16 reg = dim ? (0x8000 | dim) : 0;\n                REG_MASTER_BRIGHT = reg;\n                REG_MASTER_BRIGHT_SUB = reg;\n            }''')

rel='arm9/source/romBrowser/views/DisplaySettingsBottomSheetView.h'
replace(rel, '    SharedPtr<Label2DView> _sortingLabel;\n\n    std::array', '    SharedPtr<Label2DView> _sortingLabel;\n    SharedPtr<Label2DView> _brightnessLabel;\n    SharedPtr<Label2DView> _footerLabel;\n\n    std::array')

rel='arm9/source/romBrowser/views/DisplaySettingsBottomSheetView.cpp'
replace(rel, '#define TITLE_LABEL_X       20\n#define TITLE_LABEL_Y       16', '#define TITLE_LABEL_X       16\n#define TITLE_LABEL_Y       14')
replace(rel, '#define LAYOUT_LABEL_X      20\n#define LAYOUT_LABEL_Y      46\n\n#define SORTING_LABEL_X     20\n#define SORTING_LABEL_Y     78', '#define LAYOUT_LABEL_X      16\n#define LAYOUT_LABEL_Y      50\n\n#define SORTING_LABEL_X     16\n#define SORTING_LABEL_Y     86\n\n#define BRIGHTNESS_LABEL_X  16\n#define BRIGHTNESS_LABEL_Y  122\n#define FOOTER_LABEL_X      16\n#define FOOTER_LABEL_Y      154')
replace(rel,
'''    , _sortingLabel(Label2DView::CreateShared(64, 16, 25, fontRepository->GetFont(FontType::Regular10)))\n    , _materialColorScheme(materialColorScheme)''',
'''    , _sortingLabel(Label2DView::CreateShared(64, 16, 25, fontRepository->GetFont(FontType::Regular10)))\n    , _brightnessLabel(Label2DView::CreateShared(224, 16, 64, fontRepository->GetFont(FontType::Regular10)))\n    , _footerLabel(Label2DView::CreateShared(224, 16, 64, fontRepository->GetFont(FontType::Medium7_5)))\n    , _materialColorScheme(materialColorScheme)''')
replace(rel,
'''    _sortingLabel->SetText(u"Sorting");\n    AddChildTail(_sortingLabel.GetPointer());''',
'''    _sortingLabel->SetText(u"Sort");\n    AddChildTail(_sortingLabel.GetPointer());\n    AddChildTail(_brightnessLabel.GetPointer());\n    _footerLabel->SetText(u"X / Y  brightness      B  back");\n    AddChildTail(_footerLabel.GetPointer());''')
replace(rel,
'''    _sortingLabel->SetPosition(SORTING_LABEL_X, _position.y + SORTING_LABEL_Y);\n}''',
'''    _sortingLabel->SetPosition(SORTING_LABEL_X, _position.y + SORTING_LABEL_Y);\n    _brightnessLabel->SetPosition(BRIGHTNESS_LABEL_X, _position.y + BRIGHTNESS_LABEL_Y);\n    _footerLabel->SetPosition(FOOTER_LABEL_X, _position.y + FOOTER_LABEL_Y);\n}''')
replace(rel, '        layoutOption->SetPosition(x, _position.y + 38);', '        layoutOption->SetPosition(x + 14, _position.y + 42);')
replace(rel, '        sortOption->SetPosition(x, _position.y + 70);', '        sortOption->SetPosition(x + 14, _position.y + 78);')
replace(rel,
'''        x += 32;\n        idx++;\n    }\n}\n\nvoid DisplaySettingsBottomSheetView::Draw''',
'''        x += 32;\n        idx++;\n    }\n\n    static const char16_t* level[] =\n    {\n        u"Brightness     100%", u"Brightness      85%", u"Brightness      70%",\n        u"Brightness      55%", u"Brightness      40%", u"Brightness      30%",\n        u"Brightness      20%"\n    };\n    _brightnessLabel->SetText(level[_viewModel->GetScreenDim() / 2]);\n}\n\nvoid DisplaySettingsBottomSheetView::Draw''')
replace(rel,
'''        _sortingLabel->SetBackgroundColor(_materialColorScheme->GetColor(md::sys::color::surfaceContainerLow));\n        _sortingLabel->SetForegroundColor(_materialColorScheme->onSurfaceVariant);\n        BottomSheetView::Draw(graphicsContext);''',
'''        _sortingLabel->SetBackgroundColor(_materialColorScheme->GetColor(md::sys::color::surfaceContainerLow));\n        _sortingLabel->SetForegroundColor(_materialColorScheme->onSurfaceVariant);\n        _brightnessLabel->SetBackgroundColor(_materialColorScheme->GetColor(md::sys::color::surfaceContainerLow));\n        _brightnessLabel->SetForegroundColor(_materialColorScheme->onSurface);\n        _footerLabel->SetBackgroundColor(_materialColorScheme->GetColor(md::sys::color::surfaceContainerLow));\n        _footerLabel->SetForegroundColor(_materialColorScheme->onSurfaceVariant);\n        BottomSheetView::Draw(graphicsContext);''')
replace(rel,
'''{\n    if (inputProvider.Triggered(InputKey::B))''',
'''{\n    if (inputProvider.Triggered(InputKey::X))\n    {\n        u8 dim = _viewModel->GetScreenDim();\n        if (dim < 12) _viewModel->SetScreenDim(dim + 2);\n        return true;\n    }\n    if (inputProvider.Triggered(InputKey::Y))\n    {\n        u8 dim = _viewModel->GetScreenDim();\n        if (dim >= 2) _viewModel->SetScreenDim(dim - 2);\n        return true;\n    }\n    if (inputProvider.Triggered(InputKey::B))''')

replace('arm9/source/romBrowser/Theme/Material/MaterialRomBrowserViewFactory.h', '        return Point(75, 18);', '        return Point(8, 48);')
replace('arm9/source/romBrowser/views/RomBrowserTopScreenView.cpp', '    int x1 = std::clamp(_coverPosition.x + 106, 0, 256);', '    int x1 = std::clamp(_coverPosition.x + 124, 0, 256);')
replace('arm9/source/romBrowser/views/RomBrowserTopScreenView.cpp', '#include "../Theme/IRomBrowserViewFactory.h"\n#include "RomBrowserTopScreenView.h"', '#include "../Theme/IRomBrowserViewFactory.h"\n#include "../RetroLibraryMetadata.h"\n#include "RomBrowserTopScreenView.h"')
replace('arm9/source/romBrowser/views/RomBrowserTopScreenView.cpp',
'''            bool fileNameAsTitle = true;\n            const char16_t* gameTitle = info ? info->GetGameTitle() : nullptr;\n            if (gameTitle && gameTitle[0] != 0)\n            {\n                _fileInfoView->SetGameTitleAsync(_viewModel->GetBgTaskQueue(), gameTitle);\n                fileNameAsTitle = false;\n            }''',
'''            RetroLibraryMetadata libraryMetadata;\n            const bool hasLibraryMetadata = libraryMetadata.Load(item.GetFileName());\n\n            bool fileNameAsTitle = true;\n            if (hasLibraryMetadata)\n            {\n                _fileInfoView->SetGameTitle(libraryMetadata.GetDisplayText());\n                fileNameAsTitle = false;\n            }\n            else\n            {\n                const char16_t* gameTitle = info ? info->GetGameTitle() : nullptr;\n                if (gameTitle && gameTitle[0] != 0)\n                {\n                    _fileInfoView->SetGameTitleAsync(_viewModel->GetBgTaskQueue(), gameTitle);\n                    fileNameAsTitle = false;\n                }\n            }''')

write('arm9/source/romBrowser/Theme/Material/MaterialFileInfoCardView.h', r'''#pragma once
#include <array>
#include "core/task/TaskQueue.h"
#include "gui/views/Label2DView.h"
#include "../../views/BannerView.h"

class MaterialColorScheme;
class IFontRepository;

class MaterialFileInfoCardView : public BannerView
{
    SHARED_ONLY(MaterialFileInfoCardView)
public:
    void InitVram(const VramContext& vramContext) override { ViewContainer::InitVram(vramContext); }
    void Update() override;
    void Draw(GraphicsContext& graphicsContext) override;
    void SetFirstLineAsync(TaskQueueBase* q, const char* t, bool e) override;
    void SetFirstLineAsync(TaskQueueBase* q, const char16_t* t, bool e) override;
    void SetFirstLineAsync(TaskQueueBase* q, const char16_t* t, u32 l, bool e) override;
    void SetSecondLineAsync(TaskQueueBase* q, const char16_t* t) override;
    void SetSecondLineAsync(TaskQueueBase* q, const char16_t* t, u32 l) override;
    void SetThirdLineAsync(TaskQueueBase* q, const char16_t* t) override;
    void SetThirdLineAsync(TaskQueueBase* q, const char16_t* t, u32 l) override;
    void SetFileNameAsync(TaskQueueBase* q, const TCHAR* name, bool useAsTitle) override
    { if (useAsTitle) BannerView::SetFileNameAsync(q, name, true); }
    Rectangle GetBounds() const override { return Rectangle(0, 0, 256, 192); }
private:
    SharedPtr<Label2DView> _title;
    SharedPtr<Label2DView> _meta;
    std::array<SharedPtr<Label2DView>, 6> _description;
    SharedPtr<Label2DView> _hint;
    const MaterialColorScheme* _scheme;
    MaterialFileInfoCardView(const MaterialColorScheme*, const IFontRepository*);
    void SetDescription(const char16_t* text, u32 length);
};
''')

write('arm9/source/romBrowser/Theme/Material/MaterialFileInfoCardView.cpp', r'''#include "common.h"
#include <algorithm>
#include "gui/GraphicsContext.h"
#include "themes/material/MaterialColorScheme.h"
#include "themes/IFontRepository.h"
#include "MaterialFileInfoCardView.h"

MaterialFileInfoCardView::MaterialFileInfoCardView(const MaterialColorScheme* scheme,
    const IFontRepository* fonts)
    : _title(Label2DView::CreateShared(232, 16, 128, fonts->GetFont(FontType::Medium11)))
    , _meta(Label2DView::CreateShared(232, 16, 128, fonts->GetFont(FontType::Medium7_5)))
    , _hint(Label2DView::CreateShared(232, 16, 96, fonts->GetFont(FontType::Medium7_5)))
    , _scheme(scheme)
{
    _title->SetEllipsisStyle(LabelView::EllipsisStyle::Ellipsis);
    _meta->SetEllipsisStyle(LabelView::EllipsisStyle::Ellipsis);
    AddChildTail(_title.GetPointer());
    AddChildTail(_meta.GetPointer());
    for (auto& line : _description)
    {
        line = Label2DView::CreateShared(108, 16, 48, fonts->GetFont(FontType::Medium7_5));
        line->SetEllipsisStyle(LabelView::EllipsisStyle::None);
        AddChildTail(line.GetPointer());
    }
    _hint->SetText(u"A  PLAY        X  OPTIONS        B  BACK");
    AddChildTail(_hint.GetPointer());
}

void MaterialFileInfoCardView::Update()
{
    ViewContainer::Update();
    _title->SetPosition(12, 8);
    _meta->SetPosition(12, 27);
    for (u32 i = 0; i < _description.size(); i++) _description[i]->SetPosition(140, 49 + i * 17);
    _hint->SetPosition(12, 172);
}

void MaterialFileInfoCardView::Draw(GraphicsContext& gc)
{
    const auto bg = _scheme->inverseOnSurface;
    _title->SetBackgroundColor(bg); _title->SetForegroundColor(_scheme->onSurface);
    _meta->SetBackgroundColor(bg); _meta->SetForegroundColor(_scheme->onSurfaceVariant);
    for (auto& line : _description) { line->SetBackgroundColor(bg); line->SetForegroundColor(_scheme->onSurface); }
    _hint->SetBackgroundColor(bg); _hint->SetForegroundColor(_scheme->onSurfaceVariant);
    ViewContainer::Draw(gc);
}

void MaterialFileInfoCardView::SetFirstLineAsync(TaskQueueBase* q, const char* t, bool e)
{ _title->SetEllipsisStyle(e ? LabelView::EllipsisStyle::Ellipsis : LabelView::EllipsisStyle::None); if (q) _title->SetTextAsync(q, t); else _title->SetText(t); }
void MaterialFileInfoCardView::SetFirstLineAsync(TaskQueueBase* q, const char16_t* t, bool e)
{ _title->SetEllipsisStyle(e ? LabelView::EllipsisStyle::Ellipsis : LabelView::EllipsisStyle::None); if (q) _title->SetTextAsync(q, t); else _title->SetText(t); }
void MaterialFileInfoCardView::SetFirstLineAsync(TaskQueueBase* q, const char16_t* t, u32 l, bool e)
{ _title->SetEllipsisStyle(e ? LabelView::EllipsisStyle::Ellipsis : LabelView::EllipsisStyle::None); if (q) _title->SetTextAsync(q, t, l); else _title->SetText(t, l); }
void MaterialFileInfoCardView::SetSecondLineAsync(TaskQueueBase* q, const char16_t* t)
{ if (q) _meta->SetTextAsync(q, t); else _meta->SetText(t); }
void MaterialFileInfoCardView::SetSecondLineAsync(TaskQueueBase* q, const char16_t* t, u32 l)
{ if (q) _meta->SetTextAsync(q, t, l); else _meta->SetText(t, l); }
void MaterialFileInfoCardView::SetThirdLineAsync(TaskQueueBase*, const char16_t* t)
{ u32 l = 0; if (t) while (t[l]) l++; SetDescription(t, l); }
void MaterialFileInfoCardView::SetThirdLineAsync(TaskQueueBase*, const char16_t* t, u32 l)
{ SetDescription(t, l); }

void MaterialFileInfoCardView::SetDescription(const char16_t* text, u32 length)
{
    if (!text) { for (auto& line : _description) line->SetText(u""); return; }
    u32 pos = 0;
    for (u32 row = 0; row < _description.size(); row++)
    {
        while (pos < length && (text[pos] == u' ' || text[pos] == u'\n' || text[pos] == u'\r')) pos++;
        if (pos >= length || text[pos] == 0) { _description[row]->SetText(u""); continue; }
        const u32 maxChars = 20;
        u32 end = std::min(pos + maxChars, length);
        if (end < length && text[end] && text[end] != u' ' && text[end] != u'\n')
        {
            u32 back = end;
            while (back > pos + 6 && text[back] != u' ' && text[back] != u'\n') back--;
            if (back > pos + 6) end = back;
        }
        u32 trim = end; while (trim > pos && text[trim - 1] == u' ') trim--;
        _description[row]->SetText(text + pos, trim - pos);
        pos = end;
    }
}
''')

write('arm9/source/romBrowser/RetroLibraryMetadata.h', r'''#pragma once
#include "common.h"
class RetroLibraryMetadata
{
public:
    bool Load(const TCHAR* fileName);
    const char16_t* GetDisplayText() const { return _displayText; }
private:
    char16_t _displayText[640] = {};
    static void Utf8ToUtf16(const char* src, char16_t* dst, u32 count);
};
''')

write('arm9/source/romBrowser/RetroLibraryMetadata.cpp', r'''#include "common.h"
#include <cstdio>
#include <memory>
#include "json/ArduinoJson.h"
#include "fat/File.h"
#include "RetroLibraryMetadata.h"

void RetroLibraryMetadata::Utf8ToUtf16(const char* src, char16_t* dst, u32 count)
{
    if (!dst || count == 0) return;
    const unsigned char* s = reinterpret_cast<const unsigned char*>(src ? src : "");
    u32 out = 0;
    while (*s && out + 1 < count)
    {
        u32 cp;
        if (*s < 0x80) cp = *s++;
        else if ((*s & 0xE0) == 0xC0 && s[1]) { cp = ((*s & 0x1F) << 6) | (s[1] & 0x3F); s += 2; }
        else if ((*s & 0xF0) == 0xE0 && s[1] && s[2]) { cp = ((*s & 0x0F) << 12) | ((s[1] & 0x3F) << 6) | (s[2] & 0x3F); s += 3; }
        else { cp = '?'; s++; }
        dst[out++] = static_cast<char16_t>(cp);
    }
    dst[out] = 0;
}

bool RetroLibraryMetadata::Load(const TCHAR* fileName)
{
    _displayText[0] = 0;
    if (!fileName || !fileName[0]) return false;
    char path[512]; std::snprintf(path, sizeof(path), "/_pico/metadata/user/%s.json", fileName);
    File f; if (f.Open(path, FA_READ | FA_OPEN_EXISTING) != FR_OK) return false;
    const u32 size = f.GetSize(); if (!size || size > 8192) return false;
    std::unique_ptr<u8[]> bytes(new(cache_align) u8[size + 1]);
    u32 read = 0; if (f.Read(bytes.get(), size, read) != FR_OK || read != size) return false; bytes[size] = 0;
    DynamicJsonDocument json(4096); if (deserializeJson(json, bytes.get(), size) != DeserializationError::Ok) return false;
    const char* title = json["title"] | ""; const char* publisher = json["publisher"] | "";
    const char* description = json["shortDescription"] | ""; const int year = json["year"] | 0;
    if (!title[0] && !description[0]) return false;
    char composed[1200];
    if (year > 0 && publisher[0]) std::snprintf(composed, sizeof(composed), "%s\n%d  |  %s\n%s", title, year, publisher, description);
    else if (year > 0) std::snprintf(composed, sizeof(composed), "%s\n%d\n%s", title, year, description);
    else if (publisher[0]) std::snprintf(composed, sizeof(composed), "%s\n%s\n%s", title, publisher, description);
    else std::snprintf(composed, sizeof(composed), "%s\n\n%s", title, description);
    Utf8ToUtf16(composed, _displayText, sizeof(_displayText) / sizeof(_displayText[0]));
    return true;
}
''')

print('DSpico UI v2 patch complete')
