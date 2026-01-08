$ProgressPreference = 'SilentlyContinue'
$binDir = "C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant\bin"

Write-Host "Fetching latest LiveKit release info..."
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/livekit/livekit/releases/latest'
$asset = $release.assets | Where-Object { $_.name -like '*windows_amd64.zip' } | Select-Object -First 1

if ($asset) {
    Write-Host "Downloading $($asset.name)..."
    $zipPath = "$binDir\livekit.zip"
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

    Write-Host "Extracting..."
    Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
    Remove-Item $zipPath

    Write-Host "Done! LiveKit server installed."
} else {
    Write-Host "ERROR: Could not find Windows release"
    exit 1
}
