#Requires -Version 5.1
Set-Location $PSScriptRoot

Write-Host "Iniciando Chirola en modo desarrollo..."

function Free-Port {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        $processIds = $connections.OwningProcess | Sort-Object -Unique
        foreach ($processId in $processIds) {
            Write-Host "Liberando puerto $Port (proceso previo: $processId)..."
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-Port {
    param([string]$ComputerName, [int]$Port, [int]$TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ($true) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect($ComputerName, $Port)
            if ($client.Connected) { return $true }
        } catch {
        } finally {
            $client.Close()
        }
        if ((Get-Date) -gt $deadline) { return $false }
        Start-Sleep -Seconds 1
    }
}

function Test-DockerRunning {
    try {
        docker info 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Ensure-Docker {
    if (Test-DockerRunning) { return }

    Write-Host "Docker no esta corriendo. Iniciando Docker Desktop..."
    $candidates = @(
        (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path $env:LocalAppData 'Docker\Docker Desktop.exe')
    )
    $dockerExe = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $dockerExe) {
        Write-Host "No encontre Docker Desktop. Abrilo manualmente, espera a 'Engine running' y volve a correr .\dev.ps1"
        exit 1
    }
    Start-Process $dockerExe | Out-Null

    Write-Host "Esperando a que Docker este listo (puede tardar hasta 2 min la primera vez)..."
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 3
        if (Test-DockerRunning) {
            Write-Host "Docker listo"
            return
        }
        Write-Host "  Todavia esperando Docker... ($($i + 1)/40)"
    }
    Write-Host "Docker no respondio a tiempo. Abrilo manualmente y volve a correr .\dev.ps1"
    exit 1
}

Write-Host "Cerrando ejecuciones previas..."
Free-Port 3000
Free-Port 8081

Ensure-Docker

Write-Host "Iniciando PostgreSQL..."
docker compose up -d db

Write-Host "Esperando a que PostgreSQL este listo..."
if (-not (Wait-Port -ComputerName '127.0.0.1' -Port 5432 -TimeoutSeconds 30)) {
    Write-Host "PostgreSQL no respondio a tiempo"
    exit 1
}
Write-Host "PostgreSQL listo"

$backendOutLog = Join-Path $env:TEMP 'chirola-backend.log'
$backendErrLog = Join-Path $env:TEMP 'chirola-backend.err.log'

Write-Host "Iniciando Backend..."
$backend = Start-Process -FilePath 'pnpm.cmd' -ArgumentList 'api:dev' `
    -RedirectStandardOutput $backendOutLog -RedirectStandardError $backendErrLog `
    -NoNewWindow -PassThru
Write-Host "Backend PID: $($backend.Id)"

try {
    Write-Host "Esperando a que el backend este listo..."
    if (-not (Wait-Port -ComputerName '127.0.0.1' -Port 3000 -TimeoutSeconds 60)) {
        Write-Host "El backend no respondio a tiempo. Ver logs: Get-Content -Wait `"$backendOutLog`""
        exit 1
    }
    Write-Host "Backend listo en http://localhost:3000"

    $lanIp = (Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        Select-Object -First 1).IPv4Address.IPAddress
    $mobileEnv = Join-Path $PSScriptRoot 'apps\mobile\.env'
    if ($lanIp -and -not (Test-Path $mobileEnv)) {
        "EXPO_PUBLIC_API_URL=http://$($lanIp):3000/api" | Out-File -FilePath $mobileEnv -Encoding utf8
        Write-Host "Generado $mobileEnv apuntando a http://$($lanIp):3000/api (para Expo Go en dispositivo fisico)"
    }

    Write-Host ""
    Write-Host "Logs del backend: Get-Content -Wait `"$backendOutLog`""
    Write-Host ""
    Write-Host "Iniciando Expo..."
    Write-Host ""

    pnpm mobile:dev
}
finally {
    Write-Host ""
    Write-Host "Deteniendo backend..."
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Free-Port 3000
    Free-Port 8081
}
