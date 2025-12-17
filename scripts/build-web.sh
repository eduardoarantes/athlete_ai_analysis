#!/bin/bash
# Build Next.js static export for S3/CloudFront deployment
#
# Creates a static HTML export in web/out/ suitable for S3 hosting.
#
# Usage:
#   ./scripts/build-web.sh
#
# Output:
#   web/out/ - Static HTML files ready for S3 sync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Next.js static export...${NC}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT/web"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    echo "Install it with: npm install -g pnpm"
    exit 1
fi

# Check for .env.production
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}Warning: .env.production not found${NC}"
    echo "Creating template .env.production..."
    cat > .env.production << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration (set after terraform apply)
NEXT_PUBLIC_API_URL=https://your-lambda-url.lambda-url.us-east-1.on.aws

# Environment
NEXT_PUBLIC_ENV=production
EOF
    echo -e "${YELLOW}Please update web/.env.production with your values${NC}"
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Type check
echo -e "${YELLOW}Running type check...${NC}"
pnpm type-check || {
    echo -e "${RED}Type check failed. Fix errors before deploying.${NC}"
    exit 1
}

# Lint
echo -e "${YELLOW}Running lint...${NC}"
pnpm lint || {
    echo -e "${YELLOW}Lint warnings found. Review before deploying.${NC}"
}

# Build with static export enabled
echo -e "${YELLOW}Building production bundle (static export)...${NC}"
NEXT_EXPORT=true pnpm build

# Check output
if [ -d "out" ]; then
    FILE_COUNT=$(find out -type f | wc -l | tr -d ' ')
    DIR_SIZE=$(du -sh out | cut -f1)
    echo -e "${GREEN}Build successful!${NC}"
    echo "Output: web/out/ (${FILE_COUNT} files, ${DIR_SIZE})"
else
    echo -e "${RED}Build failed: out/ directory not created${NC}"
    echo "Check next.config.ts has output: 'export'"
    exit 1
fi

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Ensure .env.production has correct API_URL from terraform output"
echo "  2. Deploy to S3:"
echo "     aws s3 sync web/out/ s3://\$(terraform -chdir=infrastructure/terraform output -raw s3_bucket_name) --delete"
echo "  3. Invalidate CloudFront:"
echo "     aws cloudfront create-invalidation --distribution-id \$(terraform -chdir=infrastructure/terraform output -raw cloudfront_distribution_id) --paths '/*'"
