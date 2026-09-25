from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()

def rw(rel):
    p = root / rel
    return p, p.read_text(encoding='utf-8')

def write(rel, text):
    p = root / rel
    p.write_text(text, encoding='utf-8')
    print('fixed', rel)

def replace(rel, old, new, count=1):
    p, s = rw(rel)
    n = s.count(old)
    if n < count:
        raise SystemExit(f'{rel}: expected >= {count}, found {n}: {old[:100]!r}')
    p.write_text(s.replace(old, new, count), encoding='utf-8')
    print('fixed', rel)

# Keep touch selection/launch behaviour while using the requested physical-button map.
write('arm9/source/romBrowser/views/RomBrowserItemInputHandler.cpp', r'''#include "common.h"
#include "gui/FocusManager.h"
#include "gui/input/InputProvider.h"
#include "gui/views/View.h"
#include "romBrowser/viewModels/IRomBrowserItemViewModel.h"
#include "RomBrowserItemInputHandler.h"

#define LONG_PRESS_FRAMES 30

bool RomBrowserItemInputHandler::HandleInput(const InputProvider& inputProvider, FocusManager& focusManager)
{
    if (inputProvider.Triggered(InputKey::A))
    {
        _viewModel->Activate();
        return true;
    }
    if (inputProvider.Triggered(InputKey::Y))
    {
        _viewModel->ToggleFavorite();
        return true;
    }
    if (inputProvider.Triggered(InputKey::X))
    {
        _viewModel->ShowGameInfo();
        return true;
    }
    return false;
}

void RomBrowserItemInputHandler::HandlePenDown(const Point& touchPoint, FocusManager& focusManager)
{
    if (_view->GetBounds().Contains(touchPoint))
    {
        _penDown = true;
        _penDownFrames = 0;
    }
}

void RomBrowserItemInputHandler::HandlePenMove(const Point& touchPoint, FocusManager& focusManager)
{
    if (_penDown && _view->GetBounds().Contains(touchPoint))
    {
        if (++_penDownFrames == LONG_PRESS_FRAMES)
        {
            if (focusManager.GetCurrentFocus().GetPointer() != _view)
                focusManager.Focus(_view->SharedFromThis());
            _viewModel->ShowGameInfo();
            _penDown = false;
        }
    }
    else
    {
        _penDown = false;
    }
}

void RomBrowserItemInputHandler::HandlePenUp(const Point& lastTouchPoint, FocusManager& focusManager)
{
    if (_penDown && _view->GetBounds().Contains(lastTouchPoint))
    {
        if (focusManager.GetCurrentFocus().GetPointer() == _view)
            _viewModel->Activate();
        else
            focusManager.Focus(_view->SharedFromThis());
    }
    _penDown = false;
}
''')

# Top screen is icon/name/description only; CoverFlow owns all cover art on the bottom screen.
replace('arm9/source/romBrowser/views/RomBrowserTopScreenView.cpp',
        ', _showCover(displayMode->ShowCoverOnTopScreen())',
        ', _showCover(false)')

# Metadata object is stack-owned, so copy it synchronously into the custom labels.
replace('arm9/source/romBrowser/views/RomBrowserTopScreenView.cpp',
        '_fileInfoView->SetGameTitleAsync(_viewModel->GetBgTaskQueue(), metadata.GetTitleAndDescription());',
        '_fileInfoView->SetGameTitleAsync(nullptr, metadata.GetTitleAndDescription());')

# Restore the last launched game selection on boot. The enhanced navigator already accepts a
# complete file path and selects that file after entering its parent directory.
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''            auto& settings = _appSettingsService->GetAppSettings();
            _favoritesFilter = settings.libraryTab == 0;
            NavigateToPath(GetLibraryPath(settings.libraryTab));''',
'''            auto& settings = _appSettingsService->GetAppSettings();
            _favoritesFilter = settings.libraryTab == 0;
            const auto& lastUsed = settings.lastUsedFilePath;
            if (strlen(lastUsed.GetString()) != 0)
                NavigateToPath(lastUsed.GetString());
            else
                NavigateToPath(GetLibraryPath(settings.libraryTab));''')

# Brightness changes from the toolbar must be persisted too, not only settings-sheet changes.
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''void RomBrowserController::CycleBacklight()
{
    int level = GetBacklightLevel();
    if (level < 0) level = 0;
    SetBacklightLevel((level + 1) & 3);
}''',
'''void RomBrowserController::CycleBacklight()
{
    int level = GetBacklightLevel();
    if (level < 0) level = 0;
    SetBacklightLevel((level + 1) & 3);
    _ioTaskQueue->Enqueue([this] (const vu8&)
    {
        _appSettingsService->Save();
        _saveSettingsPending = false;
        return TaskResult<void>::Completed();
    });
}''')

print('DSpico Console v3 follow-up fixes applied')
