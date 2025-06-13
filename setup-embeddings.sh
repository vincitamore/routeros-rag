#!/bin/bash
set -e

echo "🔄 Setting up pre-built embeddings..."

# Check if ChromaDB is running
if ! docker-compose ps | grep -q "chroma.*Up"; then
    echo "⚠️  ChromaDB is not running. Starting ChromaDB..."
    docker-compose up -d
    echo "⏳ Waiting for ChromaDB to be ready..."
    sleep 10
fi

# Check if embeddings archive exists
if [ ! -f "chroma-data.tar.gz" ]; then
    echo "❌ Pre-built embeddings not found (chroma-data.tar.gz missing)"
    echo "ℹ️  Please run the ingestion process manually:"
    echo "   pnpm --filter api run ingest"
    exit 1
fi

# Get the container name
CONTAINER_NAME=$(docker-compose ps -q chroma)

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ ChromaDB container not found"
    exit 1
fi

echo "📦 Restoring pre-built embeddings..."

# Clear existing data and restore from backup
docker exec $CONTAINER_NAME rm -rf /chroma/.chroma/index/*
docker cp chroma-data.tar.gz $CONTAINER_NAME:/tmp/
docker exec $CONTAINER_NAME tar -xzf /tmp/chroma-data.tar.gz -C /chroma/.chroma/index

echo "✅ Pre-built embeddings restored successfully!"
echo "🎉 RouterOS documentation embeddings are ready to use!"
