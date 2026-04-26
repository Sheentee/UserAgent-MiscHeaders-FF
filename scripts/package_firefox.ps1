$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$distDir = Join-Path $rootDir "dists"
$manifestPath = Join-Path $rootDir "manifest.json"

# Read version from manifest
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$version = $manifest.version

$zipName = "UserAgent-MiscHeaders-firefox_v$version.zip"
$xpiName = "UserAgent-MiscHeaders-firefox_v$version.xpi"
$zipPath = Join-Path $distDir $zipName
$xpiPath = Join-Path $distDir $xpiName

# Create dist directory
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
    Write-Host "Created dists directory."
}

# Remove existing files
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
if (Test-Path $xpiPath) { Remove-Item $xpiPath -Force }

# Excludes
$exclude = @(
    "*.git*",
    "*.gitignore*",
    "*scripts*",
    "*dists*",
    "*.zip",
    "*.xpi",
    "*.gemini*",
    "task.md",
    "implementation_plan.md",
    "walkthrough.md",
    "*.DS_Store"
)

# Load required assembly
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Get files (Recurse is important for the manual loop below)
$files = Get-ChildItem -Path $rootDir -Recurse -Exclude $exclude | Where-Object { 
    $_.FullName -notmatch "\\.git" -and 
    $_.FullName -notmatch "\\scripts" -and 
    ($_.FullName -ne $distDir) -and
    $_.FullName -notmatch "\\dists\\" -and
    $_.FullName -notmatch "\\.gemini"
}

# Create zip using .NET to ensure proper path separators (forward slashes)
$zipFile = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    Write-Host "Zipping the following files/directories:"
    
    foreach ($file in $files) {
        # Calculate relative path
        $relativePath = $file.FullName.Substring($rootDir.Length + 1)
        
        # Normalize to forward slashes for ZIP compatibility
        $entryName = $relativePath.Replace('\', '/')
        
        # Determine strict casing or just use as is (Windows is case insensitive, but ZIP/Firefox isn't)
        # We use the name as found on disk.
        
        if ($file.PSIsContainer) {
            # Directories don't strictly need entries unless empty, but if we want to be explicit:
            if (-not $entryName.EndsWith('/')) {
                $entryName += '/'
            }
            $null = $zipFile.CreateEntry($entryName)
        }
        else {
            # Create entry and copy content manually to avoid reliance on extension methods
            $entry = $zipFile.CreateEntry($entryName)
            $entryStream = $entry.Open()
            $fileStream = [System.IO.File]::OpenRead($file.FullName)
            try {
                $fileStream.CopyTo($entryStream)
            }
            finally {
                $fileStream.Dispose()
                $entryStream.Dispose()
            }
            Write-Host "  $entryName"
        }
    }
}
catch {
    throw $_
}
finally {
    $zipFile.Dispose()
}

# Rename to .xpi
Rename-Item -Path $zipPath -NewName $xpiName

Write-Host "Firefox extension packaged: $xpiPath"
