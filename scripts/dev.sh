#!/bin/bash
# Development environment startup script
set -e

echo "=== AudioBlog Development Environment ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required"; exit 1; }

# Backend setup
echo "Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv 2>/dev/null || true
fi
pip3 install -r requirements.txt -q 2>/dev/null

# Frontend setup
echo "Setting up frontend..."
cd ../frontend
npm install --silent 2>/dev/null

echo ""
echo "Starting services..."
echo "  Backend:  http://localhost:8080"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8080/docs"
echo ""

# Start backend and frontend
cd ..
(cd backend && uvicorn app.main:app --reload --port 8080) &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
