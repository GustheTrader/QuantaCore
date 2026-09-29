param([int]$Port = 8788)

$ErrorActionPreference = 'Stop'
if (-not $env:GNOESIS_SERVICE_TOKEN -or -not $env:GNOESIS_GATEWAY_TOKEN) {
    throw 'Set GNOESIS_SERVICE_TOKEN and GNOESIS_GATEWAY_TOKEN to the local service credentials.'
}
$workerDirectory = $PSScriptRoot
$workerPython = Join-Path $workerDirectory '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $workerPython)) {
    throw 'Worker dependencies are missing. Run uv sync --frozen --python 3.11 in trading first.'
}
Push-Location -LiteralPath $workerDirectory
try {
    & $workerPython -m uvicorn svc.main:app --host 127.0.0.1 --port $Port
} finally {
    Pop-Location
}
