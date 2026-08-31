$ErrorActionPreference = "Stop"

$repository = Split-Path -Parent $PSScriptRoot
$electronPath = Join-Path $repository "node_modules\electron\dist\electron.exe"
$shell = New-Object -ComObject WScript.Shell
$title = "Maglucen Companion Development"
$launcherMutex = New-Object System.Threading.Mutex($false, "Local\MaglucenCompanionDevelopmentLauncher")
$ownsLauncher = $false

try {
  $ownsLauncher = $launcherMutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
  $ownsLauncher = $true
}

function Get-DevelopmentMainProcess {
  if (-not (Test-Path -LiteralPath $electronPath)) {
    return $null
  }

  $normalizedRepository = [System.IO.Path]::GetFullPath($repository).TrimEnd("\")
  $normalizedElectron = [System.IO.Path]::GetFullPath($electronPath)

  Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      if (-not $_.ExecutablePath -or -not $_.CommandLine) {
        return $false
      }

      $sameExecutable = [System.StringComparer]::OrdinalIgnoreCase.Equals(
        [System.IO.Path]::GetFullPath($_.ExecutablePath),
        $normalizedElectron
      )
      $mainProcess = $_.CommandLine -notmatch "(?:^|\s)--type="
      $projectEntryPoint = $_.CommandLine -notmatch "\\scripts\\|\\node_modules\\vinext\\|\\\.local\\"
      $sameRepository = $_.CommandLine.IndexOf(
        $normalizedRepository,
        [System.StringComparison]::OrdinalIgnoreCase
      ) -ge 0

      $sameExecutable -and $mainProcess -and $projectEntryPoint -and $sameRepository
    } |
    Select-Object -First 1
}

function Show-DevelopmentWindow {
  param($DevelopmentProcess)
  if (-not $DevelopmentProcess) {
    return $false
  }

  # The short-lived second Electron process notifies the existing instance.
  # Its exit code is irrelevant: the requested outcome is revealing the first.
  & $electronPath $repository *> $null
  return $true
}

if (-not $ownsLauncher) {
  for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    if (Show-DevelopmentWindow (Get-DevelopmentMainProcess)) {
      exit 0
    }
    Start-Sleep -Milliseconds 250
  }

  $null = $shell.Popup(
    "The development app is still starting. Wait a moment and try again.",
    0,
    $title,
    48
  )
  exit 1
}

$development = Get-DevelopmentMainProcess
if (Show-DevelopmentWindow $development) {
  exit 0
}

Set-Location -LiteralPath $repository

try {
  & npm.cmd run desktop:dev
  if ($LASTEXITCODE -ne 0) {
    throw "npm run desktop:dev exited with code $LASTEXITCODE."
  }
} catch {
  $null = $shell.Popup(
    "The development app could not start.`n`n$($_.Exception.Message)",
    0,
    $title,
    16
  )
  exit 1
}
