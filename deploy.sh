#!/bin/bash
set -euo pipefail

# TradeAssistant - Full Deployment Script
# Usage: ./deploy.sh [frontend|backend|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check prerequisites
check_prereqs() {
  log "Checking prerequisites..."

  command -v node >/dev/null 2>&1 || error "Node.js not found"
  command -v npm >/dev/null 2>&1 || error "npm not found"
  command -v aws >/dev/null 2>&1 || error "AWS CLI not found. Install: brew install awscli"

  # Check AWS credentials
  aws sts get-caller-identity >/dev/null 2>&1 || error "AWS credentials not configured. Run: aws configure"

  # Check .env.local exists
  if [ ! -f .env.local ]; then
    error ".env.local not found. Copy .env.example and fill in values."
  fi

  success "Prerequisites OK"
}

# Load env vars
load_env() {
  if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
  fi
}

# Deploy backend (CDK)
deploy_backend() {
  log "Deploying AWS backend..."

  cd "$SCRIPT_DIR/infra"

  # Install dependencies
  log "Installing infra dependencies..."
  npm install

  # Install lambda layer deps
  log "Installing Lambda layer dependencies..."
  cd lambda/layers/shared/nodejs
  npm install
  cd "$SCRIPT_DIR/infra"

  # Bootstrap CDK (first time only)
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  REGION=${AWS_REGION:-ap-southeast-1}

  log "Bootstrapping CDK (account: $ACCOUNT_ID, region: $REGION)..."
  npx cdk bootstrap "aws://$ACCOUNT_ID/$REGION" 2>/dev/null || true

  # Deploy
  log "Deploying CDK stack..."
  npx cdk deploy TradeAssistant \
    --require-approval never \
    --outputs-file ../cdk-outputs.json

  cd "$SCRIPT_DIR"

  # Extract outputs
  if [ -f cdk-outputs.json ]; then
    API_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TradeAssistant',{}).get('ApiUrl',''))" 2>/dev/null || echo "")
    DIST_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TradeAssistant',{}).get('DistributionUrl',''))" 2>/dev/null || echo "")
    BUCKET=$(cat cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TradeAssistant',{}).get('SiteBucketName',''))" 2>/dev/null || echo "")

    if [ -n "$API_URL" ]; then
      success "API URL: $API_URL"
      success "Distribution: $DIST_URL"
      success "Bucket: $BUCKET"

      # Update .env.local with real values
      sed -i '' "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=${API_URL}|" .env.local 2>/dev/null || true
      sed -i '' "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${DIST_URL}|" .env.local 2>/dev/null || true

      # Extract domain for RP_ID
      DOMAIN=$(echo "$DIST_URL" | sed 's|https://||' | sed 's|/$||')
      sed -i '' "s|RP_ID=.*|RP_ID=${DOMAIN}|" .env.local 2>/dev/null || true
      sed -i '' "s|ORIGIN=.*|ORIGIN=${DIST_URL}|" .env.local 2>/dev/null || true
    fi
  fi

  success "Backend deployed"
}

# Build and deploy frontend
deploy_frontend() {
  log "Building frontend..."

  cd "$SCRIPT_DIR"

  # Install dependencies
  npm install

  # Build static export
  log "Building Next.js static export..."
  npm run build

  # Check for output
  if [ ! -d "out" ]; then
    error "Build failed - no 'out' directory created"
  fi

  # Determine bucket name
  BUCKET=""
  if [ -f cdk-outputs.json ]; then
    BUCKET=$(cat cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TradeAssistant',{}).get('SiteBucketName',''))" 2>/dev/null || echo "")
  fi

  if [ -z "$BUCKET" ]; then
    # Try to find it from AWS
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    BUCKET="tradeassistant-site-${ACCOUNT_ID}"
  fi

  log "Uploading to S3: $BUCKET"

  # Sync to S3
  aws s3 sync out/ "s3://$BUCKET/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "sw.js" \
    --exclude "manifest.json"

  # HTML files with shorter cache
  aws s3 sync out/ "s3://$BUCKET/" \
    --exclude "*" \
    --include "*.html" \
    --cache-control "public, max-age=0, must-revalidate"

  # Service worker - no cache
  aws s3 cp out/sw.js "s3://$BUCKET/sw.js" \
    --cache-control "no-cache, no-store, must-revalidate" 2>/dev/null || true

  # Manifest - short cache
  aws s3 cp out/manifest.json "s3://$BUCKET/manifest.json" \
    --cache-control "public, max-age=3600" 2>/dev/null || true

  # Invalidate CloudFront
  if [ -f cdk-outputs.json ]; then
    DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${BUCKET}.s3.amazonaws.com']].Id" --output text 2>/dev/null || echo "")
    if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
      log "Invalidating CloudFront cache..."
      aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null 2>&1 || true
      success "CloudFront invalidated"
    fi
  fi

  success "Frontend deployed"
}

# Full deployment
deploy_all() {
  check_prereqs
  load_env
  deploy_backend
  load_env  # Reload after backend updates .env.local
  deploy_frontend

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  TradeAssistant - Deployment Complete!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
  echo ""

  if [ -f cdk-outputs.json ]; then
    DIST_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TradeAssistant',{}).get('DistributionUrl',''))" 2>/dev/null || echo "")
    API_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TradeAssistant',{}).get('ApiUrl',''))" 2>/dev/null || echo "")
    echo -e "  App:  ${BLUE}${DIST_URL}${NC}"
    echo -e "  API:  ${BLUE}${API_URL}${NC}"
    echo ""
    echo -e "  ${YELLOW}Next steps:${NC}"
    echo -e "  1. Open the URL on your iPhone"
    echo -e "  2. Add to Home Screen (Share → Add to Home Screen)"
    echo -e "  3. Register your passkey (Face ID)"
    echo -e "  4. Enable notifications"
    echo ""
  fi
}

# Parse command
case "${1:-all}" in
  frontend)
    check_prereqs
    load_env
    deploy_frontend
    ;;
  backend)
    check_prereqs
    load_env
    deploy_backend
    ;;
  all)
    deploy_all
    ;;
  *)
    echo "Usage: ./deploy.sh [frontend|backend|all]"
    exit 1
    ;;
esac
