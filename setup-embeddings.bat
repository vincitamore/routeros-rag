@echo off
setlocal enabledelayedexpansion

echo 🔄 Setting up pre-built embeddings...

REM Check if ChromaDB is running
docker-compose ps | findstr /C:"chroma" | findstr /C:"Up" >nul
if !errorlevel! neq 0 (
    echo ⚠️  ChromaDB is not running. Starting ChromaDB...
    docker-compose up -d
    echo ⏳ Waiting for ChromaDB to be ready...
    timeout /t 10 /nobreak >nul
)

REM Check if embeddings archive exists
if not exist "chroma-data.tar.gz" (
    echo ❌ Pre-built embeddings not found (chroma-data.tar.gz missing^)
    echo ℹ️  Please run the ingestion process manually:
    echo    pnpm --filter api run ingest
    pause
    exit /b 1
)

REM Get the container name
for /f "tokens=*" %%i in ('docker-compose ps -q chroma') do set CONTAINER_NAME=%%i

if "!CONTAINER_NAME!"=="" (
    echo ❌ ChromaDB container not found
    pause
    exit /b 1
)

echo 📦 Restoring pre-built embeddings...

REM Clear existing data and restore from backup
docker exec !CONTAINER_NAME! rm -rf /chroma/.chroma/index/*
docker cp chroma-data.tar.gz !CONTAINER_NAME!:/tmp/
docker exec !CONTAINER_NAME! tar -xzf /tmp/chroma-data.tar.gz -C /chroma/.chroma/index

echo ✅ Pre-built embeddings restored successfully!
echo 🎉 RouterOS documentation embeddings are ready to use!
pause 