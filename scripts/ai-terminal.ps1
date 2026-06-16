param(
    [string] $Profile,
    [switch] $List,
    [switch] $PrintCommand,
    [string] $WorkspaceRoot,
    [string] $ConfigPath,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $AgentArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$KitRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $KitRoot 'config\agents.json'
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "AIHandOff config not found: $ConfigPath"
}

$config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
$agents = $config.agents
$profiles = $config.profiles

function Get-PropertyValue {
    param(
        [object] $Object,
        [string] $Name
    )

    return $Object.PSObject.Properties[$Name].Value
}

function Join-CommandLine {
    param(
        [string] $Command,
        [string[]] $CommandArgs
    )

    if (-not $CommandArgs -or $CommandArgs.Count -eq 0) {
        return $Command
    }

    return (@($Command) + $CommandArgs) -join ' '
}

if ($List) {
    Write-Output 'Agents:'
    foreach ($agentName in $agents.PSObject.Properties.Name) {
        $agent = Get-PropertyValue -Object $agents -Name $agentName
        Write-Output ("  {0} -> {1} ({2})" -f $agentName, $agent.command, $agent.description)
    }

    Write-Output ''
    Write-Output 'Profiles:'
    foreach ($profileName in $profiles.PSObject.Properties.Name) {
        $profileEntry = Get-PropertyValue -Object $profiles -Name $profileName
        $agent = Get-PropertyValue -Object $agents -Name $profileEntry.agent
        $profileArgs = @($profileEntry.args)
        Write-Output ("  {0} => {1} [{2}]" -f $profileName, (Join-CommandLine -Command $agent.command -CommandArgs $profileArgs), $profileEntry.role)
    }
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Profile)) {
    $Profile = $config.defaultProfile
}

$selectedProfile = Get-PropertyValue -Object $profiles -Name $Profile
if (-not $selectedProfile) {
    throw "Unknown AI profile '$Profile'. Use -List to see available profiles."
}

$selectedAgent = Get-PropertyValue -Object $agents -Name $selectedProfile.agent
if (-not $selectedAgent) {
    throw "Profile '$Profile' references unknown agent '$($selectedProfile.agent)'."
}

$command = [string] $selectedAgent.command
$profileArgs = @($selectedProfile.args)
$extraArgs = @($AgentArgs) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$allArgs = @($profileArgs) + @($extraArgs)

if ($PrintCommand) {
    Write-Output (Join-CommandLine -Command $command -CommandArgs $allArgs)
    exit 0
}

$resolved = Get-Command $command -ErrorAction SilentlyContinue
if (-not $resolved) {
    throw "Profile '$Profile' maps to command '$command', but it was not found on PATH."
}

if (-not [string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
    Set-Location -LiteralPath $WorkspaceRoot
}

Write-Host ("Starting profile {0}: {1}" -f $Profile, (Join-CommandLine -Command $command -CommandArgs $allArgs))
Write-Host ("Workspace: {0}" -f (Get-Location))
& $command @allArgs
