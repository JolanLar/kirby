#!/bin/bash
# Start backend and frontend concurrently

echo "Starting Kirby Media Deletion Manager..."

cd backend
npm run dev &
BACKEND_PID=$!

cd ../frontend
npm run dev &
FRONTEND_PID=$!

function cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID
  kill $FRONTEND_PID
  exit
}

trap cleanup INT TERM

wait
