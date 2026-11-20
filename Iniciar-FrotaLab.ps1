$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNode = $null
$taskCandidates = @(Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
foreach ($taskCandidate in $taskCandidates) {
  if ($taskCandidate -and (Test-Path -LiteralPath $taskCandidate)) {
    $taskVersion = & $taskCandidate --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $taskVersion -match '^v(\d+)' -and [int]$Matches[1] -ge 22) { $taskNode = $taskCandidate; break }
  }
}
if (-not $taskNode) { throw 'Instale Node.js 22 ou superior e execute novamente.' }
$env:PATH = (Split-Path -Parent $taskNode) + ';' + $env:PATH
if (-not (Test-Path -LiteralPath 'front-end\node_modules\next\package.json')) {
  $taskPnpm = Get-Command pnpm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
  if ($taskPnpm) {
    cmd /c "`"$taskPnpm`" --version >nul 2>&1"
    if ($LASTEXITCODE -ne 0) { $taskPnpm = $null }
  }
  if (-not $taskPnpm) { throw 'Instale pnpm 11 e execute pnpm install --frozen-lockfile.' }
  & $taskPnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar as dependências.' }
}
& $taskNode scripts/dev.mjs
