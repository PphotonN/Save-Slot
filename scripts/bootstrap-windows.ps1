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
  Write-Host ('[SETUP] ' + $Message) -ForegroundColor Cyan
}

function Add-LocalRuntimeToPath {
  $parts = @($NodeRoot, $PnpmRoot)
  foreach ($part in $parts) {
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
  if (-not (Test-Path -LiteralPath $Executable)) {
    return $false
  }

  try {
    Add-LocalRuntimeToPath
    $actual = (& $Executable --version 2>$null).Trim().TrimStart([char]'v')
    return $actual -eq $ExpectedVersion
  } catch {
    return $false
  }
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
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $NodeRoot
  Remove-Item -Force -ErrorAction SilentlyContinue $archivePath

  Invoke-WebRequest -UseBasicParsing -Uri ($downloadBase + '/' + $archiveName) -OutFile $archivePath

  Write-Step 'Verifying the official Node.js SHA-256 checksum...'
  $checksumDocument = (Invoke-WebRequest -UseBasicParsing -Uri ($downloadBase + '/SHASUMS256.txt')).Content
  $checksumPattern = '\s+' + [regex]::Escape($archiveName) + '\s*$'
  $checksumLine = $checksumDocument -split "`n" | Where-Object {
    $_ -match $checksumPattern
  } | Select-Object -First 1

  if (-not $checksumLine) {
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
    throw ('Unable to locate SHA-256 for ' + $archiveName + '.')
  }

  $expectedHash = (($checksumLine.Trim() -split '\s+')[0]).ToLowerInvariant()
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
    throw 'The Node.js SHA-256 checksum does not match. The downloaded file was removed.'
  }

  Write-Step 'Extracting portable Node.js...'
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force
  $extractedDirectory = Join-Path $extractRoot ('node-v' + $NodeVersion + '-win-' + $nodeArchitecture)
  if (-not (Test-Path -LiteralPath $extractedDirectory)) {
    throw 'The Node.js archive has an unexpected directory structure.'
  }

  Move-Item -LiteralPath $extractedDirectory -Destination $NodeRoot
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
  Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
  Add-LocalRuntimeToPath

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
}

function Ensure-LocalConfiguration {
  $webExample = Join-Path $ProjectRoot 'apps\web\.env.example'
  $webEnvironment = Join-Path $ProjectRoot 'apps\web\.env'
  $apiExample = Join-Path $ProjectRoot 'apps\api\.dev.vars.example'
  $apiEnvironment = Join-Path $ProjectRoot 'apps\api\.dev.vars'

  if (-not (Test-Path -LiteralPath $webExample)) {
    throw 'Missing apps\web\.env.example.'
  }
  if (-not (Test-Path -LiteralPath $apiExample)) {
    throw 'Missing apps\api\.dev.vars.example.'
  }

  if (-not (Test-Path -LiteralPath $webEnvironment)) {
    Write-Step 'Creating apps\web\.env...'
    Copy-Item -LiteralPath $webExample -Destination $webEnvironment
  }

  if (-not (Test-Path -LiteralPath $apiEnvironment)) {
    Write-Step 'Creating apps\api\.dev.vars...'
    Copy-Item -LiteralPath $apiExample -Destination $apiEnvironment
  }
}

function Install-ProjectDependencies {
  Write-Step 'Installing or updating Save Slot dependencies...'
  Add-LocalRuntimeToPath

  Push-Location $ProjectRoot
  try {
    & $PnpmCmd install --prefer-offline --frozen-lockfile=false
    if ($LASTEXITCODE -ne 0) {
      throw ('pnpm install failed. Exit code: ' + $LASTEXITCODE)
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
    Write-Step ('Local Node.js ' + $NodeVersion + ' is ready.')
  }

  Add-LocalRuntimeToPath

  if (-not (Test-Path -LiteralPath $NpmCmd)) {
    throw 'npm.cmd is missing from the portable Node.js runtime.'
  }

  Install-LocalPnpm
  Ensure-LocalConfiguration
  Install-ProjectDependencies

  Write-Host '[READY] Save Slot local environment is ready.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host ''
  Write-Host ('[ERROR] ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'The first launch requires Internet access. Administrator rights are not required.' -ForegroundColor Yellow
  exit 1
}
