# Setup script for Private Assistant with Piper TTS
# Run this script in PowerShell as Administrator (recommended)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Private Assistant - TTS Setup Script  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Function to refresh PATH
function Update-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Step 1: Check for Rust
Write-Host "[1/5] Checking for Rust installation..." -ForegroundColor Yellow

if (Test-Command "rustc") {
    $rustVersion = rustc --version
    Write-Host "  OK: Rust is installed ($rustVersion)" -ForegroundColor Green
} else {
    Write-Host "  Rust is NOT installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Installing Rust via rustup..." -ForegroundColor Yellow

    # Download and run rustup-init
    $rustupUrl = "https://win.rustup.rs/x86_64"
    $rustupPath = "$env:TEMP\rustup-init.exe"

    try {
        Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath -UseBasicParsing
        Write-Host "  Downloaded rustup-init.exe" -ForegroundColor Green

        Write-Host ""
        Write-Host "  Running Rust installer..." -ForegroundColor Yellow
        Write-Host "  (Accept the default installation when prompted)" -ForegroundColor Gray
        Write-Host ""

        Start-Process -FilePath $rustupPath -ArgumentList "-y" -Wait -NoNewWindow

        # Refresh PATH
        Update-Path
        $env:Path += ";$env:USERPROFILE\.cargo\bin"

        if (Test-Command "rustc") {
            Write-Host "  OK: Rust installed successfully!" -ForegroundColor Green
        } else {
            Write-Host "  WARNING: Rust installed but not in PATH. Please restart your terminal." -ForegroundColor Yellow
            Write-Host "  After restarting, run this script again." -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "  ERROR: Failed to install Rust: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Please install Rust manually:" -ForegroundColor Yellow
        Write-Host "  1. Visit https://rustup.rs/" -ForegroundColor White
        Write-Host "  2. Download and run rustup-init.exe" -ForegroundColor White
        Write-Host "  3. Restart your terminal" -ForegroundColor White
        Write-Host "  4. Run this script again" -ForegroundColor White
        exit 1
    }
}

# Step 2: Check for Cargo
Write-Host ""
Write-Host "[2/5] Checking for Cargo..." -ForegroundColor Yellow

if (Test-Command "cargo") {
    $cargoVersion = cargo --version
    Write-Host "  OK: Cargo is installed ($cargoVersion)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Cargo not found. Please restart your terminal and run again." -ForegroundColor Red
    exit 1
}

# Step 3: Check for Node.js and pnpm
Write-Host ""
Write-Host "[3/5] Checking for Node.js and pnpm..." -ForegroundColor Yellow

if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "  OK: Node.js is installed ($nodeVersion)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Node.js not found. Please install Node.js first." -ForegroundColor Red
    Write-Host "  Visit: https://nodejs.org/" -ForegroundColor White
    exit 1
}

if (Test-Command "pnpm") {
    $pnpmVersion = pnpm --version
    Write-Host "  OK: pnpm is installed (v$pnpmVersion)" -ForegroundColor Green
} else {
    Write-Host "  pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    if (Test-Command "pnpm") {
        Write-Host "  OK: pnpm installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Failed to install pnpm" -ForegroundColor Red
        exit 1
    }
}

# Step 4: Install dependencies
Write-Host ""
Write-Host "[4/5] Installing dependencies..." -ForegroundColor Yellow

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$desktopDir = Join-Path $projectRoot "apps\desktop"

if (-not (Test-Path $desktopDir)) {
    # Try relative path from script location
    $desktopDir = Split-Path -Parent $PSScriptRoot
}

Write-Host "  Project directory: $desktopDir" -ForegroundColor Gray

Push-Location $desktopDir
try {
    Write-Host "  Installing npm packages..." -ForegroundColor Gray
    pnpm install
    Write-Host "  OK: npm packages installed" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to install npm packages: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Step 5: Build Tauri app
Write-Host ""
Write-Host "[5/5] Building Tauri application..." -ForegroundColor Yellow
Write-Host "  This may take several minutes on first build..." -ForegroundColor Gray
Write-Host ""

try {
    pnpm tauri build
    Write-Host ""
    Write-Host "  OK: Tauri app built successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERROR: Build failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Try running manually:" -ForegroundColor Yellow
    Write-Host "    cd $desktopDir" -ForegroundColor White
    Write-Host "    pnpm tauri build" -ForegroundColor White
    Pop-Location
    exit 1
}

Pop-Location

# Done!
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!                       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Piper TTS Configuration:" -ForegroundColor Cyan
Write-Host "    Voice Model: en_US-libritts-high" -ForegroundColor White
Write-Host "    Speaker ID:  3922 (p3922)" -ForegroundColor White
Write-Host ""
Write-Host "  The voice model will be downloaded automatically" -ForegroundColor Gray
Write-Host "  when you first use text-to-speech in the app." -ForegroundColor Gray
Write-Host ""
Write-Host "  To run the app in development mode:" -ForegroundColor Yellow
Write-Host "    cd $desktopDir" -ForegroundColor White
Write-Host "    pnpm tauri dev" -ForegroundColor White
Write-Host ""
Write-Host "  Built executable location:" -ForegroundColor Yellow
Write-Host "    $desktopDir\src-tauri\target\release\private-assistant.exe" -ForegroundColor White
Write-Host ""
