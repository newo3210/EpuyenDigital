# Create / refresh OpenSpec SDD Kanban board and optional feature epic
# Usage:
#   .\setup-sdd-kanban-board.ps1 -BoardOnly
#   .\setup-sdd-kanban-board.ps1 -ProjectPath "D:\Repositorios\OpenSpecs" -ChangeName "my-feature" -FeatureIdea "Filter candidates by position"

param(
    [string]$BoardSlug = "openspec-sdd",
    [string]$ProjectPath = "",
    [string]$ChangeName = "",
    [string]$FeatureIdea = "",
    [switch]$BoardOnly
)

$ErrorActionPreference = "Stop"

function Get-HermesHome {
    $candidates = @(
        $env:HERMES_HOME,
        $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "hermes" }),
        $(Join-Path $env:USERPROFILE ".hermes")
    ) | Where-Object { $_ }
    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir "config.yaml")) { return $dir }
    }
    throw "Hermes no instalado. Completá first-run en Hermes Desktop."
}

function Get-HermesCli {
    param([string]$HermesHome)
    $p = Join-Path $HermesHome "hermes-agent\venv\Scripts\hermes.exe"
    if (Test-Path $p) { return $p }
    throw "No se encontro hermes.exe"
}

function Invoke-KanbanJson {
    param(
        [string]$Cli,
        [string[]]$KanbanArgs
    )
    $raw = & $Cli @KanbanArgs 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -and $raw -notmatch '^\s*\{') {
        $cmdLine = ($KanbanArgs -join ' ')
        throw "kanban failed: $raw`nCommand: $cmdLine"
    }
    return ($raw | ConvertFrom-Json)
}

function New-KanbanTask {
    param(
        [string]$Cli,
        [string]$Board,
        [string]$Title,
        [string]$Body = "",
        [string]$Assignee = "project-director",
        [string]$Workspace = "",
        [string]$Branch = "",
        [string[]]$Parents = @(),
        [string[]]$Skills = @(),
        [string]$IdempotencyKey = "",
        [switch]$Triage,
        [switch]$Blocked
    )

    $kanbanCmd = @("kanban", "--board", $Board, "create", $Title, "--json", "--assignee", $Assignee)
    if ($Body) { $kanbanCmd += @("--body", $Body) }
    if ($Workspace) { $kanbanCmd += @("--workspace", $Workspace) }
    if ($Branch) { $kanbanCmd += @("--branch", $Branch) }
    if ($IdempotencyKey) { $kanbanCmd += @("--idempotency-key", $IdempotencyKey) }
    if ($Triage) { $kanbanCmd += "--triage" }
    if ($Blocked) { $kanbanCmd += @("--initial-status", "blocked") }
    foreach ($p in $Parents) { if ($p) { $kanbanCmd += @("--parent", $p) } }
    foreach ($s in $Skills) { if ($s) { $kanbanCmd += @("--skill", $s) } }

    $task = Invoke-KanbanJson -Cli $Cli -KanbanArgs $kanbanCmd
    return $task.id
}

$hermesHome = Get-HermesHome
$hermesCli = Get-HermesCli $hermesHome

Write-Host "=== SDD Kanban board setup ==="
Write-Host "Board: $BoardSlug"
Write-Host "Hermes: $hermesHome"

