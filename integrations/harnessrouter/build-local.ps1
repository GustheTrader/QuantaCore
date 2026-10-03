param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath
)

$ErrorActionPreference = 'Stop'
$ExpectedCommit = '463e02c094d0b6f240959c3395b468884f9d7bbb'
$ImageTag = 'gnoesis-si-harness-router:463e02c094d0b6f240959c3395b468884f9d7bbb-fontfix1'
$ImageVersion = '463e02c094d0b6f240959c3395b468884f9d7bbb-quanta-font-rangefix'
$ResolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
$PatchPath = Join-Path $PSScriptRoot 'schibsted-font-range.patch'

$ActualCommit = (& git -C $ResolvedSource rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $ActualCommit -ne $ExpectedCommit) {
  throw "HarnessRouter source must be at $ExpectedCommit; found $ActualCommit."
}
$ExistingChanges = @(& git -C $ResolvedSource status --porcelain)
if ($LASTEXITCODE -ne 0 -or $ExistingChanges.Count -gt 0) {
  throw 'The HarnessRouter clone must be clean before the temporary build adjustments are applied.'
}

$ShellScripts = @(Get-ChildItem -LiteralPath (Join-Path $ResolvedSource 'docker') -Filter '*.sh' -File -Recurse)
$OriginalEndings = @{}
$PatchApplied = $false

try {
  foreach ($scriptFile in $ShellScripts) {
    $content = [System.IO.File]::ReadAllText($scriptFile.FullName)
    $OriginalEndings[$scriptFile.FullName] = if ($content.Contains("`r`n")) { 'crlf' } else { 'lf' }
    $normalized = $content -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($scriptFile.FullName, $normalized, [System.Text.UTF8Encoding]::new($false))
  }

  & git -C $ResolvedSource apply $PatchPath
  if ($LASTEXITCODE -ne 0) { throw 'Could not apply the recorded Schibsted Grotesk compatibility patch.' }
  $PatchApplied = $true

  & docker build `
    --build-arg "HR_VERSION=$ImageVersion" `
    --build-arg WITH_BROWSER=0 `
    --build-arg WITH_BUILTIN_SKILLS=0 `
    --build-arg WITH_STARTER_KITS=0 `
    -t $ImageTag `
    $ResolvedSource
  if ($LASTEXITCODE -ne 0) { throw 'HarnessRouter Docker image build failed.' }
  Write-Output "Built $ImageTag from $ExpectedCommit with the recorded local font compatibility patch."
}
finally {
  if ($PatchApplied) {
    & git -C $ResolvedSource apply --reverse $PatchPath
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not remove the temporary font patch from the source clone.' }
  }
  foreach ($scriptFile in $ShellScripts) {
    if (-not $OriginalEndings.ContainsKey($scriptFile.FullName)) { continue }
    $content = [System.IO.File]::ReadAllText($scriptFile.FullName)
    if ($OriginalEndings[$scriptFile.FullName] -eq 'crlf') {
      $content = $content -replace "`r?`n", "`r`n"
    } else {
      $content = $content -replace "`r`n", "`n"
    }
    [System.IO.File]::WriteAllText($scriptFile.FullName, $content, [System.Text.UTF8Encoding]::new($false))
  }
}
