# ctOS launcher for Windows Terminal.
# Starts the dashboard server (hidden, mock mode) if it isn't already up, then
# drops you into the terminal-native ctOS HUD. The graphical HUD is one command
# away (start http://localhost:7050). Nothing here touches the scope gate.
# ASCII-only + VT-gated so it renders correctly on both PowerShell 5.1 and 7.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo

$script:VT = $false
try { $script:VT = [bool]$Host.UI.SupportsVirtualTerminal } catch {}
$e = [char]27
function Cy($s) { if ($script:VT) { "$e[38;2;31;214;207m$s$e[0m" } else { $s } }
function Og($s) { if ($script:VT) { "$e[38;2;255;122;26m$s$e[0m" } else { $s } }
function Dm($s) { if ($script:VT) { "$e[38;2;86;110;116m$s$e[0m" } else { $s } }

$Host.UI.RawUI.WindowTitle = 'DedSec ctOS'
Write-Host ""
Write-Host ((Cy "  [ DEDSEC ]") + (Og " // ctOS  -  command your own domain"))
Write-Host (Dm "  scope-gated | mock data | US/FCC")
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Node.js not found. Install Node >= 20:  winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  return
}

if (-not (Test-Path -LiteralPath (Join-Path $repo 'node_modules'))) {
  Write-Host (Dm "  installing dependencies (first run)...")
  & npm install --no-audit --no-fund
}

function Test-Port($p) {
  $c = $null
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost', $p); return $true }
  catch { return $false }
  finally { if ($c) { $c.Dispose() } }
}

if (-not (Test-Port 7050)) {
  Write-Host (Dm "  starting dashboard server (hidden, port 7050)...")
  $env:PORT = '7050'
  if (-not $env:INTEGRATION_MODE) { $env:INTEGRATION_MODE = 'mock' }
  Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server/index.js' -WorkingDirectory $repo
  for ($i = 0; $i -lt 30; $i++) { if (Test-Port 7050) { break }; Start-Sleep -Milliseconds 500 }
}

Write-Host (Dm "  graphical HUD -> ") -NoNewline; Write-Host (Cy "start http://localhost:7050")
Write-Host (Dm "  terminal HUD  -> [1-5] run command | [r] refresh | [q] quit")
Start-Sleep -Milliseconds 400
& node tui/ctos-tui.mjs
