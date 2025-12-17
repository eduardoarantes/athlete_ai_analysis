#!/bin/bash
# Build Lambda deployment package for Cycling AI API
#
# Creates a zip file containing:
# - Python source code from src/cycling_ai
# - All dependencies from requirements-lambda.txt
#
# Usage:
#   ./scripts/build-lambda.sh
#
# Output:
#   dist/lambda.zip

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Lambda deployment package...${NC}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT"

# Clean previous build
echo -e "${YELLOW}Cleaning previous build...${NC}"
rm -rf dist
mkdir -p dist/package

# Install dependencies into package directory
echo -e "${YELLOW}Installing dependencies...${NC}"
if [ -f "requirements-lambda.txt" ]; then
    pip install \
        --platform manylinux2014_x86_64 \
        --target dist/package \
        --implementation cp \
        --python-version 3.11 \
        --only-binary=:all: \
        --upgrade \
        -r requirements-lambda.txt
else
    echo -e "${RED}Error: requirements-lambda.txt not found${NC}"
    echo "Please create requirements-lambda.txt with Lambda dependencies"
    exit 1
fi

# Copy source code
echo -e "${YELLOW}Copying source code...${NC}"
cp -r src/cycling_ai dist/package/

# Copy any additional config files needed at runtime
if [ -f "src/cycling_ai/config/defaults.py" ]; then
    echo -e "${YELLOW}Including config files...${NC}"
fi

# Remove unnecessary files to reduce package size
echo -e "${YELLOW}Cleaning up package...${NC}"
cd dist/package

# Remove test files
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true

# Remove documentation
find . -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.md" -delete 2>/dev/null || true
find . -name "*.rst" -delete 2>/dev/null || true

# Remove dist-info except for required metadata
find . -type d -name "*.dist-info" -exec sh -c 'rm -rf "$1"/*.txt "$1"/licenses' _ {} \; 2>/dev/null || true

# Create zip file
echo -e "${YELLOW}Creating zip file...${NC}"
zip -r9 ../lambda.zip . -x "*.pyc" -x "*__pycache__*" -x "*.git*"

cd "$PROJECT_ROOT"

# Get zip file size
ZIP_SIZE=$(du -h dist/lambda.zip | cut -f1)
echo -e "${GREEN}Lambda package created: dist/lambda.zip (${ZIP_SIZE})${NC}"

# Check if package exceeds Lambda limit (250MB unzipped, 50MB zipped for direct upload)
ZIP_BYTES=$(stat -f%z dist/lambda.zip 2>/dev/null || stat -c%s dist/lambda.zip)
MAX_BYTES=$((50 * 1024 * 1024))  # 50MB

if [ "$ZIP_BYTES" -gt "$MAX_BYTES" ]; then
    echo -e "${YELLOW}Warning: Package exceeds 50MB direct upload limit${NC}"
    echo "Consider using S3 for deployment or reducing dependencies"
else
    echo -e "${GREEN}Package size is within Lambda limits${NC}"
fi

echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Create terraform.tfvars with your secrets"
echo "  2. Run: cd infrastructure/terraform && terraform init && terraform apply"
echo "  3. Or update existing Lambda: aws lambda update-function-code --function-name cycling-ai-api-prod --zip-file fileb://dist/lambda.zip"
