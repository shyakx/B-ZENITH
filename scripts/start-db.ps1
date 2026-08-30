$ErrorActionPreference = "Stop"
$bin = "$env:LOCALAPPDATA\pgsql-client\pgsql\bin"
$data = "$env:LOCALAPPDATA\bzenith-pgdata"

if (-not (Test-Path "$bin\pg_ctl.exe")) {
  Write-Host "PostgreSQL binaries were not found. Start Docker instead: docker compose up -d"
  exit 1
}

if (-not (Test-Path "$data\PG_VERSION")) {
  & "$bin\initdb.exe" -D $data -U bzenith --auth=trust --encoding=UTF8 --locale=C
}

& "$bin\pg_ctl.exe" -D $data -l "$data\postgres.log" start
Start-Sleep -Seconds 2
$exists = & "$bin\psql.exe" -h 127.0.0.1 -U bzenith -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='bzenith'"
if (-not $exists) {
  & "$bin\createdb.exe" -h 127.0.0.1 -U bzenith bzenith
}
Write-Host "B-ZENITH database is running on localhost:5432"
