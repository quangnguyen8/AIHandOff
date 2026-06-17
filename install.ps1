param(
    [string] $WorkspaceRoot = (Get-Location).Path,
    [switch] $SkipStarterFiles,
    [switch] $SkipBridge,
    [ValidateSet('en', 'vi', '')]
    [string] $Language = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$KitRoot = Split-Path -Parent $PSCommandPath
$Installer = Join-Path $KitRoot 'scripts\install-vscode-tasks.ps1'
$BridgeInstaller = Join-Path $KitRoot 'scripts\install-vscode-bridge.ps1'

if (-not (Test-Path -LiteralPath $Installer)) {
    throw "AIHandOff installer not found: $Installer"
}

$ResolvedWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path

if ([string]::IsNullOrWhiteSpace($Language)) {
    & $Installer -WorkspaceRoot $ResolvedWorkspace
} else {
    & $Installer -WorkspaceRoot $ResolvedWorkspace -Language $Language
}

if (-not $SkipBridge) {
    & $BridgeInstaller
}

if (-not $SkipStarterFiles) {
    $HandoffDir = Join-Path $ResolvedWorkspace '.ai-handoff'
    New-Item -ItemType Directory -Path $HandoffDir -Force | Out-Null

    $StarterFiles = [ordered]@{
        'state.json' = @'
{
  "project": "",
  "phase": "idle",
  "round": 0,
  "updatedAt": ""
}
'@
        'plan.md' = @'
# Handoff Plan

- Put the active plan here.
'@
        'execution-result.md' = @'
# Execution Result

- Put implementation notes here.
'@
        'review-findings.md' = @'
# Review Findings

- Put review feedback here.
'@
        'fix-result.md' = @'
# Fix Result

- Put the final fix summary here.
'@
    }

    foreach ($fileName in $StarterFiles.Keys) {
        $targetPath = Join-Path $HandoffDir $fileName
        if (-not (Test-Path -LiteralPath $targetPath)) {
            $content = [string] $StarterFiles[$fileName]
            [System.IO.File]::WriteAllText(
                $targetPath,
                $content + [Environment]::NewLine,
                [System.Text.UTF8Encoding]::new($false)
            )
        }
    }
}

if ($Language -eq 'vi') {
    Write-Host ''
    Write-Host 'AIHandOff đã sẵn sàng cho workspace này.'
    Write-Host 'Các bước tiếp theo:'
    Write-Host '  1. Mở VS Code trong dự án đích.'
    Write-Host '  2. Chạy "AIHandOff: Start Plan", "AIHandOff: Start Code", hoặc "AIHandOff: Start Review".'
    Write-Host '  3. Chạy "AIHandOff: Continue In Existing Terminal" để gửi prompt tiếp theo vào terminal đang mở.'
    Write-Host '  4. Chạy "AIHandOff: Open Handoff" hoặc "AIHandOff: Handoff Next" để xem trạng thái handoff.'
} else {
    Write-Host ''
    Write-Host 'AIHandOff is ready for this workspace.'
    Write-Host 'Next steps:'
    Write-Host '  1. Open VS Code in the target project.'
    Write-Host '  2. Run "AIHandOff: Start Plan", "AIHandOff: Start Code", or "AIHandOff: Start Review".'
    Write-Host '  3. Run "AIHandOff: Continue In Existing Terminal" to send the next prompt into an already-open terminal.'
    Write-Host '  4. Run "AIHandOff: Open Handoff" or "AIHandOff: Handoff Next" to inspect the local handoff state.'
}
