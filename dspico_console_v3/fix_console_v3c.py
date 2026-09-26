from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()

def rw(rel):
    p = root / rel
    return p, p.read_text(encoding='utf-8')

def replace(rel, old, new, count=1):
    p, s = rw(rel)
    n = s.count(old)
    if n < count:
        raise SystemExit(f'{rel}: expected >= {count}, found {n}: {old[:160]!r}')
    p.write_text(s.replace(old, new, count), encoding='utf-8')
    print('fixed', rel)

# ---------------------------------------------------------------------------
# 1) Keep the shared Raspberry background registered to the screens.
# The previous build continuously translated both the SUB affine bitmap and
# the MAIN texture coordinates, which made the upper-screen artwork drift.
# ---------------------------------------------------------------------------
replace('arm9/source/themes/custom/CustomSubBackground.cpp',
        'REG_BG2X_SUB = (ConsoleUiState::GetFrame() >> 2) << 8;',
        'REG_BG2X_SUB = 0;')
replace('arm9/source/themes/custom/CustomMainBackground.cpp',
        'const int phase = (ConsoleUiState::GetFrame() >> 2) & 255;',
        'const int phase = 0;')

# Give the generated background proper UI surfaces instead of relying on
# separate text-label rectangles floating over the artwork.  The upper screen
# gets one coherent information card plus a compact hint strip; the lower
# screen gets one continuous tab rail exactly between the two 32 px app-bar
# buttons.
replace('arm9/source/console/ConsoleUiState.cpp',
'''    int r = clamp255((c[0] * 3 + 255) / 4 + shade / 3);
    int g = clamp255((c[1] * 3 + 255) / 4 + shade / 3);
    int b = clamp255((c[2] * 3 + 255) / 4 + shade / 3);
    return 0x8000 | ((r >> 3) & 31) | (((g >> 3) & 31) << 5) | (((b >> 3) & 31) << 10);''',
'''    int r = clamp255((c[0] * 3 + 255) / 4 + shade / 3);
    int g = clamp255((c[1] * 3 + 255) / 4 + shade / 3);
    int b = clamp255((c[2] * 3 + 255) / 4 + shade / 3);

    const int localY = globalY < 192 ? globalY : globalY - 192;
    if (globalY < 192)
    {
        const bool infoCard = x >= 8 && x < 248 && localY >= 6 && localY < 170;
        const bool hintStrip = x >= 8 && x < 248 && localY >= 172 && localY < 190;
        if (infoCard || hintStrip)
        {
            r = 238; g = 241; b = 244;
        }
    }
    else if (x >= 32 && x < 224 && localY >= 5 && localY < 29)
    {
        r = 238; g = 241; b = 244;
    }

    return 0x8000 | ((r >> 3) & 31) | (((g >> 3) & 31) << 5) | (((b >> 3) & 31) << 10);''')

# ---------------------------------------------------------------------------
# 2) Recompose the upper screen.  Previously the title and clock occupied the
# same horizontal band, seven description lines nearly collided with the hint
# row, and the 11 pt title looked oversized at DS resolution.
# ---------------------------------------------------------------------------
rel = 'arm9/source/romBrowser/Theme/custom/CustomFileInfoView.cpp'
replace(rel,
'''    : _title(Label2DView::CreateShared(188,16,80,fonts->GetFont(FontType::Medium11)))
    , _status(Label2DView::CreateShared(92,16,32,fonts->GetFont(FontType::Medium7_5)))''',
'''    : _title(Label2DView::CreateShared(186,16,80,fonts->GetFont(FontType::Medium10)))
    , _status(Label2DView::CreateShared(84,16,32,fonts->GetFont(FontType::Medium7_5)))''')
replace(rel,
'''    _title->SetPosition(58,22);
    for(int i=0;i<(int)_desc.size();i++) _desc[i]->SetPosition(12,58+i*16);
    _status->SetPosition(156,4);
    _hint->SetPosition(12,172);
    if(_icon){ _icon->SetPosition(16,18); _icon->Update(); }''',
'''    _title->SetPosition(58,31);
    for(int i=0;i<(int)_desc.size();i++) _desc[i]->SetPosition(12,56+i*16);
    _status->SetPosition(164,10);
    _hint->SetPosition(12,174);
    if(_icon){ _icon->SetPosition(16,16); _icon->Update(); }''')
replace(rel,
'''    _hint->SetText(hints_areEnabled() ? "A Launch   Y Favorite   X Options   L/R Tabs" : "");''',
'''    _hint->SetText(hints_areEnabled() ? "A Start   X Options   Y Fav   L/R Tabs" : "");''')

# ---------------------------------------------------------------------------
# 3) Make the lower-screen library selector an actual tab bar.  The old build
# only painted five labels; they were neither touch targets nor a continuous
# control.  The rail now spans x=32..223 between brightness and settings.
# ---------------------------------------------------------------------------
replace('arm9/source/romBrowser/viewModels/RomBrowserAppBarViewModel.h',
'''    void CycleBacklight() { _controller->CycleBacklight(); }
    u8 GetLibraryTab() const { return _controller->GetLibraryTab(); }
    bool GetShowHints() const { return _controller->GetShowHints(); }''',
'''    void CycleBacklight() { _controller->CycleBacklight(); }
    u8 GetLibraryTab() const { return _controller->GetLibraryTab(); }
    void SelectLibraryTab(u8 tab)
    {
        if (tab > 4 || tab == GetLibraryTab()) return;
        _controller->CycleLibraryTab((int)tab - (int)GetLibraryTab());
    }
    bool GetShowHints() const { return _controller->GetShowHints(); }''')

