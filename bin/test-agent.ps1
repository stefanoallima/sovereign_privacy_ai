# Test Voice Agent startup
$env:NEBIUS_API_KEY = "v1.CmQKHHN0YXRpY2tleS1lMDBmaGs2eDJtdHFnZ3hmZzkSIXNlcnZpY2VhY2NvdW50LWUwMGN4cHYzZWU2YjVweXp4MzIMCLrI9MoGEMj3qakCOgwIucuMlgcQwOng8QFAAloDZTAw.AAAAAAAAAAHJQGfj7sZK-SiCeSPxn_1cj_gKILeIRmvjzvqbzk2VmJW6QsaTKlYx7-gmUiyj-AjEn9Sdb2AE5sv2gd_Pq64F"
$env:LIVEKIT_URL = "ws://localhost:7880"
$env:LIVEKIT_API_KEY = "devkey"
$env:LIVEKIT_API_SECRET = "secret"
$env:PIPER_MODEL_PATH = "C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant\models\en_US-lessac-medium.onnx"

$projectRoot = "C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant"
$agentDir = "$projectRoot\apps\voice-agent"
$venvPython = "$agentDir\venv\Scripts\python.exe"

Write-Host "Starting Voice Agent..." -ForegroundColor Cyan
Write-Host "LIVEKIT_URL: $env:LIVEKIT_URL"
Write-Host "PIPER_MODEL_PATH: $env:PIPER_MODEL_PATH"

Set-Location $agentDir
& $venvPython agent.py start
