# Starts the vending POS backend + frontend as independent background processes.
# Safe to run multiple times - it kills anything already on the ports first.

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$logDir = Join-Path $root "logs"

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Stop-PortOwner($port) {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Stop-PortOwner 4000
Stop-PortOwner 5500
Start-Sleep -Seconds 1

Start-Process -FilePath "node.exe" `
  -ArgumentList "server.js" `
  -WorkingDirectory $backendDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir "backend.log") `
  -RedirectStandardError (Join-Path $logDir "backend.err.log")

Start-Process -FilePath "node.exe" `
  -ArgumentList "dev-server.js", "5500" `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir "frontend.log") `
  -RedirectStandardError (Join-Path $logDir "frontend.err.log")

Write-Output "Started backend (port 4000) and frontend (port 5500) as background processes."
