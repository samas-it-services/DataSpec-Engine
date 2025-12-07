# @dataspec-engine/api

REST API service for DataSpec Engine with two deployment options:
1. **Dockerized Express API** - For self-hosted/container deployment
2. **Supabase Edge Functions** - For client-side hosting on Supabase

## Installation

```bash
npm install @dataspec-engine/api
```

## Features

- **8 API Endpoints** - Complete CRUD operations for DataSpec
- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - Configurable per-endpoint limits
- **CORS** - Flexible cross-origin configuration
- **Two Deployment Options** - Docker or Edge Functions

## API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/dataspec/entities` | GET | List available entities | No |
| `/dataspec/specs` | GET | List specs for an entity | No |
| `/dataspec/specs/validate` | POST | Validate YAML spec | No |
| `/dataspec/import/preview` | POST | Preview import | No |
| `/dataspec/import/execute` | POST | Execute full import | Yes |
| `/dataspec/export` | POST | Export data | Yes |
| `/dataspec/mask` | POST | Mask field value | No |
| `/dataspec/mask/unmask` | POST | Unmask field value | Yes |

## Deployment Option 1: Docker

### Quick Start

```bash
# Build image
docker build -t dataspec-api .

# Run container
docker run -p 3000:3000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_KEY=your-service-key \
  -e JWT_SECRET=your-jwt-secret \
  dataspec-api
```

### Docker Compose

```bash
# Create .env file from example
cp .env.example .env

# Edit .env with your values
# SUPABASE_URL=...
# SUPABASE_SERVICE_KEY=...
# JWT_SECRET=...

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `JWT_SECRET` | Yes | Secret for JWT signing (min 32 chars) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: production) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |

## Deployment Option 2: Supabase Edge Functions

### Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Link your project:
```bash
supabase link --project-ref your-project-ref
```

3. Deploy Edge Functions:
```bash
# Deploy all functions
supabase functions deploy dataspec-entities
supabase functions deploy dataspec-specs
supabase functions deploy dataspec-validate
supabase functions deploy dataspec-preview
supabase functions deploy dataspec-masking
```

### Edge Function URLs

After deployment, your functions will be available at:
```
https://<project-ref>.supabase.co/functions/v1/dataspec-entities
https://<project-ref>.supabase.co/functions/v1/dataspec-specs
https://<project-ref>.supabase.co/functions/v1/dataspec-validate
https://<project-ref>.supabase.co/functions/v1/dataspec-preview
https://<project-ref>.supabase.co/functions/v1/dataspec-masking
```

### Edge Function Limitations

- Max execution time: 2 seconds
- Max memory: 150MB
- Best for: Validation, previews (<300 rows), light operations

For heavy operations (large imports/exports), use the Docker deployment.

## Hybrid Deployment (Recommended)

For optimal performance and cost:

| Operation | Deployment |
|-----------|------------|
| List entities/specs | Edge Function |
| Validate YAML | Edge Function |
| Preview (<300 rows) | Edge Function |
| Full import | Docker API |
| Large export | Docker API |
| Masking | Edge Function |

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs at http://localhost:3000
```

### Building

```bash
# Build TypeScript
npm run build

# Output in dist/
```

### Testing

```bash
# Run tests
npm test

# With coverage
npm test -- --coverage
```

## API Usage Examples

### List Entities

```bash
curl http://localhost:3000/dataspec/entities?includeSpecCount=true
```

### Validate YAML

```bash
curl -X POST http://localhost:3000/dataspec/specs/validate \
  -H "Content-Type: application/json" \
  -d '{"yamlContent": "version: 1.0\nmetadata:\n  entity: users\n  name: User Import"}'
```

### Preview Import

```bash
curl -X POST http://localhost:3000/dataspec/import/preview \
  -H "Content-Type: application/json" \
  -d '{
    "specId": "uuid-of-spec",
    "fileContent": "name,email\nJohn,john@example.com",
    "fileName": "users.csv",
    "maxRows": 100
  }'
```

### Export Data (Requires Auth)

```bash
curl -X POST http://localhost:3000/dataspec/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "specId": "uuid-of-spec",
    "format": "csv",
    "applyMasking": true
  }'
```

## Response Format

All endpoints return JSON in this format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "duration": 45
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { ... }
  },
  "meta": { ... }
}
```

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Read-only (GET) | 200 req/15min |
| Write (POST) | 50 req/15min |
| Heavy (import) | 20 req/hour |
| Unmask | 10 req/hour |

Rate limits are per-user when authenticated, per-IP otherwise.

## Related Packages

- [@dataspec-engine/core](../core/README.md) - Core engine
- [@dataspec-engine/react](../react/README.md) - React UI components
- [@dataspec-engine/supabase-adapter](../supabase-adapter/README.md) - Supabase integration

## License

ISC
