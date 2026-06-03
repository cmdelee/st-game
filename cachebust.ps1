# cachebust.ps1 — rewrite ?v=… cache-busting query strings in index.html to
# content hashes of each referenced local .js / .css file.
#
# Why: GitHub Pages serves these static files with long cache lifetimes. The
# manual ?v=N bumps were easy to forget — a changed file kept its old ?v and
# users got a stale cached copy (silent breakage, e.g. after a file split).
# Content hashes fix this automatically: change a file → its hash (and URL)
# changes → browsers refetch; unchanged files keep their URL → stay cached.
#
# Usage (run from the repo root before committing):
#   ./cachebust.ps1            # rewrites index.html in place
#   ./cachebust.ps1 -Check     # exits 1 if any hash is stale (for CI/pre-commit)
#
# No build step, no dependencies beyond PowerShell.

param([switch]$Check)

$ErrorActionPreference = 'Stop'
$root  = $PSScriptRoot
$index = Join-Path $root 'index.html'
# Read as UTF-8 explicitly. Without this, PowerShell 5.1's Get-Content defaults
# to the Windows ANSI codepage (1252) and silently mojibakes multi-byte UTF-8
# (emoji, em-dashes, arrows) on read; the subsequent UTF-8 Set-Content then bakes
# the corruption into the file on every run.
$html  = Get-Content $index -Raw -Encoding utf8

$pattern = 'src="(?<file>[\w./-]+\.(?:js|css))(?:\?v=[^"]*)?"'
$stale   = @()

$updated = [System.Text.RegularExpressions.Regex]::Replace($html, $pattern, {
    param($m)
    $file = $m.Groups['file'].Value
    $path = Join-Path $root $file
    if (-not (Test-Path $path)) { return $m.Value }   # external/CDN or missing — leave as-is
    $hash = (Get-FileHash $path -Algorithm SHA1).Hash.Substring(0, 8).ToLower()
    $new  = 'src="{0}?v={1}"' -f $file, $hash
    if ($m.Value -ne $new) { $script:stale += $file }
    return $new
})

if ($Check) {
    if ($stale.Count -gt 0) {
        Write-Host "Stale cache-bust hashes for:`n  $($stale -join "`n  ")" -ForegroundColor Yellow
        Write-Host "Run ./cachebust.ps1 to fix." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "All cache-bust hashes current." -ForegroundColor Green
    exit 0
}

if ($updated -ne $html) {
    Set-Content -Path $index -Value $updated -NoNewline -Encoding utf8
    Write-Host "Updated $($stale.Count) cache-bust hash(es):`n  $($stale -join "`n  ")" -ForegroundColor Green
} else {
    Write-Host "No changes - all hashes already current." -ForegroundColor Green
}
