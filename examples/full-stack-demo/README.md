# Full-Stack Demo

This example demonstrates a complete full-stack integration of DataSpec Engine with:
- **Express API** server using `@dataspec-engine/api`
- **React Frontend** using `@dataspec-engine/react` components
- **Docker** deployment using docker-compose

## Overview

This demo shows the complete import workflow:
1. Select an entity type (users, products, transactions)
2. Choose an import specification
3. Upload a CSV file
4. Preview the import with validation
5. Execute the import
6. View results with masked sensitive fields

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  DataSpecProvider                                    │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │EntitySelector│ │  FileUpload  │ │ PreviewTable │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express API                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @dataspec-engine/api                                │   │
│  │  - /dataspec/entities                                │   │
│  │  - /dataspec/specs                                   │   │
│  │  - /dataspec/import/preview                          │   │
│  │  - /dataspec/import/execute                          │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase (or Mock DB)                      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the app
open http://localhost:3001

# Stop services
docker-compose down
```

### Option 2: Local Development

```bash
# Terminal 1: Start API server
cd api
npm install
npm run dev

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev

# Access the app
open http://localhost:3001
```

## Project Structure

```
full-stack-demo/
├── README.md
├── docker-compose.yml      # Docker orchestration
├── .env.example            # Environment variables template
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── server.ts       # Express server setup
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx         # Main application
│       ├── main.tsx        # Entry point
│       └── components/
│           └── ImportWizard.tsx
└── specs/
    ├── users-import.yaml   # User import spec
    └── products-import.yaml # Products import spec
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# API Configuration
API_PORT=3000
JWT_SECRET=your-secret-key-min-32-chars-long

# Supabase (optional - uses mock DB if not provided)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Frontend Configuration
VITE_API_URL=http://localhost:3000
```

## Features Demonstrated

### 1. Entity Selection
```tsx
<EntitySelector
  mode="dropdown"
  onSelect={(entity) => setSelectedEntity(entity)}
/>
```

### 2. File Upload with Validation
```tsx
<FileUpload
  accept={['.csv', '.xlsx']}
  maxSize={10 * 1024 * 1024}
  onUpload={(file) => handleUpload(file)}
/>
```

### 3. Preview Table with Masking
```tsx
<PreviewTable
  data={previewData}
  showMasking={true}
  onRowClick={(row) => handleRowClick(row)}
/>
```

### 4. Import Progress
```tsx
<ImportProgress
  status={importStatus}
  progress={progress}
  errors={errors}
/>
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dataspec/entities` | GET | List available entities |
| `/dataspec/specs?entity=users` | GET | Get specs for entity |
| `/dataspec/import/preview` | POST | Preview import |
| `/dataspec/import/execute` | POST | Execute import |
| `/dataspec/export` | POST | Export data |

## Sample Data

The `specs/` directory contains example specifications:

### users-import.yaml
- Imports user data with email validation
- Masks date_of_birth as confidential
- Transforms names to proper case

### products-import.yaml
- Imports product catalog
- Validates price ranges
- Handles category lookups

## Testing the Demo

1. Start the application using docker-compose
2. Navigate to http://localhost:3001
3. Select "Users" from the entity dropdown
4. Choose "User Import" specification
5. Upload the sample CSV file
6. Review the preview with validation results
7. Click "Execute Import" to import valid rows
8. View the imported data with masked fields

## Extending the Demo

### Add a New Entity

1. Create a new YAML spec in `specs/`
2. Add the entity to the API's entity list
3. Create sample data CSV

### Customize the UI

The frontend uses shadcn/ui components. Customize the theme in:
- `frontend/src/index.css` - Global styles
- `frontend/tailwind.config.js` - Tailwind configuration

### Connect to Real Database

Replace the mock adapter in `api/src/server.ts`:

```typescript
import { SupabaseAdapter } from '@dataspec-engine/supabase-adapter';

const adapter = new SupabaseAdapter(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
```

## Next Steps

- See [supabase-demo](../supabase-demo) for Edge Functions deployment
- See [basic-import](../basic-import) for CLI-only usage
- Read the [API Reference](../../docs/api-reference.md) for all options
