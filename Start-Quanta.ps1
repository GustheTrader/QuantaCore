# Start the complete local UI and backend under the current Windows account.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:QUANTA_PORT = '3000'
try {
  $status = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/inference/providers' -Headers @{'X-Quanta-Client'='local-ui'} -TimeoutSec 10
  if ($null -ne $status.connections) { Write-Host 'Quanta backend is already running: http://127.0.0.1:3000/#/startup'; return }
} catch {}
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 3000 is occupied. Stop the frontend preview or existing server before starting Quanta.' }
& node --import tsx eve.ts --production
