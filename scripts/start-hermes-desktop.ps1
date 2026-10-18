param([switch]$QS)
$codingRoot=Split-Path -Parent $PSScriptRoot
$desktopExe=Join-Path $codingRoot '.quanta\desktop-runtime\node_modules\electron\dist\electron.exe'
if(-not(Test-Path -LiteralPath $desktopExe)){throw 'Hermes desktop runtime is not installed.'}
$desktopArgs=@((Join-Path $codingRoot 'desktop\hermes-desktop.cjs'))
if($QS){$desktopArgs+='--qs'}
Start-Process -FilePath $desktopExe -ArgumentList $desktopArgs
