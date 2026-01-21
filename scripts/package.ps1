# Build and package ReplyQueue for Chrome Web Store submission
# Usage: .\scripts\package.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

# Get version from manifest.json
$manifest = Get-Content "manifest.json" | ConvertFrom-Json
$version = $manifest.version

Write-Host "Building ReplyQueue v$version..." -ForegroundColor Cyan

# Clean dist folder
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "Cleaned dist folder" -ForegroundColor Gray
}

# Run build
Write-Host "Running pnpm build..." -ForegroundColor Gray
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Create packages folder if it doesn't exist
$packagesDir = "packages"
if (-not (Test-Path $packagesDir)) {
    New-Item -ItemType Directory -Path $packagesDir | Out-Null
}

# Create zip file
$zipName = "replyqueue-v$version.zip"
$zipPath = Join-Path $packagesDir $zipName

# Remove existing zip if present
if (Test-Path $zipPath) {
    Remove-Item $zipPath
}

Write-Host "Creating $zipName..." -ForegroundColor Gray
Compress-Archive -Path "dist\*" -DestinationPath $zipPath

# Get file size
$size = (Get-Item $zipPath).Length / 1KB
$sizeFormatted = "{0:N1} KB" -f $size

Write-Host ""
Write-Host "Package created successfully!" -ForegroundColor Green
Write-Host "  File: $zipPath" -ForegroundColor White
Write-Host "  Size: $sizeFormatted" -ForegroundColor White
Write-Host ""
Write-Host "Upload this file to the Chrome Developer Dashboard" -ForegroundColor Yellow
