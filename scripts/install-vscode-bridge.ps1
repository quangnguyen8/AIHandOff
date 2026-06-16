param(
    [string] $ExtensionRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'vscode\aihandoff-bridge')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath (Join-Path $ExtensionRoot 'package.json'))) {
    throw "AIHandOff bridge extension not found: $ExtensionRoot"
}

$PackagePath = Join-Path $ExtensionRoot 'package.json'
if (-not (Test-Path -LiteralPath $PackagePath)) {
    throw "AIHandOff bridge extension package.json not found: $PackagePath"
}

$Package = Get-Content -Raw $PackagePath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($Package.publisher)) {
    throw "AIHandOff bridge package.json is missing 'publisher' field."
}
if ([string]::IsNullOrWhiteSpace($Package.name)) {
    throw "AIHandOff bridge package.json is missing 'name' field."
}
if ([string]::IsNullOrWhiteSpace($Package.version)) {
    throw "AIHandOff bridge package.json is missing 'version' field."
}

$TargetRoot = Join-Path $env:USERPROFILE '.vscode\extensions'
$TargetPath = Join-Path $TargetRoot ("{0}.{1}-{2}" -f $Package.publisher, $Package.name, $Package.version)

New-Item -ItemType Directory -Path $TargetRoot -Force | Out-Null

if (Test-Path -LiteralPath $TargetPath) {
    Write-Host "Removing previous installation at $TargetPath"
    Remove-Item -LiteralPath $TargetPath -Recurse -Force
}

New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
Copy-Item -LiteralPath $PackagePath -Destination $TargetPath -Force
Copy-Item -LiteralPath (Join-Path $ExtensionRoot 'src') -Destination $TargetPath -Recurse -Force

if (-not (Test-Path -LiteralPath (Join-Path $TargetPath 'package.json'))) {
    throw "AIHandOff bridge installation failed: package.json not found at target."
}
if (-not (Test-Path -LiteralPath (Join-Path $TargetPath 'src\extension.js'))) {
    throw "AIHandOff bridge installation failed: extension.js not found at target."
}

Write-Host "Installed AIHandOff VS Code bridge to $TargetPath"
Write-Host 'Reload VS Code if the AIHandOff bridge commands do not appear immediately.'
