param(
  [ValidateSet('all', 'web', 'android')]
  [string]$Scope = 'all',
  [string]$Device = ''
)

$ErrorActionPreference = 'Stop'

function Require-EnvironmentVariable([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ([string]::IsNullOrWhiteSpace($value)) { throw "Falta la variable de entorno $Name." }
}

function Run-Command([string]$Label, [scriptblock]$Command) {
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label terminó con código $LASTEXITCODE." }
}

if ($Scope -in @('all', 'web')) {
  @(
    'E2E_STUDENT_EMAIL', 'E2E_STUDENT_PASSWORD',
    'E2E_TEACHER_EMAIL', 'E2E_TEACHER_PASSWORD',
    'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'
  ) | ForEach-Object { Require-EnvironmentVariable $_ }

  Run-Command 'Web desktop + web móvil · matriz principal + profunda' {
    npx playwright test e2e/web/authenticated-visual.spec.ts e2e/web/authenticated-deep-visual.spec.ts --workers=1 --project=chromium-desktop --project=chromium-mobile
  }
}

if ($Scope -in @('all', 'android')) {
  $roleMap = @{
    'MAESTRO_STUDENT_EMAIL' = 'E2E_STUDENT_EMAIL'
    'MAESTRO_STUDENT_PASSWORD' = 'E2E_STUDENT_PASSWORD'
    'MAESTRO_TEACHER_EMAIL' = 'E2E_TEACHER_EMAIL'
    'MAESTRO_TEACHER_PASSWORD' = 'E2E_TEACHER_PASSWORD'
    'MAESTRO_ADMIN_EMAIL' = 'E2E_ADMIN_EMAIL'
    'MAESTRO_ADMIN_PASSWORD' = 'E2E_ADMIN_PASSWORD'
  }

  foreach ($pair in $roleMap.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($pair.Key, 'Process'))) {
      $fallback = [Environment]::GetEnvironmentVariable($pair.Value, 'Process')
      if (-not [string]::IsNullOrWhiteSpace($fallback)) { [Environment]::SetEnvironmentVariable($pair.Key, $fallback, 'Process') }
    }
    Require-EnvironmentVariable $pair.Key
  }

  if (-not (Get-Command maestro -ErrorAction SilentlyContinue)) { throw 'Maestro no está disponible en PATH.' }
  if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { throw 'ADB no está disponible en PATH.' }

  $adbRows = @(adb devices | Select-Object -Skip 1 | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $offline = @($adbRows | Where-Object { $_ -match "\toffline$" })
  if ($offline.Count -gt 0) { throw 'ADB todavía muestra dispositivos offline. Elimínalos antes de ejecutar Maestro para evitar que bloquee la detección.' }

  $connectedIds = @($adbRows | Where-Object { $_ -match "\tdevice$" } | ForEach-Object { ($_ -split "\s+")[0] })
  if ($connectedIds.Count -eq 0) { throw 'No hay ningún dispositivo Android conectado y operativo.' }
  if (-not $Device -and $connectedIds.Count -gt 1) { throw 'Hay varios dispositivos Android operativos. Usa -Device para indicar cuál debe auditarse.' }

  $resolvedDevice = if ($Device) { $Device } else { $connectedIds[0] }
  if ($resolvedDevice -notin $connectedIds) { throw "El dispositivo $resolvedDevice no aparece como device en ADB." }

  adb -s $resolvedDevice shell input keyevent KEYCODE_WAKEUP | Out-Null
  adb -s $resolvedDevice shell wm dismiss-keyguard | Out-Null
  adb -s $resolvedDevice shell svc power stayon true | Out-Null

  Remove-Item -Recurse -Force .artifacts\maestro\final -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force .artifacts\maestro\final | Out-Null

  $deviceArgs = @('--device', $resolvedDevice)

  $flows = @(
    @{ Name = 'Student principal'; Out = '.artifacts/maestro/final/student-main'; File = '.maestro/student-ui-capture.yaml' },
    @{ Name = 'Student profundo'; Out = '.artifacts/maestro/final/student-deep'; File = '.maestro/student-deep-ui-capture.yaml' },
    @{ Name = 'Teacher principal'; Out = '.artifacts/maestro/final/teacher-main'; File = '.maestro/teacher-ui-capture.yaml' },
    @{ Name = 'Teacher profundo'; Out = '.artifacts/maestro/final/teacher-deep'; File = '.maestro/teacher-deep-ui-capture.yaml' },
    @{ Name = 'Admin principal'; Out = '.artifacts/maestro/final/admin-main'; File = '.maestro/admin-ui-capture.yaml' },
    @{ Name = 'Admin profundo'; Out = '.artifacts/maestro/final/admin-deep'; File = '.maestro/admin-deep-ui-capture.yaml' },
    @{ Name = 'Teclado Android'; Out = '.artifacts/maestro/final/keyboard'; File = '.maestro/android-keyboard-resize.yaml' }
  )

  foreach ($flow in $flows) {
    Write-Host "`n=== Android · $($flow.Name) ===" -ForegroundColor Cyan
    $args = @() + $deviceArgs + @('test', '--test-output-dir=' + $flow.Out, $flow.File)
    & maestro @args
    if ($LASTEXITCODE -ne 0) { throw "El flujo $($flow.Name) terminó con código $LASTEXITCODE." }
  }
}

Write-Host "`nEvidencia visual final generada correctamente." -ForegroundColor Green
