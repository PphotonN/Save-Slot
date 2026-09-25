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
        raise SystemExit(f'{rel}: expected >= {count}, found {n}: {old[:120]!r}')
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

# Restore the last launched game selection on boot. The navigator accepts a full file path and
# selects that file after entering its parent directory. The Favorites tab below also uses that
# name to restore the cursor inside its virtual all-system library.
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

# ---------------------------------------------------------------------------
# Global Favorites: build a virtual SdFolder from the persisted favorite paths,
# so the ★ tab can show DS/GBA/GBC/GB together in the same CoverFlow.
# ---------------------------------------------------------------------------
replace('arm9/source/romBrowser/SdFolderFactory.h',
'''class SdFolderFactory
{''',
'''class IGameDataService;

class SdFolderFactory
{''')
replace('arm9/source/romBrowser/SdFolderFactory.h',
'''    std::unique_ptr<SdFolder> CreateFromPath(const char* path) const;''',
'''    std::unique_ptr<SdFolder> CreateFromPath(const char* path) const;
    std::unique_ptr<SdFolder> CreateFavorites(const IGameDataService* gameDataService) const;''')
replace('arm9/source/romBrowser/SdFolderFactory.cpp',
'''#include "FileType/Folder/FolderFileType.h"
#include "SdFolderFactory.h"''',
'''#include "FileType/Folder/FolderFileType.h"
#include "services/gamedata/IGameDataService.h"
#include "SdFolderFactory.h"''')
replace('arm9/source/romBrowser/SdFolderFactory.cpp',
'''namespace
{''',
r'''std::unique_ptr<SdFolder> SdFolderFactory::CreateFavorites(const IGameDataService* gameDataService) const
{
    int count = 0;
    int capacity = 8;
    auto fileInfos = (FileInfo**)malloc(sizeof(FileInfo*) * capacity);
    if (!fileInfos)
        return nullptr;

    for (u32 i = 0; i < gameDataService->GetEntryCount(); i++)
    {
        const auto& entry = gameDataService->GetEntryByIndex(i);
        if (!entry.favorite || entry.path.GetString()[0] == 0)
            continue;

        char parent[256];
        StringUtil::Copy(parent, entry.path.GetString(), sizeof(parent));
        char* slash = strrchr(parent, '/');
        if (!slash || slash[1] == 0)
            continue;
        const char* fileName = slash + 1;
        char wanted[IGameDataService::kMaxFileNameLength + 1];
        StringUtil::Copy(wanted, fileName, sizeof(wanted));
        *slash = 0;
        if (parent[0] == 0)
            StringUtil::Copy(parent, "/", sizeof(parent));

        Directory directory;
        if (directory.Open(parent) != FR_OK)
            continue;
        FILINFO fileInfo;
        while (directory.Read(&fileInfo) == FR_OK && fileInfo.fname[0] != 0)
        {
            if (strcasecmp(fileInfo.fname, wanted) != 0)
                continue;
            if (fileInfo.fattrib & AM_DIR)
                break;
            if (count >= capacity)
            {
                capacity *= 2;
                auto grown = (FileInfo**)realloc(fileInfos, sizeof(FileInfo*) * capacity);
                if (!grown)
                {
                    for (int j = 0; j < count; j++) delete fileInfos[j];
                    free(fileInfos);
                    return nullptr;
                }
                fileInfos = grown;
            }
            const FileType* fileType = _fileTypeProvider->GetFileType(fileInfo.fname);
            if (fileType->GetClassification() != FileTypeClassification::Unknown)
                fileInfos[count++] = new FileInfo(fileInfo.fname, fileType,
                    FastFileRef(directory.GetFatFsDirectory(), &fileInfo), fileInfo.fattrib);
            break;
        }
    }
    return std::make_unique<SdFolder>(fileInfos, count);
}

namespace
{''')

# Choose the virtual Favorites folder when ★ is the active library.
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''        f_chdir(_navigatePath);
        SdFolderFactory sdFolderFactory { &_fileTypeProvider };
        _newSdFolder = sdFolderFactory.CreateFromPath(".");''',
'''        f_chdir(_navigatePath);
        SdFolderFactory sdFolderFactory { &_fileTypeProvider };
        if (_appSettingsService->GetAppSettings().libraryTab == 0)
            _newSdFolder = sdFolderFactory.CreateFavorites(_gameDataService);
        else
            _newSdFolder = sdFolderFactory.CreateFromPath(".");''')
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''    BackfillFavoritePaths();
}''',
'''    if (_appSettingsService->GetAppSettings().libraryTab != 0)
        BackfillFavoritePaths();
}''', 1)

# In the virtual Favorites library the cwd is not the selected game's real folder. Use the
# persisted full path for Y and A instead of reconstructing a path from cwd.
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''    TCHAR fullPath[256];
    BuildCurrentFolderFilePath(fileInfo.GetFileName(), fullPath,
        sizeof(fullPath) / sizeof(fullPath[0]));
    _gameDataService->ToggleFavorite(fileInfo.GetFileName(), gameCode, fullPath);''',
'''    TCHAR fullPath[256];
    const auto* existing = _gameDataService->GetEntry(fileInfo.GetFileName());
    if (_appSettingsService->GetAppSettings().libraryTab == 0 && existing && existing->path.GetString()[0])
        StringUtil::Copy(fullPath, existing->path.GetString(), sizeof(fullPath));
    else
        BuildCurrentFolderFilePath(fileInfo.GetFileName(), fullPath,
            sizeof(fullPath) / sizeof(fullPath[0]));
    _gameDataService->ToggleFavorite(fileInfo.GetFileName(), gameCode, fullPath);''')
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''    TCHAR fullPath[256];
    BuildCurrentFolderFilePath(_triggerFileInfo.GetFileName(), fullPath,
        sizeof(fullPath) / sizeof(fullPath[0]));
    _gameDataService->RecordLaunch(_triggerFileInfo.GetFileName(),''',
'''    TCHAR fullPath[256];
    const auto* selectedEntry = _gameDataService->GetEntry(_triggerFileInfo.GetFileName());
    if (_appSettingsService->GetAppSettings().libraryTab == 0 && selectedEntry && selectedEntry->path.GetString()[0])
    {
        StringUtil::Copy(fullPath, selectedEntry->path.GetString(), sizeof(fullPath));
        StringUtil::Copy(_navigatePath, fullPath, sizeof(_navigatePath));
    }
    else
    {
        BuildCurrentFolderFilePath(_triggerFileInfo.GetFileName(), fullPath,
            sizeof(fullPath) / sizeof(fullPath[0]));
    }
    _gameDataService->RecordLaunch(_triggerFileInfo.GetFileName(),''')
replace('arm9/source/romBrowser/RomBrowserController.cpp',
'''void RomBrowserController::UpdateLastUsedFilepath()
{
    f_getcwd(_navigatePath, sizeof(_navigatePath) / sizeof(_navigatePath[0]));''',
'''void RomBrowserController::UpdateLastUsedFilepath()
{
    if (_appSettingsService->GetAppSettings().libraryTab == 0)
    {
        _appSettingsService->GetAppSettings().lastUsedFilePath = _navigatePath;
        _appSettingsService->Save();
        return;
    }
    f_getcwd(_navigatePath, sizeof(_navigatePath) / sizeof(_navigatePath[0]));''')

print('DSpico Console v3 follow-up fixes applied')
