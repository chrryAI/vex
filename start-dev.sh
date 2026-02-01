#!/bin/bash

echo "🚀 Starting Vex Development Environment..."

# Check if OrbStack is running
if ! pgrep -x "OrbStack" > /dev/null; then
    echo "📦 Starting OrbStack..."
    open -a OrbStack
    echo "⏳ Waiting for OrbStack to start..."
    sleep 5
fi

# Check if Redis is running
if ! docker ps | grep -q redis; then
    echo "🔴 Starting Redis..."
    docker start redis || docker run -d --name redis -p 6379:6379 redis:alpine
fi

# Check if FalkorDB is running
if ! docker ps | grep -q falkordb; then
    echo "📊 Starting FalkorDB..."
    docker start falkordb || docker run -d --name falkordb -p 6380:6379 falkordb/falkordb:latest
fi

echo "✅ All services started!"
echo "🎯 Starting dev servers..."

# Start turbo dev
bun run dev
