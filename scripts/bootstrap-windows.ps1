param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$NodeVersion = '24.18.0'
$PnpmVersion = '10.14.0'
$WranglerVersion = '4.114.0'
$RuntimeRoot = Join-Path $ProjectRoot '.runtime'
$NodeRoot = Join-Path $RuntimeRoot 'node'
$PnpmRoot = Join-Path $RuntimeRoot 'pnpm'
$NodeExe = Join-Path $NodeRoot 'node.exe'
$NpmCmd = Join-Path $NodeRoot 'npm.cmd'
$PnpmCmd = Join-Path $PnpmRoot 'pnpm.cmd'
$WranglerCmd = Join-Path $ProjectRoot 'apps\api\node_modules\.bin\wrangler.cmd'
$DependencyStamp = Join-Path $RuntimeRoot 'dependencies.sha256'
$script:NodeRuntimeChanged = $false
$script:DependencyRefreshRequired = $false

function Write-Step([string]$Message) {
  Write-Host ('[SETUP] ' + $Message) -ForegroundColor Cyan
}

function Write-Utf8NoBom([string]$Path, [string[]]$Lines) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($Path, $Lines, $encoding)
}

function Assert-Workspace {
  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw ('Project folder not found: ' + $ProjectRoot)
  }

  foreach ($relativePath in @(
    'package.json',
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml',
    'apps\web\package.json',
    'apps\web\.env.example',
    'apps\api\package.json',
    'apps\api\.dev.vars.example'
  )) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw ('Required project file is missing: ' + $relativePath)
    }
  }
}

function Add-LocalRuntimeToPath {
  foreach ($part in @($NodeRoot, $PnpmRoot)) {
    if (($env:Path -split ';') -notcontains $part) {
      $env:Path = $part + ';' + $env:Path
    }
  }
}

function Get-NodeArchitecture {
  $architecture = $env:PROCESSOR_ARCHITEW6432
  if ([string]::IsNullOrWhiteSpace($architecture)) {
    $architecture = $env:PROCESSOR_ARCHITECTURE
  }

  switch -Regex ($architecture) {
    '^ARM64$' { return 'arm64' }
    '^(AMD64|x86_64)$' { return 'x64' }
    default { throw ('Unsupported Windows architecture: ' + $architecture) }
  }
}

function Test-ExactVersion([string]$Executable, [string]$ExpectedVersion) {
  if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
    return $false
  }

  try {
    Add-LocalRuntimeToPath
    $output = @(& $Executable --version 2>$null)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0 -or $output.Count -eq 0) {
      return $false
    }

    $versionPattern = '(?<!\d)v?(\d+\.\d+\.\d+)(?!\d)'
    $matches = [regex]::Matches(($output -join "`n"), $versionPattern)
    foreach ($match in $matches) {
      if ($match.Groups[1].Value -eq $ExpectedVersion) {
        return $true
      }
    }
    return $false
  } catch {
    return $false
  }
}

function Get-WorkspaceFingerprint {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($relativePath in @('package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml')) {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $ProjectRoot $relativePath)).Hash
    $parts.Add($relativePath + ':' + $hash)
  }
  $parts.Add('node:' + $NodeVersion)
  $parts.Add('pnpm:' + $PnpmVersion)

  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($parts -join "`n"))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Check-DependencyStamp {
  $expected = Get-WorkspaceFingerprint
  if (-not (Test-Path -LiteralPath $DependencyStamp -PathType Leaf)) {
    $script:DependencyRefreshRequired = $true
    return $expected
  }

  $actual = (Get-Content -LiteralPath $DependencyStamp -Raw).Trim()
  if ($actual -ne $expected) {
    $script:DependencyRefreshRequired = $true
  }
  return $expected
}

