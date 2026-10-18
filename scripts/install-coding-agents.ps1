$ErrorActionPreference = 'Stop'
$codingAppRoot = Split-Path -Parent $PSScriptRoot
$codingNode = Join-Path $env:LOCALAPPDATA 'hermes\node\node.exe'
if (-not (Test-Path -LiteralPath $codingNode)) { throw 'Install the local Hermes Node runtime first.' }
$codingNpm = Join-Path (Split-Path -Parent $codingNode) 'node_modules\npm\bin\npm-cli.js'
$codingTools = Join-Path $codingAppRoot '.quanta\coding-tools'
& $codingNode $codingNpm install --prefix $codingTools --save-exact '@anthropic-ai/claude-code@2.1.295' '@google/gemini-cli@0.63.0'
if ($LASTEXITCODE -ne 0) { throw 'Coding agent installation failed. Existing credentials were preserved.' }
Write-Output 'Claude Code and Gemini CLI installed locally. Authenticate in Hermes > Coding agents.'
