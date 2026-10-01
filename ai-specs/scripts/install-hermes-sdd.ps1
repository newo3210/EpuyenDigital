# Install OpenSpec SDD into Hermes Desktop / Hermes Agent
# Usage:
#   .\ai-specs\scripts\install-hermes-sdd.ps1
#   .\ai-specs\scripts\install-hermes-sdd.ps1 -OpenSpecsPath "D:\Repositorios\OpenSpecs"

param(
    [string]$OpenSpecsPath = $env:OPENSPEC_TEMPLATE_REPO
)

$ErrorActionPreference = "Stop"

if (-not $OpenSpecsPath) {
    $OpenSpecsPath = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}

function Get-HermesHome {
    $candidates = @(
        $env:HERMES_HOME,
        $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "hermes" }),
        $(Join-Path $env:USERPROFILE ".hermes")
    ) | Where-Object { $_ }

    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir "config.yaml")) { return $dir }
        if (Test-Path (Join-Path $dir "hermes-agent")) { return $dir }
    }
    throw "Hermes no instalado. Abrí Hermes Desktop y completá el first-run wizard primero."
}

function Get-HermesCli {
    param([string]$HermesHome)
    $paths = @(
        (Join-Path $HermesHome "hermes-agent\venv\Scripts\hermes.exe"),
        (Join-Path $HermesHome "hermes-agent\.venv\Scripts\hermes.exe")
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    $found = Get-ChildItem (Join-Path $HermesHome "hermes-agent") -Recurse -Filter "hermes.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
    throw "No se encontró hermes.exe en $HermesHome\hermes-agent"
}

function Set-ExternalSkillDirs {
    param(
        [string]$ConfigPath,
        [string[]]$Dirs
    )
    $content = Get-Content $ConfigPath -Raw
    $normalized = $Dirs | ForEach-Object { $_.Replace('\', '/') }

    foreach ($dir in $normalized) {
        if ($content -match [regex]::Escape($dir)) {
            Write-Host "  external_dirs ya incluye: $dir"
            return
        }
    }

    $block = "  external_dirs:`n" + (($normalized | ForEach-Object { "    - $_" }) -join "`n")

    if ($content -match '(?ms)^\s*#\s*external_dirs:.*?^\s*#\s*- /home/shared/team-skills\s*$') {
        $content = [regex]::Replace(
            $content,
            '(?ms)^\s*#\s*external_dirs:.*?^\s*#\s*- /home/shared/team-skills\s*$',
            $block
        )
    }
    elseif ($content -match '(?ms)^skills:\s*$.*?^\S') {
        $content = [regex]::Replace(
            $content,
            '(?ms)(^skills:\s*\r?\n(?:  .*\r?\n)*?)(^\S|\z)',
            "`$1$block`n`n`$2",
            1
        )
    }
    else {
        throw "No se pudo parchear config.yaml - agrega manualmente skills.external_dirs"
    }

    Set-Content -Path $ConfigPath -Value $content -Encoding UTF8
    Write-Host "  config.yaml actualizado con external_dirs"
}

function Convert-AgentToSoul {
    param([string]$AgentPath)
    $raw = Get-Content $AgentPath -Raw
    if ($raw -match '(?s)^---\s*\r?\n.*?\r?\n---\s*\r?\n(.*)$') {
        return $Matches[1].Trim()
    }
    if ($raw -match '(?s)^##\s*name:.*?\r?\n(.*)$') {
        return $Matches[1].Trim()
    }
    return $raw.Trim()
}

function Install-SddSkillsCopy {
    param(
        [string]$HermesHome,
        [string]$SourceRoot,
        [string]$Category = "openspec"
    )
    $destRoot = Join-Path $HermesHome "skills\$Category"
    New-Item -ItemType Directory -Force $destRoot | Out-Null

    $sources = @(
        (Join-Path $SourceRoot "ai-specs\skills"),
        (Join-Path $SourceRoot ".claude\skills")
    )

    foreach ($src in $sources) {
        if (-not (Test-Path $src)) { continue }
        Get-ChildItem $src -Directory | ForEach-Object {
            $skillMd = Join-Path $_.FullName "SKILL.md"
            if (-not (Test-Path $skillMd)) { return }
            $dest = Join-Path $destRoot $_.Name
            if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
            Copy-Item -Recurse -Force $_.FullName $dest
            Write-Host "  skill copiado: $($_.Name)"
        }
    }
}

function Ensure-SddProfiles {
    param(
        [string]$HermesCli,
        [string]$AgentsDir
    )

    $profiles = @(
        @{
            Name = "project-director"
            Description = "SDD orchestrator: OpenSpec lifecycle, enrich-us, verify, adversarial review. Does not write production code."
        },
        @{
            Name = "backend-developer"
            Description = "Backend DDD planner for TypeScript Express Prisma. Proposes plans only, no direct implementation."
        },
        @{
            Name = "frontend-developer"
            Description = "React frontend planner following project component patterns. Proposes plans only."
        }
    )

    $existing = & $HermesCli profile list 2>&1 | Out-String

    foreach ($p in $profiles) {
        $agentFile = Join-Path $AgentsDir "$($p.Name).md"
        if (-not (Test-Path $agentFile)) {
            Write-Warning "SKIP profile $($p.Name): falta $agentFile"
            continue
        }

        if ($existing -notmatch "\b$($p.Name)\b") {
            & $HermesCli profile create $p.Name --no-skills --description $p.Description 2>&1 | Out-Host
            Write-Host "  profile creado: $($p.Name)"
        }
        else {
            Write-Host "  profile existe: $($p.Name)"
            & $HermesCli profile describe $p.Name $p.Description 2>&1 | Out-Null
        }

        $profileHome = Join-Path $env:LOCALAPPDATA "hermes\profiles\$($p.Name)"
        if (-not (Test-Path $profileHome)) {
            $profileHome = Join-Path $env:USERPROFILE ".hermes\profiles\$($p.Name)"
        }
        $soulPath = Join-Path $profileHome "SOUL.md"
        if (Test-Path (Split-Path $soulPath)) {
            Convert-AgentToSoul $agentFile | Set-Content -Path $soulPath -Encoding UTF8
            Write-Host "  SOUL.md actualizado: $($p.Name)"
        }
    }
}

# --- main ---
Write-Host "=== OpenSpec -> Hermes SDD install ==="
Write-Host "OpenSpecs: $OpenSpecsPath"

$hermesHome = Get-HermesHome
$hermesCli = Get-HermesCli $hermesHome
$configPath = Join-Path $hermesHome "config.yaml"

Write-Host "Hermes home: $hermesHome"
Write-Host "Hermes CLI:  $hermesCli"
Write-Host ""

Write-Host "[1/4] external_dirs en config.yaml"
Set-ExternalSkillDirs -ConfigPath $configPath -Dirs @(
    (Join-Path $OpenSpecsPath "ai-specs\skills"),
    (Join-Path $OpenSpecsPath ".claude\skills")
)

Write-Host "[2/4] Copia skills a skills/openspec/ (visible en UI)"
Install-SddSkillsCopy -HermesHome $hermesHome -SourceRoot $OpenSpecsPath

Write-Host "[3/4] Profiles SDD desde ai-specs/agents/"
Ensure-SddProfiles -HermesCli $hermesCli -AgentsDir (Join-Path $OpenSpecsPath "ai-specs\agents")

Write-Host "[4/4] openspec.env"
$envFile = Join-Path $hermesHome "openspec.env"
@"
OPENSPEC_TEMPLATE_REPO=$OpenSpecsPath
HERMES_SDD_PROFILE=project-director
"@ | Set-Content -Encoding UTF8 $envFile

Write-Host ""
Write-Host "Listo. Reiniciá el gateway en Hermes Desktop (Settings) o:"
Write-Host "  & `"$hermesCli`" gateway"
Write-Host ""
Write-Host "Perfil director:  hermes -p project-director chat"
Write-Host "Kanban ejemplo:   hermes kanban create `"Feature X`" --assignee backend-developer --workspace worktree --skill project-director"
Write-Host ""
Write-Host "En el chat del director, invocá: /project-director"
Write-Host ""
Write-Host "Kanban SDD board:"
Write-Host "  .\ai-specs\scripts\setup-sdd-kanban-board.ps1 -BoardOnly -ProjectPath <repo>"
