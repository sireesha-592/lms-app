# CodeMedha Electron Build Script (Cloud Version)
# Run this from: C:\Users\psiri\lms-app\lms-app\
# Requirements: Node.js installed

Write-Host "=== CodeMedha Desktop Apps Build ===" -ForegroundColor Cyan
Write-Host "Backend: Railway Cloud" -ForegroundColor Green
Write-Host "Frontend: Vercel Cloud" -ForegroundColor Green
Write-Host ""

$ROOT = "C:\Users\psiri\lms-app\lms-app"

# Build React frontend first
Write-Host "[1/4] Building React frontend..." -ForegroundColor Yellow
Set-Location "$ROOT\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build FAILED!" -ForegroundColor Red; exit 1 }
Write-Host "Frontend build SUCCESS" -ForegroundColor Green

# Build Admin .exe
Write-Host "[2/4] Building Admin .exe..." -ForegroundColor Yellow
Set-Location "$ROOT\electron-wrapper\admin"
npm install
npm run build:win
Write-Host "Admin build done -> electron-wrapper\admin\dist\" -ForegroundColor Green

# Build Trainer .exe
Write-Host "[3/4] Building Trainer .exe..." -ForegroundColor Yellow
Set-Location "$ROOT\electron-wrapper\trainer"
npm install
npm run build:win
Write-Host "Trainer build done -> electron-wrapper\trainer\dist\" -ForegroundColor Green

# Build Trainee .exe
Write-Host "[4/4] Building Trainee .exe..." -ForegroundColor Yellow
Set-Location "$ROOT\electron-wrapper\trainee"
npm install
npm run build:win
Write-Host "Trainee build done -> electron-wrapper\trainee\dist\" -ForegroundColor Green

Write-Host ""
Write-Host "=== ALL BUILDS COMPLETE ===" -ForegroundColor Cyan
Write-Host "Find your .exe files in:" -ForegroundColor White
Write-Host "  Admin:   $ROOT\electron-wrapper\admin\dist\" -ForegroundColor White
Write-Host "  Trainer: $ROOT\electron-wrapper\trainer\dist\" -ForegroundColor White
Write-Host "  Trainee: $ROOT\electron-wrapper\trainee\dist\" -ForegroundColor White
