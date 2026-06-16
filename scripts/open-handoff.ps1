param(
    [string] $WorkspaceRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ResolvedWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$HandoffDir = Join-Path $ResolvedWorkspace '.ai-handoff'

function Show-File {
    param(
        [string] $Path,
        [string] $Label
    )

    if (Test-Path -LiteralPath $Path) {
        Write-Output "## $Label"
        Write-Output (Get-Content -Raw -Encoding utf8 $Path)
        Write-Output ''
    }
}

if (-not (Test-Path -LiteralPath $HandoffDir)) {
    Write-Output "No .ai-handoff directory found at $HandoffDir"
    exit 0
}

Write-Output "AIHandOff context for $ResolvedWorkspace"
Write-Output ''

Show-File -Path (Join-Path $HandoffDir 'state.json') -Label 'state.json'
Show-File -Path (Join-Path $HandoffDir 'plan.md') -Label 'plan.md'
Show-File -Path (Join-Path $HandoffDir 'execution-result.md') -Label 'execution-result.md'
Show-File -Path (Join-Path $HandoffDir 'review-findings.md') -Label 'review-findings.md'
Show-File -Path (Join-Path $HandoffDir 'fix-result.md') -Label 'fix-result.md'