function Install-PortableNode {
  $nodeArchitecture = Get-NodeArchitecture
  $archiveName = 'node-v' + $NodeVersion + '-win-' + $nodeArchitecture + '.zip'
  $archivePath = Join-Path $RuntimeRoot $archiveName
  $extractRoot = Join-Path $RuntimeRoot 'node-extract'
  $downloadBase = 'https://nodejs.org/dist/v' + $NodeVersion

  Write-Step ('Downloading portable Node.js ' + $NodeVersion + ' for ' + $nodeArchitecture + '...')
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
  Remove-Item -Force -ErrorAction SilentlyContinue $archivePath

  try {
    Invoke-WebRequest -UseBasicParsing -Uri ($downloadBase + '/' + $archiveName) -OutFile $archivePath

    Write-Step 'Verifying the official Node.js SHA-256 checksum...'
    $checksumDocument = (Invoke-WebRequest -UseBasicParsing -Uri ($downloadBase + '/SHASUMS256.txt')).Content
    $checksumPattern = '\s+' + [regex]::Escape($archiveName) + '\s*$'
    $checksumLine = $checksumDocument -split "`n" | Where-Object {
      $_ -match $checksumPattern
    } | Select-Object -First 1

    if (-not $checksumLine) {
      throw ('Unable to locate SHA-256 for ' + $archiveName + '.')
    }

    $expectedHash = (($checksumLine.Trim() -split '\s+')[0]).ToLowerInvariant()
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
      throw 'The Node.js SHA-256 checksum does not match.'
    }

    Write-Step 'Extracting portable Node.js...'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force
    $extractedDirectory = Join-Path $extractRoot ('node-v' + $NodeVersion + '-win-' + $nodeArchitecture)
    if (-not (Test-Path -LiteralPath $extractedDirectory -PathType Container)) {
      throw 'The Node.js archive has an unexpected directory structure.'
    }

    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $NodeRoot
    Move-Item -LiteralPath $extractedDirectory -Destination $NodeRoot
  } finally {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
  }

  Add-LocalRuntimeToPath
  $script:NodeRuntimeChanged = $true
  $script:DependencyRefreshRequired = $true

  if (-not (Test-ExactVersion $NodeExe $NodeVersion)) {
    throw 'Portable Node.js validation failed after extraction.'
  }
}

function Install-LocalPnpm {
  Add-LocalRuntimeToPath

  if (Test-ExactVersion $PnpmCmd $PnpmVersion) {
    Write-Step ('Local pnpm ' + $PnpmVersion + ' is ready.')
    return
  }

  Write-Step ('Installing local pnpm ' + $PnpmVersion + '...')
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $PnpmRoot
  New-Item -ItemType Directory -Force -Path $PnpmRoot | Out-Null

  $previousPrefix = $env:npm_config_prefix
  $env:npm_config_prefix = $PnpmRoot
  try {
    & $NpmCmd install --global ('pnpm@' + $PnpmVersion) --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) {
      throw ('npm failed to install pnpm. Exit code: ' + $LASTEXITCODE)
    }
  } finally {
    $env:npm_config_prefix = $previousPrefix
  }

  Add-LocalRuntimeToPath
  if (-not (Test-ExactVersion $PnpmCmd $PnpmVersion)) {
    throw ('Local pnpm validation failed. Expected executable: ' + $PnpmCmd)
  }
  $script:DependencyRefreshRequired = $true
}

function Ensure-EnvironmentSetting(
  [string]$Path,
  [string]$Key,
  [string]$DefaultValue,
  [string]$OldDefaultValue = ''
) {
  $lines = @(Get-Content -LiteralPath $Path)
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='
  $index = -1
  for ($position = 0; $position -lt $lines.Count; $position += 1) {
    if ($lines[$position] -match $pattern) {
      $index = $position
      break
    }
  }

  $changed = $false
  if ($index -lt 0) {
    $lines += ($Key + '=' + $DefaultValue)
    $changed = $true
  } elseif (-not [string]::IsNullOrWhiteSpace($OldDefaultValue)) {
    $currentValue = ($lines[$index] -split '=', 2)[1].Trim()
    if ($currentValue -eq $OldDefaultValue) {
      $lines[$index] = $Key + '=' + $DefaultValue
      $changed = $true
    }
  }

  if ($changed) {
    Write-Utf8NoBom -Path $Path -Lines $lines
  }
}

