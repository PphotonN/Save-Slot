param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = '20.19.0'
$PnpmVersion = '10.14.0'
$RuntimeRoot = Join-Path $ProjectRoot '.runtime'
$NodeRoot = Join-Path $RuntimeRoot 'node'
$PnpmRoot = Join-Path $RuntimeRoot 'pnpm'
$NodeExe = Join-Path $NodeRoot 'node.exe'
$NpmCmd = Join-Path $NodeRoot 'npm.cmd'
$PnpmCmd = Join-Path $PnpmRoot 'pnpm.cmd'

function Write-Step([string]$Message) {
  Write-Host "[SETUP] $Message" -ForegroundColor Cyan
}

function Get-NodeArchitecture {
  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  switch ($architecture) {
    'X64' { return 'x64' }
    'Arm64' { return 'arm64' }
    default { throw "Непідтримувана архітектура Windows: $architecture. Потрібна 64-бітна Windows." }
  }
}

function Test-ExactVersion([string]$Executable, [string]$ExpectedVersion) {
  if (-not (Test-Path -LiteralPath $Executable)) { return $false }
  try {
    $actual = (& $Executable --version 2>$null).Trim().TrimStart('v')
    return $actual -eq $ExpectedVersion
  } catch {
    return $false
  }
}

function Install-PortableNode {
  $nodeArchitecture = Get-NodeArchitecture
  $archiveName = "node-v$NodeVersion-win-$nodeArchitecture.zip"
  $archivePath = Join-Path $RuntimeRoot $archiveName
  $extractRoot = Join-Path $RuntimeRoot 'node-extract'
  $downloadBase = "https://nodejs.org/dist/v$NodeVersion"

  Write-Step "Завантажую portable Node.js $NodeVersion для $nodeArchitecture..."
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $NodeRoot

  Invoke-WebRequest -UseBasicParsing -Uri "$downloadBase/$archiveName" -OutFile $archivePath

  Write-Step 'Перевіряю контрольну суму Node.js...'
  $checksumDocument = (Invoke-WebRequest -UseBasicParsing -Uri "$downloadBase/SHASUMS256.txt").Content
  $checksumLine = ($checksumDocument -split "`n" | Where-Object {
    $_ -match "\s+$([regex]::Escape($archiveName))\s*$"
  } | Select-Object -First 1)

  if (-not $checksumLine) {
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
    throw "Не вдалося знайти SHA-256 для $archiveName."
  }

  $expectedHash = (($checksumLine.Trim() -split '\s+')[0]).ToLowerInvariant()
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
    throw 'Контрольна сума Node.js не збігається. Завантажений файл видалено.'
  }

  Write-Step 'Розпаковую локальний Node.js...'
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force
  $extractedDirectory = Join-Path $extractRoot "node-v$NodeVersion-win-$nodeArchitecture"
  if (-not (Test-Path -LiteralPath $extractedDirectory)) {
    throw 'Архів Node.js має неочікувану структуру.'
  }

  Move-Item -LiteralPath $extractedDirectory -Destination $NodeRoot
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
  Remove-Item -Force -ErrorAction SilentlyContinue $archivePath

  if (-not (Test-ExactVersion $NodeExe $NodeVersion)) {
    throw 'Portable Node.js встановлено некоректно.'
  }
}

function Install-LocalPnpm {
  if (Test-ExactVersion $PnpmCmd $PnpmVersion) { return }

  Write-Step "Встановлюю локальний pnpm $PnpmVersion..."
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $PnpmRoot
  New-Item -ItemType Directory -Force -Path $PnpmRoot | Out-Null

  $previousPrefix = $env:npm_config_prefix
  $env:npm_config_prefix = $PnpmRoot
  try {
    & $NpmCmd install --global "pnpm@$PnpmVersion" --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) {
      throw "npm завершив установлення pnpm з кодом $LASTEXITCODE."
    }
  } finally {
    $env:npm_config_prefix = $previousPrefix
  }

  if (-not (Test-ExactVersion $PnpmCmd $PnpmVersion)) {
    throw 'pnpm встановлено некоректно.'
  }
}

function Ensure-LocalConfiguration {
  $webExample = Join-Path $ProjectRoot 'apps\web\.env.example'
  $webEnvironment = Join-Path $ProjectRoot 'apps\web\.env'
  $apiExample = Join-Path $ProjectRoot 'apps\api\.dev.vars.example'
  $apiEnvironment = Join-Path $ProjectRoot 'apps\api\.dev.vars'

  if (-not (Test-Path -LiteralPath $webEnvironment)) {
    Write-Step 'Створюю apps\web\.env...'
    Copy-Item -LiteralPath $webExample -Destination $webEnvironment
  }
  if (-not (Test-Path -LiteralPath $apiEnvironment)) {
    Write-Step 'Створюю apps\api\.dev.vars...'
    Copy-Item -LiteralPath $apiExample -Destination $apiEnvironment
  }
}

function Install-ProjectDependencies {
  Write-Step 'Перевіряю та встановлюю залежності Save Slot...'
  $env:PATH = "$NodeRoot;$PnpmRoot;$env:PATH"
  Push-Location $ProjectRoot
  try {
    & $PnpmCmd install --prefer-offline --frozen-lockfile=false
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm install завершився з кодом $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

try {
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null

  if (-not (Test-ExactVersion $NodeExe $NodeVersion)) {
    Install-PortableNode
  } else {
    Write-Step "Локальний Node.js $NodeVersion уже готовий."
  }

  if (-not (Test-Path -LiteralPath $NpmCmd)) {
    throw 'У portable Node.js відсутній npm.cmd.'
  }

  Install-LocalPnpm
  Ensure-LocalConfiguration
  Install-ProjectDependencies

  Write-Host '[READY] Локальне середовище Save Slot готове.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host ''
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Перший запуск потребує доступу до Інтернету. Права адміністратора не потрібні.' -ForegroundColor Yellow
  exit 1
}
