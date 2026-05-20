# ============================================================
#  LMS Desktop Apps – Windows Build Script
#  Run: Right-click → "Run with PowerShell"
#  OR:  Open PowerShell in project root → .\scripts\build-windows.ps1
# ============================================================

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  LMS Desktop App Builder (Windows)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build React frontend ───────────────────────────────────────────
Write-Host "[1/5] Building React frontend..." -ForegroundColor Yellow
Set-Location "frontend"
npm install
$env:REACT_APP_API_URL = "http://localhost:5000"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red; exit 1 }
Set-Location ".."
Write-Host "  ✅ Frontend built → frontend/build" -ForegroundColor Green

# ── Step 2: Install backend deps ───────────────────────────────────────────
Write-Host "[2/5] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "backend"
npm install --production
Set-Location ".."
Write-Host "  ✅ Backend ready" -ForegroundColor Green

# ── Step 3: Build Admin App ─────────────────────────────────────────────────
Write-Host "[3/5] Building ADMIN .exe installer..." -ForegroundColor Yellow
Set-Location "electron-wrapper\admin"
npm install
npm run build:win
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Admin build failed!" -ForegroundColor Red; exit 1 }
Set-Location "..\.."
Write-Host "  ✅ Admin installer → electron-wrapper/admin/dist/" -ForegroundColor Green

# ── Step 4: Build Trainer App ───────────────────────────────────────────────
Write-Host "[4/5] Building TRAINER .exe installer..." -ForegroundColor Yellow
Set-Location "electron-wrapper\trainer"
npm install
npm run build:win
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Trainer build failed!" -ForegroundColor Red; exit 1 }
Set-Location "..\.."
Write-Host "  ✅ Trainer installer → electron-wrapper/trainer/dist/" -ForegroundColor Green

# ── Step 5: Build Trainee App ───────────────────────────────────────────────
Write-Host "[5/5] Building TRAINEE .exe installer..." -ForegroundColor Yellow
Set-Location "electron-wrapper\trainee"
npm install
npm run build:win
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Trainee build failed!" -ForegroundColor Red; exit 1 }
Set-Location "..\.."
Write-Host "  ✅ Trainee installer → electron-wrapper/trainee/dist/" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your .exe files are in:"
Write-Host "  electron-wrapper/admin/dist/LMS-Admin-Setup-1.0.0.exe"
Write-Host "  electron-wrapper/trainer/dist/LMS-Trainer-Setup-1.0.0.exe"
Write-Host "  electron-wrapper/trainee/dist/LMS-Trainee-Setup-1.0.0.exe"
Write-Host ""
Write-Host "Share these files with users. They install like normal Windows software." -ForegroundColor Cyan
