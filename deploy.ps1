<#
.SYNOPSIS
    GATE BREAK - Deploy Tool
.DESCRIPTION
    Deploy chapters to GitHub Pages.
.EXAMPLE
    .\deploy.ps1 status          # Show chapter status
    .\deploy.ps1 new             # Deploy new chapters only
    .\deploy.ps1 update 2        # Update chapter 2
    .\deploy.ps1 all             # Deploy all new + modified chapters
#>

param(
    [Parameter(Position=0)]
    [string]$Action,
    [Parameter(Position=1)]
    [int]$Chapter = 0
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location $root

# ─── Helper Functions ───

function Get-ChapterTitle($path) {
    $c = Get-Content $path -Raw -Encoding UTF8
    if ($c -match '<h2>(.*?)</h2>') { return $Matches[1].Trim() }
    return "Untitled"
}

function Get-ChapterSubtitle($path) {
    $c = Get-Content $path -Raw -Encoding UTF8
    $pos = $c.IndexOf('</h2>')
    if ($pos -ge 0) {
        $after = $c.Substring($pos + 5)
        if ($after -match '<p>([^<]+)</p>') {
            $s = $Matches[1].Trim()
            if ($s.Length -gt 60) { $s = $s.Substring(0, 57) + "..." }
            return $s
        }
    }
    return ""
}

function Get-LocalChapters {
    return Get-ChildItem "$root\chapters\chapter-*.html" -ErrorAction SilentlyContinue | Sort-Object Name
}

function Get-RemoteChapterNames {
    $r = git ls-tree -r origin/master --name-only -- chapters/ 2>$null
    if ($r) {
        return @($r | Where-Object { $_ -match 'chapter-\d+\.html$' } | ForEach-Object { Split-Path $_ -Leaf })
    }
    return @()
}

function Sync-Manifest([int]$forceUpdate = 0) {
    $appJs = Get-Content "$root\app.js" -Raw -Encoding UTF8
    $chapters = Get-LocalChapters

    # Parse existing MANIFEST entries — preserve custom subtitles
    $existing = @{}
    [regex]::Matches($appJs, '\{\s*file:\s*"(chapter-\d+\.html)"[^}]+\}') | ForEach-Object {
        $existing[$_.Groups[1].Value] = $_.Value.Trim()
    }

    $entries = @()
    foreach ($ch in $chapters) {
        $num = 0
        if ($ch.Name -match 'chapter-(\d+)') { $num = [int]$Matches[1] }

        if ($existing.ContainsKey($ch.Name) -and $num -ne $forceUpdate) {
            # Keep existing entry (preserves custom subtitle)
            $entries += "    " + $existing[$ch.Name]
        } else {
            # Generate new entry from HTML content
            $t = Get-ChapterTitle $ch.FullName
            $s = Get-ChapterSubtitle $ch.FullName
            $entries += "    { file: `"$($ch.Name)`", title: `"$t`", subtitle: `"$s`" }"
        }
    }

    $block = $entries -join ",`n"
    $newAppJs = [regex]::Replace($appJs, '(?s)const MANIFEST = \[.*?\];', "const MANIFEST = [`n$block`n  ];")

    if ($newAppJs -eq $appJs) {
        Write-Host "  [!] Warning: MANIFEST pattern not found in app.js" -ForegroundColor Red
        return
    }

    [System.IO.File]::WriteAllText("$root\app.js", $newAppJs, [System.Text.UTF8Encoding]::new($false))
}

function Step-CacheVersion {
    $p = "$root\index.html"
    $h = Get-Content $p -Raw -Encoding UTF8
    if ($h -match 'app\.js\?v=(\d+)') {
        $h = $h -replace 'app\.js\?v=\d+', "app.js?v=$([int]$Matches[1]+1)"
    }
    if ($h -match 'styles\.css\?v=(\d+)') {
        $h = $h -replace 'styles\.css\?v=\d+', "styles.css?v=$([int]$Matches[1]+1)"
    }
    [System.IO.File]::WriteAllText($p, $h, [System.Text.UTF8Encoding]::new($false))
}

# ─── Header ───

Write-Host ""
Write-Host "  GATE BREAK - Deploy Tool" -ForegroundColor Cyan
Write-Host "  ========================" -ForegroundColor DarkCyan
Write-Host ""

# ─── Validate Action ───

if ($Action -notin @("new", "update", "status", "all")) {
    Write-Host "  Usage:" -ForegroundColor White
    Write-Host ""
    Write-Host "    .\deploy.ps1 status          Show chapter status" -ForegroundColor Gray
    Write-Host "    .\deploy.ps1 new             Deploy new chapters" -ForegroundColor Gray
    Write-Host "    .\deploy.ps1 update <num>    Update specific chapter" -ForegroundColor Gray
    Write-Host "    .\deploy.ps1 all             Deploy all new + modified" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Examples:" -ForegroundColor White
    Write-Host "    .\deploy.ps1 new             # push all new chapters" -ForegroundColor DarkGray
    Write-Host "    .\deploy.ps1 update 2        # push changes to ch.2" -ForegroundColor DarkGray
    Write-Host "    .\deploy.ps1 all             # deploy everything at once" -ForegroundColor DarkGray
    Write-Host ""
    return
}

# ─── Fetch Remote ───

Write-Host "  [*] Syncing with remote..." -ForegroundColor DarkGray
git fetch origin 2>$null

# ─── Actions ───

switch ($Action) {

    "status" {
        $local = Get-LocalChapters
        $remote = Get-RemoteChapterNames

        Write-Host "  Chapters ($($local.Count)):" -ForegroundColor White
        Write-Host ""

        foreach ($ch in $local) {
            $isNew = $ch.Name -notin $remote
            $isMod = $false
            if (-not $isNew) {
                $d = git diff origin/master -- "chapters/$($ch.Name)" 2>$null
                $isMod = [bool]$d
            }

            $tag   = if ($isNew) { "NEW" } elseif ($isMod) { "MODIFIED" } else { "LIVE" }
            $color = if ($isNew) { "Green" } elseif ($isMod) { "Yellow" } else { "DarkGray" }
            $title = Get-ChapterTitle $ch.FullName
            Write-Host "    [$tag] $($ch.Name) — $title" -ForegroundColor $color
        }
        Write-Host ""
    }

    "new" {
        $local  = Get-LocalChapters
        $remote = Get-RemoteChapterNames
        $new    = @($local | Where-Object { $_.Name -notin $remote })

        if ($new.Count -eq 0) {
            Write-Host "  [i] No new chapters. Everything is live already." -ForegroundColor Yellow
            Write-Host ""
            return
        }

        Write-Host "  [+] New chapters to deploy:" -ForegroundColor Green
        foreach ($ch in $new) {
            Write-Host "      $($ch.Name) — $(Get-ChapterTitle $ch.FullName)" -ForegroundColor Green
        }
        Write-Host ""

        Write-Host "  [*] Updating MANIFEST..." -ForegroundColor DarkGray
        Sync-Manifest

        Write-Host "  [*] Bumping cache version..." -ForegroundColor DarkGray
        Step-CacheVersion

        $names = ($new | ForEach-Object { $_.Name }) -join ", "
        git add -A 2>$null
        git commit -m "deploy new: $names" 2>$null

        Write-Host "  [*] Pushing..." -ForegroundColor DarkGray
        git push origin master 2>$null

        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [!] Push failed — check connection/credentials" -ForegroundColor Red
            Write-Host ""
            return
        }

        Write-Host ""
        Write-Host "  [OK] Deployed successfully!" -ForegroundColor Green
        Write-Host "  URL: https://passamaistarde.github.io/glitch-reality/" -ForegroundColor Cyan
        Write-Host ""
    }

    "update" {
        if ($Chapter -le 0) {
            Write-Host "  [!] Specify chapter number" -ForegroundColor Red
            Write-Host "      Example: .\deploy.ps1 update 2" -ForegroundColor Gray
            Write-Host ""
            return
        }

        $file = "chapter-{0:D2}.html" -f $Chapter
        $path = "$root\chapters\$file"

        if (-not (Test-Path $path)) {
            Write-Host "  [!] Not found: chapters\$file" -ForegroundColor Red
            Write-Host ""
            return
        }

        $title = Get-ChapterTitle $path
        Write-Host "  [*] Updating: $file" -ForegroundColor Yellow
        Write-Host "      $title" -ForegroundColor Yellow
        Write-Host ""

        Write-Host "  [*] Syncing MANIFEST..." -ForegroundColor DarkGray
        Sync-Manifest -forceUpdate $Chapter

        Write-Host "  [*] Bumping cache version..." -ForegroundColor DarkGray
        Step-CacheVersion

        git add -A 2>$null
        git commit -m "update: $file — $title" 2>$null

        Write-Host "  [*] Pushing..." -ForegroundColor DarkGray
        git push origin master 2>$null

        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [!] Push failed — check connection/credentials" -ForegroundColor Red
            Write-Host ""
            return
        }

        Write-Host ""
        Write-Host "  [OK] Updated!" -ForegroundColor Green
        Write-Host "  URL: https://passamaistarde.github.io/glitch-reality/" -ForegroundColor Cyan
        Write-Host ""
    }

    "all" {
        $local  = Get-LocalChapters
        $remote = Get-RemoteChapterNames
        $new    = @($local | Where-Object { $_.Name -notin $remote })
        $mod    = @($local | Where-Object {
            $_.Name -in $remote -and
            [bool](git diff origin/master -- "chapters/$($_.Name)" 2>$null)
        })

        if ($new.Count -eq 0 -and $mod.Count -eq 0) {
            Write-Host "  [i] Everything is up to date. Nothing to deploy." -ForegroundColor Yellow
            Write-Host ""
            return
        }

        if ($new.Count -gt 0) {
            Write-Host "  [+] New chapters:" -ForegroundColor Green
            foreach ($ch in $new) {
                Write-Host "      $($ch.Name) — $(Get-ChapterTitle $ch.FullName)" -ForegroundColor Green
            }
        }

        if ($mod.Count -gt 0) {
            Write-Host "  [~] Modified chapters:" -ForegroundColor Yellow
            foreach ($ch in $mod) {
                $num = 0
                if ($ch.Name -match 'chapter-(\d+)') { $num = [int]$Matches[1] }
                Write-Host "      $($ch.Name) — $(Get-ChapterTitle $ch.FullName)" -ForegroundColor Yellow
                Sync-Manifest -forceUpdate $num
            }
        }

        Write-Host ""
        Write-Host "  [*] Updating MANIFEST..." -ForegroundColor DarkGray
        Sync-Manifest

        Write-Host "  [*] Bumping cache version..." -ForegroundColor DarkGray
        Step-CacheVersion

        $allNames = @()
        if ($new.Count -gt 0) { $allNames += ($new | ForEach-Object { $_.Name }) }
        if ($mod.Count -gt 0) { $allNames += ($mod | ForEach-Object { $_.Name }) }
        $summary = $allNames -join ", "

        git add -A 2>$null
        git commit -m "deploy all: $summary" 2>$null

        Write-Host "  [*] Pushing..." -ForegroundColor DarkGray
        git push origin master 2>$null

        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [!] Push failed — check connection/credentials" -ForegroundColor Red
            Write-Host ""
            return
        }

        Write-Host ""
        Write-Host "  [OK] Deployed $($new.Count) new + $($mod.Count) modified!" -ForegroundColor Green
        Write-Host "  URL: https://passamaistarde.github.io/glitch-reality/" -ForegroundColor Cyan
        Write-Host ""
    }
}
