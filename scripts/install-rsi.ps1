param([string]$RsiSource = 'C:\QuantaRRSI')
$ErrorActionPreference = 'Stop'
$QuantaRoot = Split-Path -Parent $PSScriptRoot
$RsiPin = Get-Content -LiteralPath (Join-Path $QuantaRoot 'rsi/upstream.lock.json') -Raw | ConvertFrom-Json
$ResolvedSource = [System.IO.Path]::GetFullPath($RsiSource)
if ($ResolvedSource.TrimEnd('\') -eq $QuantaRoot.TrimEnd('\') -or $ResolvedSource.StartsWith($QuantaRoot.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Use a separately versioned checkout outside QuantaCore.' }
if (!(Test-Path -LiteralPath $ResolvedSource)) { & git clone $RsiPin.repository $ResolvedSource; if ($LASTEXITCODE) { throw 'Clone failed.' } }
if (!(Test-Path -LiteralPath (Join-Path $ResolvedSource '.git'))) { throw 'RRSI source must be a Git checkout.' }
$DirtySource = & git -C $ResolvedSource status --porcelain -- rrsi pyproject.toml
if ($DirtySource) { throw 'Preserve local source edits before repairing the pinned environment.' }
& git -C $ResolvedSource checkout --detach $RsiPin.commit
if ($LASTEXITCODE) { throw 'The pinned revision is unavailable.' }
$RsiPython = Join-Path $ResolvedSource '.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $RsiPython)) { & uv venv --python $RsiPin.python (Join-Path $ResolvedSource '.venv'); if ($LASTEXITCODE) { throw 'Python environment creation failed.' } }
& uv pip sync --python $RsiPython (Join-Path $QuantaRoot 'rsi/requirements.lock.txt')
if ($LASTEXITCODE) { throw 'Pinned dependency install failed.' }
& uv pip install --python $RsiPython --no-deps --no-build-isolation -e $ResolvedSource
if ($LASTEXITCODE) { throw 'RRSI package install failed.' }
$env:PYTHONUTF8 = '1'
& $RsiPython (Join-Path $QuantaRoot 'rsi/worker.py') --probe
if ($LASTEXITCODE) { throw 'RRSI source verification failed.' }
Write-Output 'RSI Lab environment ready. Restart the local Quanta server to expose /#/rsi-lab.'