function Ensure-LocalConfiguration {
  $webExample = Join-Path $ProjectRoot 'apps\web\.env.example'
  $webEnvironment = Join-Path $ProjectRoot 'apps\web\.env'
  $apiExample = Join-Path $ProjectRoot 'apps\api\.dev.vars.example'
  $apiEnvironment = Join-Path $ProjectRoot 'apps\api\.dev.vars'

  if (-not (Test-Path -LiteralPath $webEnvironment -PathType Leaf)) {
    Write-Step 'Creating apps\web\.env...'
    Copy-Item -LiteralPath $webExample -Destination $webEnvironment
  }
  Ensure-EnvironmentSetting -Path $webEnvironment -Key 'VITE_SAVE_SLOT_API_URL' -DefaultValue 'http://127.0.0.1:8787' -OldDefaultValue 'http://localhost:8787'

  if (-not (Test-Path -LiteralPath $apiEnvironment -PathType Leaf)) {
    Write-Step 'Creating apps\api\.dev.vars...'
    Copy-Item -LiteralPath $apiExample -Destination $apiEnvironment
  }
  Ensure-EnvironmentSetting -Path $apiEnvironment -Key 'ALLOWED_ORIGIN' -DefaultValue '*'
}

function Check-WorkspaceToolVersions {
  Add-LocalRuntimeToPath
  if (-not (Test-ExactVersion $WranglerCmd $WranglerVersion)) {
    $script:DependencyRefreshRequired = $true
    Write-Step ('Wrangler must be installed or repaired at version ' + $WranglerVersion + '.')
  }
}

function Install-ProjectDependencies([string]$ExpectedFingerprint) {
  Write-Step 'Installing or validating Save Slot dependencies...'
  Add-LocalRuntimeToPath

  $installArguments = @('install', '--prefer-offline', '--frozen-lockfile')
  if ($script:DependencyRefreshRequired -or $script:NodeRuntimeChanged) {
    $installArguments += '--force'
    Write-Step 'Refreshing workspace dependencies for the pinned runtime and lockfile...'
  }

  $previousUpdateNotifier = $env:npm_config_update_notifier
  $previousMetrics = $env:WRANGLER_SEND_METRICS
  $env:npm_config_update_notifier = 'false'
  $env:WRANGLER_SEND_METRICS = 'false'
  Push-Location $ProjectRoot
  try {
    & $PnpmCmd @installArguments
    if ($LASTEXITCODE -ne 0) {
      throw ('pnpm install failed. Exit code: ' + $LASTEXITCODE)
    }
  } finally {
    Pop-Location
    $env:npm_config_update_notifier = $previousUpdateNotifier
    $env:WRANGLER_SEND_METRICS = $previousMetrics
  }

  if (-not (Test-ExactVersion $WranglerCmd $WranglerVersion)) {
    throw ('Wrangler validation failed. Expected version: ' + $WranglerVersion)
  }

  Write-Utf8NoBom -Path $DependencyStamp -Lines @($ExpectedFingerprint)
}

try {
  Assert-Workspace
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null

  if (-not (Test-ExactVersion $NodeExe $NodeVersion)) {
    Install-PortableNode
  } else {
    Write-Step ('Local Node.js ' + $NodeVersion + ' is ready.')
  }

  Add-LocalRuntimeToPath
  if (-not (Test-Path -LiteralPath $NpmCmd -PathType Leaf)) {
    throw 'npm.cmd is missing from the portable Node.js runtime.'
  }

  Install-LocalPnpm
  Ensure-LocalConfiguration
  $expectedFingerprint = Check-DependencyStamp
  Check-WorkspaceToolVersions
  Install-ProjectDependencies -ExpectedFingerprint $expectedFingerprint

  Write-Host '[READY] Save Slot local environment is ready.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host ''
  Write-Host ('[ERROR] ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'The first launch requires Internet access. Administrator rights are not required.' -ForegroundColor Yellow
  exit 1
}
