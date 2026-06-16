Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$KitRoot = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $PSScriptRoot 'ai-terminal.ps1'
$Installer = Join-Path $PSScriptRoot 'install-vscode-tasks.ps1'
$HandoffViewer = Join-Path $PSScriptRoot 'open-handoff.ps1'
$BridgeTest = Join-Path $KitRoot 'vscode\aihandoff-bridge\test\prompt-router.test.js'
$TempWorkspace = Join-Path ([System.IO.Path]::GetTempPath()) 'aihandoff-test-workspace'

function Assert-Equal {
    param(
        [string] $Actual,
        [string] $Expected,
        [string] $Message
    )

    if ($Actual -ne $Expected) {
        throw "Assertion failed: $Message Expected '$Expected', got '$Actual'."
    }
}

function Assert-Match {
    param(
        [string] $Actual,
        [string] $Pattern,
        [string] $Message
    )

    if ($Actual -notmatch $Pattern) {
        throw "Assertion failed: $Message Pattern '$Pattern', got '$Actual'."
    }
}

if (Test-Path $TempWorkspace) {
    Remove-Item -LiteralPath $TempWorkspace -Recurse -Force
}
New-Item -ItemType Directory -Path $TempWorkspace | Out-Null
New-Item -ItemType Directory -Path (Join-Path $TempWorkspace 'scripts') | Out-Null
Set-Content -Path (Join-Path $TempWorkspace 'scripts\test-ai-loop.ps1') -Value "Write-Host 'project handoff test'" -Encoding utf8
New-Item -ItemType Directory -Path (Join-Path $TempWorkspace '.vscode') | Out-Null
$existingTasks = @'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "AI: Launch Profile",
      "type": "shell",
      "command": "echo",
      "args": ["old"],
      "problemMatcher": []
    },
    {
      "label": "Existing: Keep Me",
      "type": "shell",
      "command": "echo",
      "args": ["hello"],
      "problemMatcher": []
    }
  ]
}
'@
Set-Content -Path (Join-Path $TempWorkspace '.vscode\tasks.json') -Value $existingTasks -Encoding utf8

$list = & $Launcher -List
$listText = $list -join "`n"
Assert-Match $listText 'opencode-plan\s+=>\s+opencode --model opencode-go/deepseek-v4-pro' 'Profile list should include opencode-plan.'
Assert-Match $listText 'opencode-review\s+=>\s+opencode --model opencode-go/deepseek-v4-pro' 'Profile list should include opencode-review.'
Assert-Match $listText 'opencode-code\s+=>\s+opencode --model opencode-go/deepseek-v4-flash' 'Profile list should include opencode-code.'
Assert-Match $listText 'claude-review\s+=>\s+claude' 'Profile list should include claude-review.'

$codeCommand = & $Launcher -Profile opencode-code -PrintCommand
Assert-Equal $codeCommand 'opencode --model opencode-go/deepseek-v4-flash' 'opencode-code should print command and model args.'

$reviewCommand = & $Launcher -Profile opencode-review -PrintCommand
Assert-Equal $reviewCommand 'opencode --model opencode-go/deepseek-v4-pro' 'opencode-review should print command and model args.'

$missingProfileError = $null
try {
    & $Launcher -Profile does-not-exist -PrintCommand 2>$null
} catch {
    $missingProfileError = $_.Exception.Message
}
Assert-Match $missingProfileError "Unknown AI profile 'does-not-exist'" 'Launcher should report unknown profiles clearly.'

node $BridgeTest

& $Installer -WorkspaceRoot $TempWorkspace
$tasksPath = Join-Path $TempWorkspace '.vscode\tasks.json'
$extensionsPath = Join-Path $TempWorkspace '.vscode\extensions.json'
$tasks = Get-Content -Raw $tasksPath | ConvertFrom-Json
$taskText = Get-Content -Raw $tasksPath
$extensionsText = Get-Content -Raw $extensionsPath
if (-not (Test-Path -LiteralPath (Join-Path $TempWorkspace '.ai-handoff'))) {
    throw 'Assertion failed: Installer should create the .ai-handoff directory.'
}
Assert-Match $taskText 'Existing: Keep Me' 'Installer should preserve existing non-AI tasks.'
if ($taskText -match '"label": "AI: Launch Profile"') {
    throw 'Assertion failed: Installer should replace legacy AI labels instead of preserving them.'
}
Assert-Match $taskText 'AIHandOff: Start Plan' 'Installed tasks should include plan shortcut.'
Assert-Match $taskText 'AIHandOff: Start Code' 'Installed tasks should include code shortcut.'
Assert-Match $taskText 'AIHandOff: Start Review' 'Installed tasks should include review shortcut.'
Assert-Equal (
    ($tasks.tasks | Where-Object { $_.label -eq 'AIHandOff: Launch Profile' } | Select-Object -First 1).args[2]
) $Launcher 'Installed launch task should point to the central launcher.'
Assert-Match $taskText 'AIHandOff: Launch Profile' 'Installed tasks should include generic launch profile task.'
Assert-Match $taskText 'AIHandOff: List Profiles' 'Installed tasks should include list profiles task.'
Assert-Match $taskText 'AI: Dry Run Handoff' 'Installed tasks should include project handoff test when scripts/test-ai-loop.ps1 exists.'
Assert-Match $taskText 'AIHandOff: Open Handoff' 'Installed tasks should include handoff viewer task.'
Assert-Match $taskText 'AIHandOff: Handoff Next' 'Installed tasks should include handoff next task.'
Assert-Match $taskText '"inputs": \[' 'Installed tasks should keep prompt inputs as a JSON array.'
Assert-Match $taskText '"id": "aiProfile"' 'Installed tasks should keep the aiProfile prompt input.'
Assert-Match $extensionsText 'aihandoff.aihandoff-bridge' 'Installer should recommend the AIHandOff VS Code bridge extension.'

Set-Content -Path (Join-Path $TempWorkspace '.ai-handoff\state.json') -Value '{ "phase": "review_done" }' -Encoding utf8
Set-Content -Path (Join-Path $TempWorkspace '.ai-handoff\plan.md') -Value "# Demo plan" -Encoding utf8

$handoffOutput = & $HandoffViewer -WorkspaceRoot $TempWorkspace
$handoffText = $handoffOutput -join "`n"
Assert-Match $handoffText 'AIHandOff context for' 'Handoff viewer should show workspace heading.'
Assert-Match $handoffText 'Phase: review_done' 'Handoff viewer should show the current phase.'
Assert-Match $handoffText 'Consider updating state to approved' 'Handoff viewer should suggest the next action.'
Assert-Match $handoffText 'state.json' 'Handoff viewer should include state file.'
Assert-Match $handoffText 'phase' 'Handoff viewer should print state contents.'
Assert-Match $handoffText 'plan.md' 'Handoff viewer should include plan file.'

Write-Host 'PASS central AIHandOff launcher and installer'
