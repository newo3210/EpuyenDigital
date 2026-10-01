# Install OpenSpec SDD skills/agents globally for Cursor (~/.cursor)
# Usage: .\ai-specs\scripts\install-global-sdd.ps1 [-TemplateRepo "D:\Repositorios\OpenSpecs"]

param(
    [string]$TemplateRepo = $env:OPENSPEC_TEMPLATE_REPO
)

$ErrorActionPreference = "Stop"

if (-not $TemplateRepo) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $TemplateRepo = Resolve-Path (Join-Path $scriptDir "..\..")
}

$globalSkills = Join-Path $env:USERPROFILE ".cursor\skills"
$globalAgents = Join-Path $env:USERPROFILE ".cursor\agents"
$srcSkills = Join-Path $TemplateRepo "ai-specs\skills"
$srcAgents = Join-Path $TemplateRepo "ai-specs\agents"

$skillsToInstall = @(
    "project-director",
    "project-sdd-init",
    "sync-agent-symlinks",
    "enrich-us",
    "adversarial-review"
)

$agentsToInstall = @(
    "project-director.md"
)

Write-Host "OpenSpec global SDD install"
Write-Host "  Template: $TemplateRepo"
Write-Host "  Skills:   $globalSkills"
Write-Host "  Agents:   $globalAgents"
Write-Host ""

New-Item -ItemType Directory -Force $globalSkills | Out-Null
New-Item -ItemType Directory -Force $globalAgents | Out-Null

foreach ($skill in $skillsToInstall) {
    $src = Join-Path $srcSkills $skill
    $dst = Join-Path $globalSkills $skill
    if (-not (Test-Path $src)) {
        Write-Warning "SKIP skill (missing): $skill"
        continue
    }
    if (Test-Path $dst) {
        Remove-Item -Recurse -Force $dst
    }
    Copy-Item -Recurse -Force $src $dst
    Write-Host "OK skill: $skill"
}

foreach ($agent in $agentsToInstall) {
    $src = Join-Path $srcAgents $agent
    $dst = Join-Path $globalAgents $agent
    if (-not (Test-Path $src)) {
        Write-Warning "SKIP agent (missing): $agent"
        continue
    }
    Copy-Item -Force $src $dst
    Write-Host "OK agent: $agent"
}

# Persist template path for future bootstraps
$envFile = Join-Path $env:USERPROFILE ".cursor\openspec.env"
@"
OPENSPEC_TEMPLATE_REPO=$TemplateRepo
"@ | Set-Content -Encoding UTF8 $envFile
Write-Host ""
Write-Host "Wrote $envFile"
Write-Host ""
Write-Host "Done. Open any project and run: /director init"
Write-Host "For legacy repos without ai-specs/: /director init then project-sdd-init archaeology."
