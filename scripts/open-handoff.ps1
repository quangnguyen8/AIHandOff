param(
    [string] $WorkspaceRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ResolvedWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$HandoffDir = Join-Path $ResolvedWorkspace '.ai-handoff'

function Get-NextAction {
    param(
        [string] $Phase
    )

    $normalized = ([string] $Phase).Trim().ToLowerInvariant().Replace('-', '_')

    switch ($normalized) {
        'idle' { return 'Next: run AIHandOff: Start Plan or AIHandOff: Plan Write To Handoff.' }
        'new' { return 'Next: run AIHandOff: Start Plan or AIHandOff: Plan Write To Handoff.' }
        'planning' { return 'Next: continue planning, then update state to planned.' }
        'planned' { return 'Next: run AIHandOff: Start Code or AIHandOff: Continue In Existing Terminal.' }
        'code_done' { return 'Next: run AIHandOff: Start Review or AIHandOff: Continue In Existing Terminal.' }
        'review_findings' { return 'Next: run AIHandOff: Start Code or AIHandOff: Continue In Existing Terminal to fix findings.' }
        'fix_requested' { return 'Next: run AIHandOff: Start Code or AIHandOff: Continue In Existing Terminal to fix findings.' }
        'fix_done' { return 'Next: run AIHandOff: Start Review or AIHandOff: Continue In Existing Terminal.' }
        'approved' { return 'Next: handoff is approved. Merge, publish, or archive the result.' }
        'review_done' { return 'Next: handoff is approved. Consider updating state to approved for the current convention.' }
        default { return 'Next: no automatic route is known for this phase.' }
    }
}

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

$StatePath = Join-Path $HandoffDir 'state.json'
if (Test-Path -LiteralPath $StatePath) {
    try {
        $state = Get-Content -Raw -Encoding utf8 $StatePath | ConvertFrom-Json
        $phase = [string] $state.phase
        Write-Output ("Phase: {0}" -f $(if ([string]::IsNullOrWhiteSpace($phase)) { 'idle' } else { $phase }))
        Write-Output (Get-NextAction -Phase $phase)
        Write-Output ''
    } catch {
        Write-Output 'Phase: unreadable state.json'
        Write-Output 'Next: fix .ai-handoff/state.json so the bridge can route the loop.'
        Write-Output ''
    }
}

Show-File -Path $StatePath -Label 'state.json'
Show-File -Path (Join-Path $HandoffDir 'plan.md') -Label 'plan.md'
Show-File -Path (Join-Path $HandoffDir 'execution-result.md') -Label 'execution-result.md'
Show-File -Path (Join-Path $HandoffDir 'review-findings.md') -Label 'review-findings.md'
Show-File -Path (Join-Path $HandoffDir 'fix-result.md') -Label 'fix-result.md'
