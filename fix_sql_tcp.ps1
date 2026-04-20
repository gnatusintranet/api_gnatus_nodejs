# Encontra o path da instância MSSQLSERVER no registry e habilita o TCP/IP
$rootPath = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server'
$instances = Get-ChildItem $rootPath | Where-Object { $_.PSChildName -match '^MSSQL\d+\.' }

foreach ($inst in $instances) {
    $tcpPath = Join-Path $inst.PSPath 'MSSQLServer\SuperSocketNetLib\Tcp'
    if (Test-Path $tcpPath) {
        $val = (Get-ItemProperty $tcpPath).Enabled
        Write-Output "Instancia: $($inst.PSChildName) | TCP Enabled atual: $val"
        Set-ItemProperty -Path $tcpPath -Name Enabled -Value 1
        Write-Output "TCP/IP habilitado para $($inst.PSChildName)"
    }
}

Write-Output "Reiniciando servico MSSQLSERVER..."
Restart-Service MSSQLSERVER -Force
Write-Output "Servico reiniciado. Aguardando 5s..."
Start-Sleep -Seconds 5

$conn = Test-NetConnection -ComputerName localhost -Port 1433
Write-Output "Porta 1433 aberta: $($conn.TcpTestSucceeded)"
