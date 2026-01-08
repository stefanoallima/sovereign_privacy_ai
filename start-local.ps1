# Private Personal Assistant - Local Development Setup Script
# Run this script from the project root directory

param(
    [switch]$SkipDownloads,
    [switch]$AgentOnly,
    [switch]$LiveKitOnly,
    [switch]$TauriOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$ModelsDir = "$ProjectRoot\models"
$BinDir = "$ProjectRoot\bin"
$VoiceAgentDir = "$ProjectRoot\apps\voice-agent"
$DesktopDir = "$ProjectRoot\apps\desktop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "    [X] $msg" -ForegroundColor Red }

Write-Host @"

 ____       _            _         _____                                 _
|  _ \ _ __(_)_   ____ _| |_ ___  |  _  |___ _ __ ___  ___  _ __   __ _| |
| |_) | '__| \ \ / / _` | __/ _ \ | |_) / _ \ '__/ __|/ _ \| '_ \ / _` | |
|  __/| |  | |\ V / (_| | ||  __/ |  __/  __/ |  \__ \ (_) | | | | (_| | |
|_|   |_|  |_| \_/ \__,_|\__\___| |_|   \___|_|  |___/\___/|_| |_|\__,_|_|

              Local Development Environment Setup
"@ -ForegroundColor Magenta

# ============================================================================
# Check Prerequisites
# ============================================================================
Write-Step "Checking prerequisites..."

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Success "Python: $pythonVersion"
} catch {
    Write-Error "Python not found. Please install Python 3.10+"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Success "Node.js: $nodeVersion"
} catch {
    Write-Error "Node.js not found. Please install Node.js"
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm --version 2>&1
    Write-Success "pnpm: $pnpmVersion"
} catch {
    Write-Warning "pnpm not found. Installing..."
    npm install -g pnpm
}

# ============================================================================
# Environment Variables
# ============================================================================
Write-Step "Setting up environment variables..."

# Load .env file if exists
$envFile = "$ProjectRoot\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Success "Loaded: $name"
        }
    }
}

# Check for required API key
if (-not $env:NEBIUS_API_KEY) {
    Write-Warning "NEBIUS_API_KEY not set!"
    $apiKey = Read-Host "Enter your Nebius API key (or press Enter to skip)"
    if ($apiKey) {
        $env:NEBIUS_API_KEY = $apiKey
        # Save to .env file
        Add-Content -Path $envFile -Value "NEBIUS_API_KEY=$apiKey"
        Write-Success "API key saved to .env"
    } else {
        Write-Warning "Skipping API key - LLM features won't work"
    }
}

# Set LiveKit credentials
$env:LIVEKIT_URL = "ws://localhost:7880"
$env:LIVEKIT_API_KEY = "devkey"
$env:LIVEKIT_API_SECRET = "secret"

Write-Success "LiveKit URL: $env:LIVEKIT_URL"

# ============================================================================
# Create Directories
# ============================================================================
Write-Step "Creating directories..."

if (-not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
    Write-Success "Created: $ModelsDir"
}

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    Write-Success "Created: $BinDir"
}

# ============================================================================
# Download LiveKit Server
# ============================================================================
if (-not $SkipDownloads) {
    Write-Step "Checking LiveKit server..."

    $liveKitExe = "$BinDir\livekit-server.exe"

    if (-not (Test-Path $liveKitExe)) {
        Write-Host "    Downloading LiveKit server..." -ForegroundColor Yellow

        # Get latest release info
        $releaseUrl = "https://api.github.com/repos/livekit/livekit/releases/latest"
        try {
            $release = Invoke-RestMethod -Uri $releaseUrl -Headers @{"User-Agent"="PowerShell"}
            $version = $release.tag_name

            # Find Windows AMD64 asset
            $asset = $release.assets | Where-Object { $_.name -like "*windows_amd64.zip" } | Select-Object -First 1

            if ($asset) {
                $zipPath = "$BinDir\livekit-server.zip"

                Write-Host "    Downloading $($asset.name) ($version)..." -ForegroundColor Yellow
                Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

                Write-Host "    Extracting..." -ForegroundColor Yellow
                Expand-Archive -Path $zipPath -DestinationPath $BinDir -Force
                Remove-Item $zipPath

                Write-Success "LiveKit server installed: $version"
            } else {
                Write-Error "Could not find Windows release"
            }
        } catch {
            Write-Warning "Could not download LiveKit server: $_"
            Write-Warning "Please download manually from: https://github.com/livekit/livekit/releases"
        }
    } else {
        Write-Success "LiveKit server already installed"
    }
}

# ============================================================================
# Download Piper TTS Model
# ============================================================================
if (-not $SkipDownloads) {
    Write-Step "Checking Piper TTS model..."

    $piperModel = "$ModelsDir\en_US-lessac-medium.onnx"
    $piperModelJson = "$ModelsDir\en_US-lessac-medium.onnx.json"

    if (-not (Test-Path $piperModel)) {
        Write-Host "    Downloading Piper voice model..." -ForegroundColor Yellow

        try {
            Invoke-WebRequest `
                -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx" `
                -OutFile $piperModel
            Write-Success "Downloaded: en_US-lessac-medium.onnx"
        } catch {
            Write-Warning "Could not download Piper model: $_"
        }
    } else {
        Write-Success "Piper model already downloaded"
    }

    if (-not (Test-Path $piperModelJson)) {
        try {
            Invoke-WebRequest `
                -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" `
                -OutFile $piperModelJson
            Write-Success "Downloaded: en_US-lessac-medium.onnx.json"
        } catch {
            Write-Warning "Could not download Piper model config: $_"
        }
    }

    $env:PIPER_MODEL_PATH = $piperModel
}

