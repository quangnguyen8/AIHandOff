param(
    [string] $WorkspaceRoot = (Get-Location).Path,
    [ValidateSet('en', 'vi', '')]
    [string] $Language = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Launcher = Join-Path $PSScriptRoot 'ai-terminal.ps1'
$HandoffViewer = Join-Path $PSScriptRoot 'open-handoff.ps1'
$TestScript = Join-Path $PSScriptRoot 'test-ai-terminal.ps1'
$ResolvedWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$VscodeDir = Join-Path $ResolvedWorkspace '.vscode'
$TasksPath = Join-Path $VscodeDir 'tasks.json'
$ExtensionsPath = Join-Path $VscodeDir 'extensions.json'
$SettingsPath = Join-Path $VscodeDir 'settings.json'
$ProjectHandoffTest = Join-Path $ResolvedWorkspace 'scripts\test-ai-loop.ps1'

function New-EmptyDocument {
    return [ordered]@{
        version = '2.0.0'
        inputs = @()
        tasks = @()
    }
}

function Get-Value {
    param(
        [object] $Object,
        [string] $Name
    )

    if (-not $Object.PSObject.Properties[$Name]) {
        return $null
    }

    return $Object.PSObject.Properties[$Name].Value
}

New-Item -ItemType Directory -Path $VscodeDir -Force | Out-Null
$HandoffDir = Join-Path $ResolvedWorkspace '.ai-handoff'
New-Item -ItemType Directory -Path $HandoffDir -Force | Out-Null

$extensionsDocument = [ordered]@{
    recommendations = @('aihandoff.aihandoff-bridge')
}

if (Test-Path -LiteralPath $ExtensionsPath) {
    try {
        $existingExtensions = Get-Content -Raw $ExtensionsPath | ConvertFrom-Json
        $existingRecommendations = Get-Value -Object $existingExtensions -Name 'recommendations'
        if ($existingRecommendations) {
            $extensionsDocument.recommendations = @(
                @($existingRecommendations) + @('aihandoff.aihandoff-bridge') | Select-Object -Unique
            )
        }
    } catch {
        $extensionsDocument = [ordered]@{
            recommendations = @('aihandoff.aihandoff-bridge')
        }
    }
}

$managedInput = [ordered]@{
    id = 'aiProfile'
    type = 'promptString'
    description = 'AIHandOff profile name'
    default = 'opencode-review'
}

$managedTasks = @(
    [ordered]@{
        label = 'AIHandOff: Start Plan'
        type = 'shell'
        command = 'pwsh'
        args = @(
            '-NoProfile',
            '-File',
            $Launcher,
            '-Profile',
            'opencode-plan',
            '-WorkspaceRoot',
            '${workspaceFolder}'
        )
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    },
    [ordered]@{
        label = 'AIHandOff: Start Code'
        type = 'shell'
        command = 'pwsh'
        args = @(
            '-NoProfile',
            '-File',
            $Launcher,
            '-Profile',
            'opencode-code',
            '-WorkspaceRoot',
            '${workspaceFolder}'
        )
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    },
    [ordered]@{
        label = 'AIHandOff: Start Review'
        type = 'shell'
        command = 'pwsh'
        args = @(
            '-NoProfile',
            '-File',
            $Launcher,
            '-Profile',
            'opencode-review',
            '-WorkspaceRoot',
            '${workspaceFolder}'
        )
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    },
    [ordered]@{
        label = 'AIHandOff: Launch Profile'
        type = 'shell'
        command = 'pwsh'
        args = @(
            '-NoProfile',
            '-File',
            $Launcher,
            '-Profile',
            '${input:aiProfile}',
            '-WorkspaceRoot',
            '${workspaceFolder}'
        )
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    },
    [ordered]@{
        label = 'AIHandOff: List Profiles'
        type = 'shell'
        command = 'pwsh'
        args = @('-NoProfile', '-File', $Launcher, '-List')
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    },
    [ordered]@{
        label = 'AIHandOff: Test Central Kit'
        type = 'shell'
        command = 'pwsh'
        args = @('-NoProfile', '-File', $TestScript)
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    },
    [ordered]@{
        label = 'AIHandOff: Open Handoff'
        type = 'shell'
        command = 'pwsh'
        args = @('-NoProfile', '-File', $HandoffViewer, '-WorkspaceRoot', '${workspaceFolder}')
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'shared'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    }
)

$labelsToReplace = @(
    'AI: Launch Profile',
    'AI: List Profiles',
    'AI: Codex Review',
    'AI: OpenCode Code Fast',
    'AI: OpenCode Review',
    'AIHandOff: Start Plan',
    'AIHandOff: Start Code',
    'AIHandOff: Start Review',
    'AIHandOff: Launch Profile',
    'AIHandOff: List Profiles',
    'AIHandOff: Test Central Kit',
    'AIHandOff: Open Handoff',
    'AIHandOff: Handoff Next',
    'AI: Dry Run Handoff'
)

if (Test-Path -LiteralPath $ProjectHandoffTest) {
    $managedTasks += [ordered]@{
        label = 'AI: Dry Run Handoff'
        type = 'shell'
        command = 'pwsh'
        args = @('-NoProfile', '-File', 'scripts\test-ai-loop.ps1')
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        presentation = [ordered]@{ panel = 'dedicated'; reveal = 'always'; focus = $true; clear = $true }
        problemMatcher = @()
    }
}

$managedTasks += [ordered]@{
    label = 'AIHandOff: Handoff Next'
    type = 'shell'
    command = 'pwsh'
    args = @('-NoProfile', '-File', $HandoffViewer, '-WorkspaceRoot', '${workspaceFolder}')
    options = [ordered]@{ cwd = '${workspaceFolder}' }
    presentation = [ordered]@{ panel = 'shared'; reveal = 'always'; focus = $true; clear = $true }
    problemMatcher = @()
}

$document = New-EmptyDocument

if (Test-Path -LiteralPath $TasksPath) {
    try {
        $existing = Get-Content -Raw $TasksPath | ConvertFrom-Json
        $existingVersion = Get-Value -Object $existing -Name 'version'
        if ($existingVersion) {
            $document.version = $existingVersion
        }
        $existingInputs = Get-Value -Object $existing -Name 'inputs'
        if ($existingInputs) {
            $document.inputs = @($existingInputs)
        }
        $existingTasks = Get-Value -Object $existing -Name 'tasks'
        if ($existingTasks) {
            $document.tasks = @($existingTasks)
        }
    } catch {
        $document = New-EmptyDocument
    }
}

$existingInputs = @(
    $document.inputs | Where-Object {
        (Get-Value -Object $_ -Name 'id') -ne 'aiProfile'
    }
)

$document.inputs = @(@($managedInput) + @($existingInputs))

$managedLabels = @($managedTasks | ForEach-Object { Get-Value -Object $_ -Name 'label' })
$labelsToFilter = @($managedLabels + $labelsToReplace | Select-Object -Unique)
$existingTasks = @(
    $document.tasks | Where-Object {
        $label = Get-Value -Object $_ -Name 'label'
        $labelsToFilter -notcontains $label
    }
)

$document.tasks = @($existingTasks + $managedTasks)

$json = $document | ConvertTo-Json -Depth 8
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($TasksPath, $json + [Environment]::NewLine, $utf8NoBom)

$extensionsJson = $extensionsDocument | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($ExtensionsPath, $extensionsJson + [Environment]::NewLine, $utf8NoBom)

if ($Language -eq 'vi' -or $Language -eq 'en') {
    $settingsDoc = [ordered]@{}
    if (Test-Path -LiteralPath $SettingsPath) {
        try {
            $settingsDoc = Get-Content -Raw $SettingsPath | ConvertFrom-Json -AsHashtable
        } catch {
            $settingsDoc = [ordered]@{}
        }
    }
    $settingsDoc['aihandoff.language'] = $Language
    $settingsJson = $settingsDoc | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($SettingsPath, $settingsJson + [Environment]::NewLine, $utf8NoBom)
    Write-Host "Set aihandoff.language = $Language in $SettingsPath"
}

Write-Host "Installed AIHandOff VS Code tasks to $TasksPath"
