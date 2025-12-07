# Supabase Edge Functions Demo

This example demonstrates how to deploy DataSpec Engine as Supabase Edge Functions for a serverless, client-hosted solution.

## Overview

This demo shows:
- Deploying DataSpec Engine Edge Functions to your Supabase project
- Zero infrastructure management
- Using Supabase's free tier for hosting
- Lightweight operations with fast cold start times

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  @dataspec-engine/react components                   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions                         │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │dataspec-entities │  │ dataspec-specs   │                 │
│  └──────────────────┘  └──────────────────┘                 │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │dataspec-validate │  │dataspec-preview  │                 │
│  └──────────────────┘  └──────────────────┘                 │
│  ┌──────────────────┐                                       │
│  │dataspec-masking  │                                       │
│  └──────────────────┘                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Postgres                        │
│  - dataspec_definitions                                      │
│  - dataspec_entities                                         │
│  - unmask_audit_log                                          │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. A Supabase project
2. Supabase CLI installed
3. Node.js 18+ (for local testing)

## Quick Start

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link Your Project

```bash
cd supabase-demo
supabase login
supabase link --project-ref your-project-ref
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy dataspec-entities
supabase functions deploy dataspec-specs
supabase functions deploy dataspec-validate
supabase functions deploy dataspec-preview
supabase functions deploy dataspec-masking
```

### 4. Run Database Migrations

```bash
# Apply the DataSpec schema
supabase db push
```

## Project Structure

```
supabase-demo/
├── README.md
├── supabase/
│   ├── config.toml           # Supabase project config
│   ├── functions/
│   │   ├── _shared/          # Shared utilities
│   │   │   ├── cors.ts
│   │   │   └── auth.ts
│   │   ├── dataspec-entities/
│   │   │   └── index.ts
│   │   ├── dataspec-specs/
│   │   │   └── index.ts
│   │   ├── dataspec-validate/
│   │   │   └── index.ts
│   │   ├── dataspec-preview/
│   │   │   └── index.ts
│   │   └── dataspec-masking/
│   │       └── index.ts
│   └── migrations/
│       └── 001_dataspec_tables.sql
└── frontend/                  # Optional: React frontend
    └── ...
```

## Edge Function Endpoints

After deployment, your functions are available at:

| Function | URL |
|----------|-----|
| Entities | `https://<ref>.supabase.co/functions/v1/dataspec-entities` |
| Specs | `https://<ref>.supabase.co/functions/v1/dataspec-specs` |
| Validate | `https://<ref>.supabase.co/functions/v1/dataspec-validate` |
| Preview | `https://<ref>.supabase.co/functions/v1/dataspec-preview` |
| Masking | `https://<ref>.supabase.co/functions/v1/dataspec-masking` |

## Usage Examples

### List Entities

```bash
curl "https://<ref>.supabase.co/functions/v1/dataspec-entities" \
  -H "Authorization: Bearer <anon-key>"
```

### Validate YAML

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/dataspec-validate" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"yamlContent": "version: 1.0\nmetadata:\n  entity: users"}'
```

### Preview Import

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/dataspec-preview" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "specId": "spec-uuid",
    "fileContent": "name,email\nJohn,john@example.com",
    "fileName": "users.csv"
  }'
```

## Limitations

Edge Functions have some constraints:

| Constraint | Limit |
|------------|-------|
| Execution time | 2 seconds |
| Memory | 150 MB |
| Request body | 6 MB |
| Response body | 6 MB |

For operations exceeding these limits, use the Docker deployment option.

## Local Development

### Test Functions Locally

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Functions available at http://localhost:54321/functions/v1/
```

### Run with Hot Reload

```bash
supabase functions serve --debug
```

## Configuration

### Environment Variables

Set secrets in your Supabase dashboard or via CLI:

```bash
supabase secrets set JWT_SECRET=your-jwt-secret
supabase secrets set CUSTOM_KEY=your-custom-key
```

### CORS Configuration

Edit `supabase/functions/_shared/cors.ts` to customize CORS:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-app.com',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
```

## React Integration

Configure your React app to use Edge Functions:

```tsx
import { DataSpecProvider } from '@dataspec-engine/react';

function App() {
  return (
    <DataSpecProvider
      config={{
        api: {
          baseUrl: 'https://<ref>.supabase.co/functions/v1',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        },
      }}
    >
      <YourApp />
    </DataSpecProvider>
  );
}
```

## Hybrid Deployment

For best performance and cost, combine Edge Functions with Docker:

| Operation | Deployment |
|-----------|------------|
| List entities/specs | Edge Function |
| Validate YAML | Edge Function |
| Preview (<300 rows) | Edge Function |
| Full import | Docker API |
| Large export | Docker API |
| Masking operations | Edge Function |

## Monitoring

View function logs in Supabase Dashboard or via CLI:

```bash
supabase functions logs dataspec-preview
```

## Next Steps

- See [full-stack-demo](../full-stack-demo) for Docker deployment
- See [basic-import](../basic-import) for CLI-only usage
- Read the [API Reference](../../docs/api-reference.md) for all options
