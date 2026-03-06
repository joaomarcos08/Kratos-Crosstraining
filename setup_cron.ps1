$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"D:\projeto2\cron.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 9am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "KratosBillingCron" -Description "Dispara cobrancas diarias Kratos Crosstraining automaticamente." -Force
