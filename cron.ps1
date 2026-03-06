$logPath = "D:\projeto2\cron_log.txt"
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/billing" -Method Get -ErrorAction Stop
    $responseJson = $response | ConvertTo-Json -Depth 5 -Compress
    Add-Content -Path $logPath -Value "[$date] SUCCESS: $responseJson"
} catch {
    Add-Content -Path $logPath -Value "[$date] ERROR: $_"
}
