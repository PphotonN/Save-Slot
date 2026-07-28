param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,

  [Parameter(Mandatory = $true)]
  [string]$NodeExecutable,

  [Parameter(Mandatory = $true)]
  [string]$PnpmCommand,

  [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$NodeExecutable = [System.IO.Path]::GetFullPath($NodeExecutable)
$PnpmCommand = [System.IO.Path]::GetFullPath($PnpmCommand)
$ProbeScript = Join-Path $ProjectRoot 'scripts\service-probe.mjs'
$RunnerScript = Join-Path $ProjectRoot 'scripts\run-service-windows.cmd'
$SmokeLogDirectory = Join-Path $ProjectRoot '.runtime\smoke-logs'
$startedProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]

function Assert-File([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw ($Label + ' not found: ' + $Path)
  }
}

function Quote-CmdArgument([string]$Value) {
  return '"' + $Value.Replace('"', '""') + '"'
}

function Add-PortableRuntimeToPath {
  foreach ($path in @((Split-Path -Parent $NodeExecutable), (Split-Path -Parent $PnpmCommand))) {
    if (($env:Path -split ';') -notcontains $path) {
      $env:Path = $path + ';' + $env:Path
    }
  }
  $env:npm_config_update_notifier = 'false'
  $env:WRANGLER_SEND_METRICS = 'false'
}

function Invoke-ServiceProbe(
  [ValidateSet('probe', 'wait')]
  [string]$Mode,
  [pscustomobject]$Service
) {
  $arguments = @(
    $ProbeScript,
    $Mode,
    '--url', $Service.HealthUrl,
    '--service', $Service.ServiceId,
    '--timeout-ms', [string]$Service.TimeoutMs,
    '--quiet'
  )
  if ($Service.ValidateProjectRoot) {
    $arguments += @('--project-root', $ProjectRoot)
  }

  & $NodeExecutable @arguments
  return $LASTEXITCODE
}

function Test-ServicePortFree([pscustomobject]$Service) {
  & $NodeExecutable $ProbeScript port-free --host $Service.Host --port $Service.Port --quiet
  return $LASTEXITCODE -eq 0
}

function Start-ServiceTerminal([pscustomobject]$Service) {
  if ($SmokeTest) {
    New-Item -ItemType Directory -Force -Path $SmokeLogDirectory | Out-Null
    $safeName = $Service.ServiceId -replace '[^a-zA-Z0-9_-]', '-'
    $standardOutput = Join-Path $SmokeLogDirectory ($safeName + '.out.log')
    $standardError = Join-Path $SmokeLogDirectory ($safeName + '.err.log')
    Remove-Item -Force -ErrorAction SilentlyContinue $standardOutput, $standardError

    $commandLine = @(
      '/d /c call',
      (Quote-CmdArgument $PnpmCommand),
      $Service.Command
    ) -join ' '
    $startArguments = @{
      FilePath = $env:ComSpec
      ArgumentList = $commandLine
      WorkingDirectory = $ProjectRoot
      PassThru = $true
      WindowStyle = 'Hidden'
      RedirectStandardOutput = $standardOutput
      RedirectStandardError = $standardError
    }
    $Service | Add-Member -NotePropertyName StandardOutput -NotePropertyValue $standardOutput -Force
    $Service | Add-Member -NotePropertyName StandardError -NotePropertyValue $standardError -Force
  } else {
    $commandLine = @(
      '/d /c call',
      (Quote-CmdArgument $RunnerScript),
      (Quote-CmdArgument $Service.WindowTitle),
      (Quote-CmdArgument $ProjectRoot),
      (Quote-CmdArgument $PnpmCommand),
      $Service.Command
    ) -join ' '
    $startArguments = @{
      FilePath = $env:ComSpec
      ArgumentList = $commandLine
      WorkingDirectory = $ProjectRoot
      PassThru = $true
    }
  }

  $process = Start-Process @startArguments
  $startedProcesses.Add($process)
  return $process
}

function Show-ServiceLogs([pscustomobject]$Service) {
  if (-not $SmokeTest) { return }
  foreach ($entry in @(
    [pscustomobject]@{ Label = 'stdout'; Path = $Service.StandardOutput },
    [pscustomobject]@{ Label = 'stderr'; Path = $Service.StandardError }
  )) {
    Write-Host ('--- ' + $Service.DisplayName + ' ' + $entry.Label + ' ---')
    if (Test-Path -LiteralPath $entry.Path -PathType Leaf) {
      Get-Content -LiteralPath $entry.Path
    } else {
      Write-Host '(no log file)'
    }
  }
}

