# Codex CLI(gpt-image-2)로 이미지 1장을 생성해 $Out에 저장한다.
# 사용: gen.ps1 -Name bg_road -PromptFile prompts\bg_road.txt -Out assets\raw\bg_road.png [-Size 1536x1024] [-Quality high] [-Image ref.png]
param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$PromptFile,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Size = "1536x1024",
  [string]$Quality = "high",
  [string]$Image = ""
)
$ErrorActionPreference = "Continue"
# 데스크톱 앱에 딸린 최신 codex.exe를 우선 쓰고, 없으면 PATH의 codex를 쓴다
$codex = Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $codex) { $codex = 'codex' }
$ch = Join-Path $env:TEMP ("codex-img-" + $Name)
New-Item -ItemType Directory -Force $ch | Out-Null
Set-Content "$ch\config.toml" @"
model = "gpt-6-astra"
approval_policy = "never"
sandbox_mode = "workspace-write"
"@ -Encoding ascii
Copy-Item "$env:USERPROFILE\.codex\auth.json" "$ch\auth.json" -Force
$prompt = (Get-Content -LiteralPath $PromptFile -Encoding UTF8 -Raw).Replace('"', "'").Trim()
$refNote = ""
$imgArgs = @()
if ($Image -ne "") {
  Copy-Item -LiteralPath $Image -Destination "$ch\ref.png" -Force
  $imgArgs = @("--image=$ch\ref.png")
  $refNote = " The attached image is the visual reference: pass it to image_gen as the reference image and keep the character design, costume and colors identical."
}
$before = Get-Date
$env:CODEX_HOME = $ch
$instr = "Call the built-in image_gen tool exactly once to generate 1 image (size $Size, quality $Quality). Do not run any shell commands and do not read any files.$refNote Use everything between <prompt> and </prompt> verbatim as the image prompt. After the image is generated, reply only with DONE.`n<prompt>`n$prompt`n</prompt>"
$log = & $codex exec $instr -C $ch -s workspace-write --skip-git-repo-check -c 'model_reasoning_effort="low"' @imgArgs 2>&1
$log | ForEach-Object { "$_" } | Select-Object -Last 2
$latest = Get-ChildItem -Recurse "$ch\generated_images" -Filter *.png -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt $before } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) {
  New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
  Copy-Item -LiteralPath $latest.FullName -Destination $Out -Force
  "SAVED $Name"
} else { "NO_IMAGE $Name" }
