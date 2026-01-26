#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

restart_count=0

while true; do
  echo -e "\n${GREEN}🚀 Starting Next.js dev server...${NC}\n"
  
  # Run the dev server with error suppression
  node suppress-errors.js dev -p 3001
  
  exit_code=$?
  
  # If exit code is 0 or 130 (Ctrl+C), exit cleanly
  if [[ $exit_code -eq 0 ]] || [[ $exit_code -eq 130 ]]; then
    echo -e "\n${GREEN}👋 Server stopped cleanly${NC}\n"
    exit 0
  fi
  
  # If exit code is 130 (Ctrl+C), exit
  if [[ $exit_code -eq 130 ]]; then
    echo -e "\n${GREEN}👋 Shutting down...${NC}\n"
    exit 0
  fi
  
  # Otherwise, restart
  restart_count=$((restart_count + 1))
  echo -e "\n${YELLOW}⚠️  Server crashed (exit code: $exit_code) - Auto-restarting ($restart_count)...${NC}\n"
  sleep 1.5
done