# --- Create board ---
$boards = & $hermesCli kanban boards list 2>&1 | Out-String
if ($boards -notmatch "\b$BoardSlug\b") {
    $createArgs = @(
        "kanban", "boards", "create", $BoardSlug,
        "--name", "OpenSpec SDD",
        "--description", "Spec-Driven Development pipeline aligned with project-director / OpenSpec",
        "--icon", "S",
        "--color", "#6366f1",
        "--switch"
    )
    if ($ProjectPath) {
        $wd = (Resolve-Path $ProjectPath).Path.Replace('\', '/')
        $createArgs += @("--default-workdir", $wd)
    }
    & $hermesCli @createArgs 2>&1 | Out-Host
    Write-Host "Board creado: $BoardSlug"
}
else {
    & $hermesCli kanban boards switch $BoardSlug 2>&1 | Out-Null
    Write-Host "Board ya existe: $BoardSlug (activo)"
    if ($ProjectPath) {
        $wd = (Resolve-Path $ProjectPath).Path.Replace('\', '/')
        & $hermesCli kanban boards set-default-workdir $BoardSlug $wd 2>&1 | Out-Null
    }
}

& $hermesCli kanban --board $BoardSlug init 2>&1 | Out-Null

if ($BoardOnly) {
    Write-Host ""
    Write-Host "Listo. Abrí Hermes Desktop -> Kanban -> board '$BoardSlug'"
    Write-Host "Para crear un epic: -ProjectPath ... -ChangeName ..."
    exit 0
}

if (-not $ProjectPath -or -not $ChangeName) {
    throw "Para crear epic necesitas -ProjectPath y -ChangeName (o usa -BoardOnly)"
}

$projectDir = (Resolve-Path $ProjectPath).Path.Replace('\', '/')
$branch = "feature/$ChangeName"
$ideaLine = if ($FeatureIdea) { $FeatureIdea } else { "(describe in epic body)" }

Write-Host ""
Write-Host "Creando epic SDD: $ChangeName"
Write-Host "Project: $projectDir"

$bodyEpic = "## SDD Epic`nChange: openspec/changes/$ChangeName/`nProject: $projectDir`nIdea: $ideaLine`n`nOrchestrator: load skills project-director + sdd-kanban-orchestrator.`nDirector must not write production code."

$epicId = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "SDD: $ChangeName" -Body $bodyEpic -Triage `
    -Workspace "dir:$projectDir" `
    -Skills @("project-director", "sdd-kanban-orchestrator") `
    -IdempotencyKey "sdd-$ChangeName-epic"

$p0 = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 0 - bootstrap SDD" `
    -Body "Run project-sdd-init if ai-specs/ or openspec/ missing. Phase 0 PASS required." `
    -Parents @($epicId) -Workspace "dir:$projectDir" `
    -Skills @("project-sdd-init", "project-director") `
    -IdempotencyKey "sdd-$ChangeName-p0"

$p2 = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 2 - enrich user story" `
    -Body "Output tmp/$ChangeName-enriched-us.md. Ask business questions until scope is clear." `
    -Parents @($p0) -Workspace "dir:$projectDir" `
    -Skills @("enrich-us", "project-director") `
    -IdempotencyKey "sdd-$ChangeName-p2"

$p3 = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 3 - OpenSpec plan (ff)" `
    -Body "Create openspec/changes/$ChangeName/ with proposal, specs, design, tasks. Present summary to human." `
    -Parents @($p2) -Workspace "dir:$projectDir" `
    -Skills @("openspec-ff-change", "project-director") `
    -IdempotencyKey "sdd-$ChangeName-p3"

$gatePlan = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "GATE - human plan approval" `
    -Body "Wait for human: aprobado, ok, o adelante. Unblock only after explicit approval." `
    -Parents @($p3) -Workspace "dir:$projectDir" -Blocked `
    -Skills @("project-director") `
    -IdempotencyKey "sdd-$ChangeName-gate-plan"

$p4b = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 4 - backend apply" `
    -Assignee "backend-developer" `
    -Body "Implement backend sections of tasks.md for $ChangeName. TDD. Mark [x] with evidence." `
    -Parents @($gatePlan) -Workspace "worktree" -Branch $branch `
    -Skills @("openspec-apply-change") `
    -IdempotencyKey "sdd-$ChangeName-p4-backend"

$p4f = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 4 - frontend apply" `
    -Assignee "frontend-developer" `
    -Body "Implement frontend sections of tasks.md for $ChangeName. Mark [x] with evidence." `
    -Parents @($gatePlan) -Workspace "worktree" -Branch $branch `
    -Skills @("openspec-apply-change") `
    -IdempotencyKey "sdd-$ChangeName-p4-frontend"

$p5 = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 5 - mechanical verify" `
    -Body "Run openspec-verify-change. Report CRITICAL/WARNING. Not sufficient alone for done." `
    -Parents @($p4b, $p4f) -Workspace "dir:$projectDir" `
    -Skills @("openspec-verify-change", "project-director") `
    -IdempotencyKey "sdd-$ChangeName-p5"

$p6a = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 6a - acceptance matrix" `
    -Body "Create reports/acceptance-matrix.md with literal WHEN/THEN from spec. Execute with curl/browser." `
    -Parents @($p5) -Workspace "dir:$projectDir" `
    -Skills @("project-director") `
    -IdempotencyKey "sdd-$ChangeName-p6a"

$p6b = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 6b - adversarial review" `
    -Body "audit $ChangeName - independent reviewer. Writer != reviewer. No npm-test-only validation." `
    -Parents @($p6a) -Workspace "dir:$projectDir" `
    -Skills @("adversarial-review", "project-director") `
    -IdempotencyKey "sdd-$ChangeName-p6b"

$gateArchive = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "GATE - human archive OK" `
    -Body "Human confirms demo + audit acceptable. Unblock to archive." `
    -Parents @($p6b) -Workspace "dir:$projectDir" -Blocked `
    -Skills @("project-director") `
    -IdempotencyKey "sdd-$ChangeName-gate-archive"

$p7 = New-KanbanTask -Cli $hermesCli -Board $BoardSlug `
    -Title "Phase 7 - archive change" `
    -Body "openspec-archive-change: merge specs, move to archive/." `
    -Parents @($gateArchive) -Workspace "dir:$projectDir" `
    -Skills @("openspec-archive-change", "project-director") `
    -IdempotencyKey "sdd-$ChangeName-p7"

Write-Host ""
Write-Host "Epic creado en board '$BoardSlug'"
Write-Host "  Epic:        $epicId"
Write-Host "  Gate plan:   $gatePlan  (blocked - unblock tras aprobacion)"
Write-Host "  Gate archive: $gateArchive"
Write-Host ""
Write-Host "Ver tablero: Hermes Desktop -> Kanban"
Write-Host "Listar:      hermes kanban --board $BoardSlug list"
Write-Host "Dispatch:    hermes gateway  (dispatcher embebido)"
Write-Host ""
Write-Host "Aprobar plano:"
Write-Host "  hermes kanban --board $BoardSlug comment $gatePlan `"Plan aprobado`""
Write-Host "  hermes kanban --board $BoardSlug unblock $gatePlan"
