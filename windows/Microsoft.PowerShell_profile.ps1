# Optional ctOS-themed PowerShell prompt. No external tools (no oh-my-posh).
# Install: copy into your $PROFILE, or dot-source it:  . .\windows\Microsoft.PowerShell_profile.ps1
function prompt {
  $esc   = [char]27
  $cyan  = "$esc[38;2;0;229;255m"
  $dim   = "$esc[38;2;92;125;132m"
  $green = "$esc[38;2;34;255;167m"
  $reset = "$esc[0m"
  $path  = (Get-Location).Path.Replace($HOME, '~')
  $git   = ''
  try {
    $b = git rev-parse --abbrev-ref HEAD 2>$null
    if ($b) { $git = "$dim on $green$b" }
  } catch {}
  "$cyan▚ ctOS$dim $path$git`n$cyan❯$reset "
}
$Host.UI.RawUI.WindowTitle = 'ctOS'
