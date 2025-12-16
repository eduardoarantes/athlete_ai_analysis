#!/bin/bash
# Start FastAPI development server

set -e

echo "Starting FastAPI development server..."
echo "API will be available at: http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start uvicorn with hot reload
uvicorn cycling_ai.api.main:app \
    --reload \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info
