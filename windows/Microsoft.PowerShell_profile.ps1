# Optional ctOS-themed PowerShell prompt. No external tools (no oh-my-posh).
# ASCII-only + VT-gated so it renders on Windows PowerShell 5.1 and PowerShell 7
# (5.1 in the classic console has no VT / reads BOM-less files as Windows-1252).
# Install: copy into your $PROFILE, or dot-source it:
#   . .\windows\Microsoft.PowerShell_profile.ps1
$script:ctosVT = $false
try { $script:ctosVT = [bool]$Host.UI.SupportsVirtualTerminal } catch {}
function prompt {
  $e = [char]27
  $path = (Get-Location).Path.Replace($HOME, '~')
  $branch = ''
  try { $b = git rev-parse --abbrev-ref HEAD 2>$null; if ($b) { $branch = " on $b" } } catch {}
  if ($script:ctosVT) {
    $cyan = "$e[38;2;0;229;255m"; $dim = "$e[38;2;92;125;132m"; $green = "$e[38;2;34;255;167m"; $reset = "$e[0m"
    "$cyan[ctOS]$dim $path$green$branch$reset`n$cyan>$reset "
  } else {
    "[ctOS] $path$branch`n> "
  }
}
$Host.UI.RawUI.WindowTitle = 'ctOS'
