# ctOS launcher for Windows Terminal.
# Starts the dashboard server (hidden, mock mode) if it isn't already up, then
# drops you into the terminal-native ctOS HUD. The graphical HUD is one command
# away (start http://localhost:7050). Nothing here touches the scope gate.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$esc = [char]27
function Cy($s) { "$esc[38;2;0;229;255m$s$esc[0m" }
function Dm($s) { "$esc[38;2;92;125;132m$s$esc[0m" }

$Host.UI.RawUI.WindowTitle = 'ctOS'
Write-Host ""
Write-Host (Cy "  ▚ ctOS // personal  —  command your own domain")
Write-Host (Dm "  scope-gated · mock data · US/FCC")
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Node.js not found. Install Node >= 20:  winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  return
}

if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
  Write-Host (Dm "  installing dependencies (first run)…")
  & npm install --no-audit --no-fund
}

function Test-Port($p) {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost', $p); $c.Close(); return $true }
  catch { return $false }
}

if (-not (Test-Port 7050)) {
  Write-Host (Dm "  starting dashboard server (hidden, port 7050)…")
  $env:PORT = '7050'
  if (-not $env:INTEGRATION_MODE) { $env:INTEGRATION_MODE = 'mock' }
  Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server/index.js' -WorkingDirectory $repo
  for ($i = 0; $i -lt 30; $i++) { if (Test-Port 7050) { break }; Start-Sleep -Milliseconds 500 }
}

Write-Host (Dm "  graphical HUD → ") -NoNewline; Write-Host (Cy "start http://localhost:7050")
Write-Host (Dm "  terminal HUD  → [1-5] run command · [r] refresh · [q] quit")
Start-Sleep -Milliseconds 400
& node tui/ctos-tui.mjs
