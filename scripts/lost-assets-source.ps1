param(
  [Parameter(Mandatory=$true)][ValidateSet('Archive','WorkbookSheets')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$Source,
  [string]$Destination,
  [string]$Root
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourcePath=[IO.Path]::GetFullPath($Source)
if(-not [IO.File]::Exists($sourcePath)){throw 'The source file is not available locally.'}
$archive=[IO.Compression.ZipFile]::OpenRead($sourcePath)
try {
  if($Mode -eq 'WorkbookSheets'){
    $entry=$archive.GetEntry('xl/workbook.xml')
    if(-not $entry){throw 'This is not a supported Excel workbook.'}
    $settings=[Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver=$null
    $stream=$entry.Open()
    $reader=[Xml.XmlReader]::Create($stream,$settings)
    $document=[Xml.XmlDocument]::new()
    $document.XmlResolver=$null
    $document.Load($reader)
    $reader.Dispose()
    $stream.Dispose()
    $names=@($document.SelectNodes('//*[local-name()="sheet"]')|ForEach-Object{$_.GetAttribute('name')})
    @{sheets=$names}|ConvertTo-Json -Compress
    exit 0
  }
  if([IO.Path]::GetExtension($sourcePath).ToLowerInvariant() -ne '.zip'){throw 'Choose a ZIP archive.'}
  $allowedRoot=[IO.Path]::GetFullPath((Join-Path $Root 'data\lost-assets\sources')).TrimEnd('\')+'\'
  $destinationPath=[IO.Path]::GetFullPath($Destination).TrimEnd('\')+'\'
  if(-not $destinationPath.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive extraction must stay inside the local Lost Asset sources directory.'}
  $entries=@($archive.Entries|Where-Object{-not $_.FullName.EndsWith('/')})
  if($entries.Count -lt 1 -or $entries.Count -gt 64){throw 'ZIP must contain between 1 and 64 CSV files.'}
  [long]$total=0
  foreach($entry in $entries){
    if([IO.Path]::GetExtension($entry.FullName).ToLowerInvariant() -ne '.csv'){throw 'This archive connector accepts CSV entries only.'}
    if($entry.FullName.Contains(':') -or $entry.FullName.Contains('\') -or $entry.FullName.Split('/').Contains('..')){throw 'Unsafe archive entry path.'}
    $target=[IO.Path]::GetFullPath((Join-Path $destinationPath $entry.FullName))
    if(-not $target.StartsWith($destinationPath,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe archive entry path.'}
    $total+=$entry.Length
  }
  if($total -gt 5GB){throw 'ZIP expansion exceeds the 5 GB connector limit.'}
  $drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($destinationPath))
  if($drive.AvailableFreeSpace -lt ($total+512MB)){throw 'There is insufficient free disk space to extract this archive.'}
  [IO.Directory]::CreateDirectory($destinationPath)|Out-Null
  $files=@()
  foreach($entry in $entries){
    $target=[IO.Path]::GetFullPath((Join-Path $destinationPath $entry.FullName))
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))|Out-Null
    if([IO.File]::Exists($target)){
      if(([IO.FileInfo]::new($target)).Length -ne $entry.Length){throw 'An existing extracted file differs. Choose a new extraction directory.'}
    } else {
      $inputStream=$entry.Open()
      $outputStream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
      try{$inputStream.CopyTo($outputStream)}finally{$outputStream.Dispose();$inputStream.Dispose()}
      if(([IO.FileInfo]::new($target)).Length -ne $entry.Length){throw 'Archive entry length verification failed.'}
    }
    $files+=@{path=$target;name=$entry.FullName;bytes=$entry.Length}
  }
  @{files=$files;bytes=$total}|ConvertTo-Json -Depth 4 -Compress
} finally {$archive.Dispose()}