replace('arm9/source/romBrowser/views/RomBrowserAppBarView.h',
'''    void Draw(GraphicsContext& graphicsContext) override;
    Rectangle GetBounds() const override { return Rectangle(0,0,256,192); }''',
'''    void Draw(GraphicsContext& graphicsContext) override;
    void HandlePenUp(const Point& lastTouchPoint, FocusManager& focusManager) override;
    Rectangle GetBounds() const override { return Rectangle(0,0,256,192); }''')

rel = 'arm9/source/romBrowser/views/RomBrowserAppBarView.cpp'
replace(rel,
'''    static const char16_t* names[5] = { u"★", u"DS", u"GBA", u"GBC", u"GB" };
    static const int x[5] = { 38, 72, 102, 140, 181 };
    static const int w[5] = { 24, 22, 30, 30, 24 };''',
'''    static const char16_t* names[5] = { u"FAV", u"DS", u"GBA", u"GBC", u"GB" };
    static const int x[5] = { 32, 70, 108, 146, 184 };
    static const int w[5] = { 38, 38, 38, 38, 40 };''')
replace(rel,
'''        _tabs[i]->SetPosition(x[i], 9);''',
'''        _tabs[i]->SetPosition(x[i], 9);''')
replace(rel,
'''        _tabs[i]->SetBackgroundColor(Rgb<8,8,8>(238, 241, 244));
        _tabs[i]->SetForegroundColor(i == active ? Rgb<8,8,8>(35, 92, 120) : Rgb<8,8,8>(64, 70, 76));''',
'''        _tabs[i]->SetBackgroundColor(i == active ? Rgb<8,8,8>(216, 233, 242) : Rgb<8,8,8>(238, 241, 244));
        _tabs[i]->SetForegroundColor(i == active ? Rgb<8,8,8>(24, 79, 108) : Rgb<8,8,8>(64, 70, 76));''')
replace(rel,
'''SharedPtr<View> RomBrowserAppBarView::MoveFocus(const SharedPtr<View>& currentFocus,
    FocusMoveDirection direction, View* source)''',
'''void RomBrowserAppBarView::HandlePenUp(const Point& p, FocusManager& focusManager)
{
    if (p.y >= 1 && p.y < 33 && p.x >= 32 && p.x < 224)
    {
        static const int edge[6] = { 32, 70, 108, 146, 184, 224 };
        for (u8 i = 0; i < 5; i++)
        {
            if (p.x >= edge[i] && p.x < edge[i + 1])
            {
                if (_viewModel->GetLibraryTab() != i)
                {
                    // The current list is about to be destroyed.  Clearing its
                    // weak focus lets FolderLoadDone focus the newly loaded row.
                    focusManager.Unfocus();
                    _viewModel->SelectLibraryTab(i);
                }
                return;
            }
        }
    }
    ViewContainer::HandlePenUp(p, focusManager);
}

SharedPtr<View> RomBrowserAppBarView::MoveFocus(const SharedPtr<View>& currentFocus,
    FocusMoveDirection direction, View* source)''')

# ---------------------------------------------------------------------------
# 4) Shoulder controls are global in the browser and predictable in dialogs.
# Browser: L/R always changes the library even when focus is null or sitting on
# an app-bar button, then the new game row receives focus when loading ends.
# Modal sheets: L/R mirrors horizontal D-pad navigation instead of changing a
# library behind the open window.
# ---------------------------------------------------------------------------
replace('arm9/source/App.cpp',
'''    else
    {
        _focusManager.Update(_inputRepeater);
    }
    Point touchPoint;''',
'''    else if (_romBrowserController.GetStateMachine().GetCurrentState() == RomBrowserState::Browser &&
             _inputRepeater.Triggered(InputKey::L | InputKey::R))
    {
        const int delta = _inputRepeater.Triggered(InputKey::L) ? -1 : 1;
        _focusListAfterFolderLoad = true;
        _romBrowserController.CycleLibraryTab(delta);
    }
    else
    {
        _focusManager.Update(_inputRepeater);
    }
    Point touchPoint;''')

replace('arm9/source/gui/FocusManager.cpp',
'''    else if (inputProvider.Triggered(InputKey::DpadRight))
    {
        newFocus = currentFocus->GetParent()->MoveFocus(currentFocus, FocusMoveDirection::Right, currentFocus.GetPointer());
    }
    else
    {
        currentFocus->HandleInput(inputProvider, *this);
    }''',
'''    else if (inputProvider.Triggered(InputKey::DpadRight))
    {
        newFocus = currentFocus->GetParent()->MoveFocus(currentFocus, FocusMoveDirection::Right, currentFocus.GetPointer());
    }
    else if (inputProvider.Triggered(InputKey::L))
    {
        newFocus = currentFocus->GetParent()->MoveFocus(currentFocus, FocusMoveDirection::Left, currentFocus.GetPointer());
    }
    else if (inputProvider.Triggered(InputKey::R))
    {
        newFocus = currentFocus->GetParent()->MoveFocus(currentFocus, FocusMoveDirection::Right, currentFocus.GetPointer());
    }
    else
    {
        currentFocus->HandleInput(inputProvider, *this);
    }''')

print('DSpico Console v3c layout/input fixes applied')
