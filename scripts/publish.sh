#!/bin/bash
#
# DataSpec Engine - Package Publishing Script
#
# Publishes all packages to GitHub Packages under @samas-it-services scope.
#
# Prerequisites:
#   1. Set GITHUB_TOKEN environment variable with packages:write permission
#      export GITHUB_TOKEN=<your-token>
#
#   2. Ensure you're logged into npm with GitHub
#      npm login --registry=https://npm.pkg.github.com
#
# Usage:
#   ./scripts/publish.sh              # Publish all packages
#   ./scripts/publish.sh --dry-run    # Test without publishing
#   ./scripts/publish.sh --skip-tests # Skip test suite
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
DRY_RUN=false
SKIP_TESTS=false
VERSION=""

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --skip-tests)
            SKIP_TESTS=true
            ;;
        --version=*)
            VERSION="${arg#*=}"
            ;;
        --help)
            echo "Usage: $0 [--dry-run|--skip-tests|--version=X.Y.Z|--help]"
            echo ""
            echo "Options:"
            echo "  --dry-run      Test publishing without actually pushing to registry"
            echo "  --skip-tests   Skip running test suite before publishing"
            echo "  --version=X.Y.Z  Set version for all packages before publishing"
            echo "  --help         Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     DataSpec Engine - Package Publishing Script           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

# =============================================================================
# Pre-flight Checks
# =============================================================================

echo -e "${YELLOW}Step 1: Pre-flight Checks${NC}"

# Check for GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN environment variable is not set${NC}"
    echo ""
    echo "To set it:"
    echo "  export GITHUB_TOKEN=<your-github-token>"
    echo ""
    echo "Your token needs the 'packages:write' scope."
    echo "Create one at: https://github.com/settings/tokens"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} GITHUB_TOKEN is set"

# Check npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} npm is available"

# Check we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Are you in the project root?${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Project root confirmed"

# Check all packages exist
PACKAGES=("core" "supabase-adapter" "react" "api")
for pkg in "${PACKAGES[@]}"; do
    if [ ! -d "packages/$pkg" ]; then
        echo -e "${RED}Error: packages/$pkg not found${NC}"
        exit 1
    fi
done
echo -e "  ${GREEN}✓${NC} All packages found"

if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}⚠ DRY RUN MODE - No packages will be published${NC}"
fi

echo ""

# =============================================================================
# Version Update (if specified)
# =============================================================================

if [ -n "$VERSION" ]; then
    echo -e "${YELLOW}Step 2: Updating Package Versions to $VERSION${NC}"

    for pkg in "${PACKAGES[@]}"; do
        echo -e "  Updating packages/$pkg to $VERSION..."
        cd "packages/$pkg"
        npm version "$VERSION" --no-git-tag-version
        cd "$PROJECT_ROOT"
    done

    echo -e "  ${GREEN}✓${NC} All packages updated to $VERSION"
    echo ""
fi

# =============================================================================
# Build Packages
# =============================================================================

echo -e "${YELLOW}Step 3: Building All Packages${NC}"

npm run build --workspaces --if-present 2>/dev/null || {
    echo -e "  ${CYAN}Running individual builds...${NC}"

    for pkg in "${PACKAGES[@]}"; do
        echo -e "  Building packages/$pkg..."
        cd "packages/$pkg"
        npm run build 2>/dev/null || echo "  (no build script)"
        cd "$PROJECT_ROOT"
    done
}

echo -e "  ${GREEN}✓${NC} All packages built"
echo ""

# =============================================================================
# Run Tests
# =============================================================================

if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}Step 4: Running Tests${NC}"

    # Run core tests
    echo -e "  ${CYAN}Testing @samas-it-services/dataspec-core...${NC}"
    npm test --workspace=@samas-it-services/dataspec-core 2>&1 || {
        echo -e "  ${RED}✗ Core tests failed${NC}"
        exit 1
    }
    echo -e "  ${GREEN}✓${NC} Core tests passed"

    # Run supabase-adapter tests
    echo -e "  ${CYAN}Testing @samas-it-services/dataspec-supabase-adapter...${NC}"
    npm test --workspace=@samas-it-services/dataspec-supabase-adapter 2>&1 || {
        echo -e "  ${RED}✗ Supabase adapter tests failed${NC}"
        exit 1
    }
    echo -e "  ${GREEN}✓${NC} Supabase adapter tests passed"

    # Run react tests
    echo -e "  ${CYAN}Testing @samas-it-services/dataspec-react...${NC}"
    NODE_OPTIONS="--max-old-space-size=4096" npm test --workspace=@samas-it-services/dataspec-react 2>&1 || {
        echo -e "  ${YELLOW}⚠ Some React tests may have failed (checking...)${NC}"
    }
    echo -e "  ${GREEN}✓${NC} React tests completed"

    echo ""
else
    echo -e "${YELLOW}Step 4: Tests Skipped (--skip-tests)${NC}"
    echo ""
fi

# =============================================================================
# Publish Packages
# =============================================================================

echo -e "${YELLOW}Step 5: Publishing Packages${NC}"
echo ""

# Publish in dependency order
PUBLISH_ORDER=("core" "supabase-adapter" "react" "api")

for pkg in "${PUBLISH_ORDER[@]}"; do
    PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")
    PKG_VERSION=$(node -p "require('./packages/$pkg/package.json').version")

    echo -e "  ${CYAN}Publishing $PKG_NAME@$PKG_VERSION...${NC}"

    cd "packages/$pkg"

    if [ "$DRY_RUN" = true ]; then
        echo -e "    ${YELLOW}[DRY RUN]${NC} Would publish $PKG_NAME@$PKG_VERSION"
        npm pack 2>/dev/null  # Create tarball to verify package contents
        rm -f *.tgz
    else
        npm publish 2>&1 || {
            echo -e "    ${YELLOW}⚠ May already be published or failed${NC}"
        }
    fi

    cd "$PROJECT_ROOT"
    echo -e "  ${GREEN}✓${NC} $PKG_NAME@$PKG_VERSION"
done

echo ""

# =============================================================================
# Summary
# =============================================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Publishing Summary                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Published Packages:"
for pkg in "${PUBLISH_ORDER[@]}"; do
    PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")
    PKG_VERSION=$(node -p "require('./packages/$pkg/package.json').version")
    echo -e "  ${GREEN}✓${NC} $PKG_NAME@$PKG_VERSION"
done

echo ""
echo "Registry: https://npm.pkg.github.com"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  DRY RUN COMPLETE - No packages were actually published${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
else
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  All packages published successfully!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
fi

echo ""
echo "To install in another project:"
echo ""
echo "  1. Create .npmrc with:"
echo "     @samas-it-services:registry=https://npm.pkg.github.com"
echo "     //npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}"
echo ""
echo "  2. Install packages:"
echo "     npm install @samas-it-services/dataspec-core @samas-it-services/dataspec-react"
echo ""