# ============================================================================
# Setup Python Virtual Environment
# ============================================================================
Write-Step "Setting up Python environment..."

$venvPath = "$VoiceAgentDir\venv"
$venvPython = "$venvPath\Scripts\python.exe"
$venvPip = "$venvPath\Scripts\pip.exe"

if (-not (Test-Path $venvPath)) {
    Write-Host "    Creating virtual environment..." -ForegroundColor Yellow
    python -m venv $venvPath
    Write-Success "Virtual environment created"
}

# Install/update dependencies
Write-Host "    Installing Python dependencies..." -ForegroundColor Yellow
& $venvPip install -r "$VoiceAgentDir\requirements.txt" -q
Write-Success "Python dependencies installed"

# ============================================================================
# Setup Node.js Dependencies
# ============================================================================
Write-Step "Setting up Node.js dependencies..."

Push-Location $DesktopDir
if (-not (Test-Path "node_modules")) {
    Write-Host "    Installing npm packages..." -ForegroundColor Yellow
    pnpm install
}
Write-Success "Node.js dependencies ready"
Pop-Location

# ============================================================================
# Start Services
# ============================================================================
Write-Host "`n" + "="*60 -ForegroundColor White
Write-Host "  Starting Services" -ForegroundColor White
Write-Host "="*60 -ForegroundColor White

$jobs = @()

# Function to start a process in a new window
function Start-ServiceWindow {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDir,
        [hashtable]$Environment = @{}
    )

    $envString = ""
    foreach ($key in $Environment.Keys) {
        $envString += "`$env:$key='$($Environment[$key])'; "
    }

    $fullCommand = "cd '$WorkingDir'; $envString $Command; Read-Host 'Press Enter to close'"

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $fullCommand -PassThru
}

# Start LiveKit Server
if (-not $AgentOnly -and -not $TauriOnly) {
    Write-Step "Starting LiveKit server..."

    $liveKitExe = "$BinDir\livekit-server.exe"
    if (Test-Path $liveKitExe) {
        $lkProcess = Start-ServiceWindow `
            -Name "LiveKit" `
            -Command "& '$liveKitExe' --dev --bind 0.0.0.0" `
            -WorkingDir $BinDir

        Write-Success "LiveKit server starting on ws://localhost:7880"
        Start-Sleep -Seconds 2  # Give it time to start
    } else {
        Write-Warning "LiveKit server not found. Using Docker fallback..."
        docker run -d --name livekit-dev -p 7880:7880 -p 7881:7881 -p 7882:7882/udp `
            -e "LIVEKIT_KEYS=devkey: secret" `
            livekit/livekit-server --dev --bind 0.0.0.0
        Write-Success "LiveKit server starting via Docker"
    }
}

# Start Voice Agent
if (-not $LiveKitOnly -and -not $TauriOnly) {
    Write-Step "Starting Voice Agent..."

    $agentEnv = @{
        "NEBIUS_API_KEY" = $env:NEBIUS_API_KEY
        "LIVEKIT_URL" = $env:LIVEKIT_URL
        "LIVEKIT_API_KEY" = $env:LIVEKIT_API_KEY
        "LIVEKIT_API_SECRET" = $env:LIVEKIT_API_SECRET
        "PIPER_MODEL_PATH" = $env:PIPER_MODEL_PATH
    }

    $agentProcess = Start-ServiceWindow `
        -Name "VoiceAgent" `
        -Command "& '$venvPython' agent.py start" `
        -WorkingDir $VoiceAgentDir `
        -Environment $agentEnv

    Write-Success "Voice Agent starting..."
    Start-Sleep -Seconds 3  # Give it time to load models
}

# Start Tauri Dev Server
if (-not $AgentOnly -and -not $LiveKitOnly) {
    Write-Step "Starting Tauri development server..."

    # Add Cargo to PATH
    $env:Path = $env:Path + ";C:\Users\tucan\.cargo\bin"

    $tauriProcess = Start-ServiceWindow `
        -Name "Tauri" `
        -Command "`$env:Path = `$env:Path + ';C:\Users\tucan\.cargo\bin'; pnpm tauri dev" `
        -WorkingDir $DesktopDir

    Write-Success "Tauri dev server starting..."
}

# ============================================================================
# Summary
# ============================================================================
Write-Host "`n" + "="*60 -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "="*60 -ForegroundColor Green

Write-Host @"

Services running:
  - LiveKit Server:  ws://localhost:7880 (API: devkey/secret)
  - Voice Agent:     Listening for LiveKit connections
  - Tauri App:       Opening in development mode

To test voice chat:
  1. Wait for the Tauri app window to open
  2. Click 'LK' button to switch to LiveKit mode
  3. Click the microphone icon to open voice panel
  4. Click the phone button to connect
  5. Hold the mic button to speak

Logs:
  - Each service runs in its own PowerShell window
  - Check individual windows for detailed logs

To stop all services:
  - Close all PowerShell windows
  - Or run: Get-Process | Where-Object {`$_.ProcessName -match 'livekit|python|node'} | Stop-Process

"@ -ForegroundColor White

Write-Host "Press any key to keep this window open (services will continue running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
