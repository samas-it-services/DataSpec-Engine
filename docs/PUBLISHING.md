# DataSpec Engine - Publishing Guide

This guide explains how to publish DataSpec Engine packages to GitHub Packages under the `@samas` scope.

## Package Overview

| Package | Description | Dependencies |
|---------|-------------|--------------|
| `@samas/dataspec-core` | Core engine - YAML parsing, validation, transformation, masking | None |
| `@samas/dataspec-supabase-adapter` | Supabase database integration | `@samas/dataspec-core` |
| `@samas/dataspec-react` | React UI components and hooks | `@samas/dataspec-core` |
| `@samas/dataspec-api` | REST API (Express + Edge Functions) | `@samas/dataspec-core`, `@samas/dataspec-supabase-adapter` |

## Prerequisites

### 1. GitHub Personal Access Token

Create a GitHub Personal Access Token (PAT) with the following permissions:
- `packages:write` - Required to publish packages
- `packages:read` - Required to read packages

Create one at: https://github.com/settings/tokens

### 2. Set Environment Variable

```bash
export GITHUB_TOKEN=<your-token>
```

Or add to your shell profile (`~/.bashrc`, `~/.zshrc`):
```bash
echo 'export GITHUB_TOKEN=<your-token>' >> ~/.zshrc
source ~/.zshrc
```

## Publishing Methods

### Method 1: Manual Publishing (Recommended for First Release)

```bash
# Navigate to project root
cd /path/to/DataSpec-Engine

# Run the publish script
./scripts/publish.sh
```

#### Script Options

```bash
# Dry run - test without publishing
./scripts/publish.sh --dry-run

# Skip tests
./scripts/publish.sh --skip-tests

# Set version for all packages
./scripts/publish.sh --version=0.2.0

# Combine options
./scripts/publish.sh --version=0.2.0 --skip-tests
```

### Method 2: GitHub Actions (CI/CD)

Packages are automatically published when:
1. A new GitHub Release is created
2. The workflow is manually triggered

To trigger manually:
1. Go to Actions tab in GitHub
2. Select "Publish Packages" workflow
3. Click "Run workflow"
4. Optionally specify a version

## Publish Order

Packages must be published in dependency order:

1. `@samas/dataspec-core` (no dependencies)
2. `@samas/dataspec-supabase-adapter` (depends on core)
3. `@samas/dataspec-react` (depends on core)
4. `@samas/dataspec-api` (depends on core + supabase-adapter)

The publish script handles this automatically.

## Version Management

### Bump Version for All Packages

```bash
# Using publish script
./scripts/publish.sh --version=0.2.0

# Or manually per package
cd packages/core && npm version patch  # 0.1.0 -> 0.1.1
cd packages/core && npm version minor  # 0.1.0 -> 0.2.0
cd packages/core && npm version major  # 0.1.0 -> 1.0.0
```

### Version Strategy

- **Patch** (0.0.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New features, backward-compatible changes
- **Major** (x.0.0): Breaking changes

## Installing Published Packages

### In Consumer Projects

1. Create `.npmrc` in project root:
```
@samas:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

2. Install packages:
```bash
npm install @samas/dataspec-core
npm install @samas/dataspec-react
npm install @samas/dataspec-supabase-adapter
```

### Example package.json

```json
{
  "dependencies": {
    "@samas/dataspec-core": "^0.1.0",
    "@samas/dataspec-react": "^0.1.0",
    "@samas/dataspec-supabase-adapter": "^0.1.0"
  }
}
```

## Troubleshooting

### Error: 401 Unauthorized

**Cause**: GITHUB_TOKEN not set or invalid.

**Solution**:
```bash
# Verify token is set
echo $GITHUB_TOKEN

# Re-export if needed
export GITHUB_TOKEN=<your-token>
```

### Error: 403 Forbidden

**Cause**: Token doesn't have `packages:write` permission.

**Solution**: Create a new token with the correct permissions.

### Error: Package Already Published

**Cause**: Cannot re-publish the same version.

**Solution**: Bump the version number:
```bash
./scripts/publish.sh --version=0.1.1
```

### Error: npm ERR! 404 Not Found

**Cause**: Peer dependency not published yet.

**Solution**: Publish packages in the correct order (core first).

### Build Errors

**Cause**: TypeScript compilation failed.

**Solution**:
```bash
# Clean and rebuild
npm run clean --workspaces
npm run build --workspaces
```

## Verification

After publishing, verify packages are available:

```bash
# View package info
npm view @samas/dataspec-core --registry=https://npm.pkg.github.com

# Or check GitHub Packages page
# https://github.com/orgs/samas-it-services/packages
```

## Unpublishing (Emergency Only)

GitHub Packages doesn't allow unpublishing in most cases. If you need to remove a package version:

1. Go to GitHub repository settings
2. Navigate to Packages
3. Select the package
4. Delete the specific version

**Warning**: This can break dependent projects.

## Release Checklist

Before publishing a new release:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated
- [ ] Documentation updated
- [ ] No uncommitted changes

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/publish.yml`) handles:

1. Checkout code
2. Install dependencies
3. Build all packages
4. Run tests
5. Publish in order

Triggered by:
- Creating a GitHub Release
- Manual workflow dispatch

## Support

For issues with publishing:
1. Check this guide's troubleshooting section
2. Open an issue on GitHub
3. Contact the maintainers