function Stop-StartedServices {
  foreach ($process in $startedProcesses) {
    if ($process.HasExited) { continue }
    & taskkill.exe /PID $process.Id /T /F *> $null
  }
}

function Ensure-Service([pscustomobject]$Service) {
  $probeCode = Invoke-ServiceProbe -Mode probe -Service $Service
  if ($probeCode -eq 0) {
    Write-Host ('[READY] ' + $Service.DisplayName + ' already running.') -ForegroundColor Green
    return
  }
  if ($probeCode -eq 2) {
    throw ('Port ' + $Service.Port + ' responds, but it is not the expected ' + $Service.DisplayName + '.')
  }
  if (-not (Test-ServicePortFree $Service)) {
    throw ('Port ' + $Service.Port + ' is occupied. Close the program using it and launch Save Slot again.')
  }

  Write-Host ('[START] ' + $Service.DisplayName + ': ' + $Service.BaseUrl) -ForegroundColor Cyan
  Start-ServiceTerminal $Service | Out-Null
  $waitCode = Invoke-ServiceProbe -Mode wait -Service $Service
  if ($waitCode -eq 0) {
    Write-Host ('[READY] ' + $Service.DisplayName) -ForegroundColor Green
    return
  }

  Show-ServiceLogs $Service
  if ($Service.Optional -and -not $SmokeTest) {
    Write-Host ('[WARN] ' + $Service.DisplayName + ' did not become ready. The web app will use its offline fallback.') -ForegroundColor Yellow
    return
  }

  throw ($Service.DisplayName + ' did not become ready. Check its terminal window for the exact error.')
}

Assert-File $NodeExecutable 'Portable Node.js'
Assert-File $PnpmCommand 'Local pnpm'
Assert-File $ProbeScript 'Service probe'
Assert-File $RunnerScript 'Windows service runner'
if ([string]::IsNullOrWhiteSpace($env:ComSpec) -or -not (Test-Path -LiteralPath $env:ComSpec)) {
  throw 'Windows command processor (ComSpec) is not available.'
}
Add-PortableRuntimeToPath

$services = @(
  [pscustomobject]@{
    DisplayName = 'Save Slot Library'
    WindowTitle = 'Save Slot Library'
    ServiceId = 'save-slot-library-cache'
    Command = 'dev:library'
    Host = '127.0.0.1'
    Port = 8791
    BaseUrl = 'http://127.0.0.1:8791'
    HealthUrl = 'http://127.0.0.1:8791/health'
    TimeoutMs = 20000
    ValidateProjectRoot = $true
    Optional = $false
  },
  [pscustomobject]@{
    DisplayName = 'Save Slot API'
    WindowTitle = 'Save Slot API'
    ServiceId = 'save-slot-api'
    Command = 'dev:api'
    Host = '127.0.0.1'
    Port = 8787
    BaseUrl = 'http://127.0.0.1:8787'
    HealthUrl = 'http://127.0.0.1:8787/health'
    TimeoutMs = 45000
    ValidateProjectRoot = $false
    Optional = $true
  },
  [pscustomobject]@{
    DisplayName = 'Save Slot Web'
    WindowTitle = 'Save Slot Web'
    ServiceId = 'save-slot-web'
    Command = 'dev'
    Host = '127.0.0.1'
    Port = 5173
    BaseUrl = 'http://127.0.0.1:5173'
    HealthUrl = 'http://127.0.0.1:5173/health.json'
    TimeoutMs = 60000
    ValidateProjectRoot = $false
    Optional = $false
  }
)

try {
  foreach ($service in $services) {
    Ensure-Service $service
  }

  if ($SmokeTest) {
    Stop-StartedServices
    Write-Host ''
    Write-Host '[READY] Windows first-launch smoke test passed.' -ForegroundColor Green
    exit 0
  }

  Start-Process -FilePath 'http://127.0.0.1:5173'
  Write-Host ''
  Write-Host '[READY] Save Slot launched successfully.' -ForegroundColor Green
  Write-Host 'Collection file: .save-slot-data\library.json'
  Write-Host 'Close the Save Slot service windows to stop the application.'
  exit 0
} catch {
  Stop-StartedServices
  Write-Host ''
  Write-Host ('[ERROR] ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
