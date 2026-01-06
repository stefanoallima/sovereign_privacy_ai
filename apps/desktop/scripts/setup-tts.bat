@echo off
REM Setup script for Private Assistant with Piper TTS
REM This batch file runs the PowerShell setup script

echo.
echo ========================================
echo   Private Assistant - TTS Setup
echo ========================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: PowerShell not found. Please install PowerShell.
    pause
    exit /b 1
)

REM Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0setup-tts.ps1"

pause
