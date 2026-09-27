# ============================================================
# Deploy-sync: workspace -> deploy copy (clean release snapshot)
# Usage: powershell -ExecutionPolicy Bypass -File deploy-sync.ps1
# Excluded: .git / DB-docs / test-zone / sjk\worker / sjk\gateway-fn / node_modules / *.cmd
# CJK dir names built from codepoints (avoids GBK/UTF-8 console issues)
# ============================================================
$src = 'c:\Users\zhixiaobo\Desktop\yh-main\yh-main'
$dstRoot = 'c:\Users\zhixiaobo\Desktop\yh-main'
$cnDbDocs = -join [char[]](0x6570,0x636E,0x5E93,0x4F18,0x5316)
$cnTestZone = -join [char[]](0x6D4B,0x8BD5,0x533A)
$cnDeploy = -join [char[]](0x90E8,0x7F72,0x7248)
$cnQuickGuide = -join [char[]](0x3010,0x5FEB,0x901F,0x4E86,0x89E3,0x3011)   # legacy quick-guide dir

$dst = Join-Path $dstRoot $cnDeploy
$topExclude = @('.git', $cnDbDocs, $cnTestZone, $cnDeploy, $cnQuickGuide, 'node_modules', 'scf_bootstrap')

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null

Get-ChildItem $src | Where-Object { $topExclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item $_.FullName -Destination $dst -Recurse -Force
}

# inside sjk: exclude Worker & gateway-fn sources (deployed via wrangler, not static)
if (Test-Path "$dst\sjk\worker") { Remove-Item "$dst\sjk\worker" -Recurse -Force }
if (Test-Path "$dst\sjk\gateway-fn") { Remove-Item "$dst\sjk\gateway-fn" -Recurse -Force }

# strip stray cmd/log files (guard against empty pipeline)
$stray = Get-ChildItem $dst -Recurse -Include *.cmd, *.log -ErrorAction SilentlyContinue
if ($stray) { $stray | Remove-Item -Force }

$count = (Get-ChildItem $dst -Recurse -File).Count
$size = [math]::Round(((Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Output "deploy copy ready: $dst"
Write-Output "files: $count | size: $size MB"
