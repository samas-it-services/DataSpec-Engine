/**
 * Full-Stack Demo API Server
 *
 * This server demonstrates the complete DataSpec Engine API integration
 * with optional Supabase backend or mock database.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Import the DataSpec API app creator
// In a real project, you would use: import { createApp } from '@dataspec-engine/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Mock Data Store
// ============================================================================

interface Entity {
  id: string;
  name: string;
  displayName: string;
  table: string;
  description: string;
  specCount: number;
}

interface Spec {
  id: string;
  entityId: string;
  name: string;
  description: string;
  yamlContent: string;
  createdAt: string;
  updatedAt: string;
}

const mockEntities: Entity[] = [
  {
    id: 'users',
    name: 'users',
    displayName: 'Users',
    table: 'users',
    description: 'User accounts',
    specCount: 1,
  },
  {
    id: 'products',
    name: 'products',
    displayName: 'Products',
    table: 'products',
    description: 'Product catalog',
    specCount: 1,
  },
  {
    id: 'transactions',
    name: 'transactions',
    displayName: 'Transactions',
    table: 'transactions',
    description: 'Financial transactions',
    specCount: 1,
  },
];

const mockSpecs: Spec[] = [
  {
    id: 'users-import-v1',
    entityId: 'users',
    name: 'User Import',
    description: 'Import user data with email validation',
    yamlContent: `version: "1.0"
metadata:
  entity: users
  name: User Import
columns:
  - name: first_name
    source: first_name
    type: string
    required: true
    transform:
      - type: trim
      - type: uppercase
  - name: last_name
    source: last_name
    type: string
    required: true
    transform:
      - type: trim
  - name: email
    source: email
    type: string
    required: true
    transform:
      - type: lowercase
    validation:
      - type: pattern
        value: "^[\\\\w.-]+@[\\\\w.-]+\\\\.[a-z]{2,}$"
  - name: role
    source: role
    type: string
    default: user
`,
    createdAt: '2025-12-06T00:00:00Z',
    updatedAt: '2025-12-06T00:00:00Z',
  },
  {
    id: 'products-import-v1',
    entityId: 'products',
    name: 'Product Import',
    description: 'Import product catalog',
    yamlContent: `version: "1.0"
metadata:
  entity: products
  name: Product Import
columns:
  - name: sku
    source: sku
    type: string
    required: true
  - name: name
    source: name
    type: string
    required: true
  - name: price
    source: price
    type: number
    required: true
    validation:
      - type: range
        min: 0
        max: 1000000
  - name: category
    source: category
    type: string
`,
    createdAt: '2025-12-06T00:00:00Z',
    updatedAt: '2025-12-06T00:00:00Z',
  },
];

// In-memory data store
const dataStore: Map<string, Record<string, unknown>[]> = new Map();

// ============================================================================
// API Routes
// ============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /dataspec/entities - List available entities
app.get('/dataspec/entities', (req: Request, res: Response) => {
  const includeSpecCount = req.query.includeSpecCount === 'true';

  const entities = mockEntities.map((entity) => ({
    ...entity,
    specCount: includeSpecCount ? entity.specCount : undefined,
  }));

  res.json({
    success: true,
    data: { entities },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /dataspec/specs - List specs for an entity
app.get('/dataspec/specs', (req: Request, res: Response) => {
  const { entity } = req.query;

  let specs = mockSpecs;
  if (entity) {
    specs = specs.filter((s) => s.entityId === entity);
  }

  res.json({
    success: true,
    data: {
      specs: specs.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        entityId: s.entityId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /dataspec/specs/validate - Validate YAML spec
app.post('/dataspec/specs/validate', (req: Request, res: Response) => {
  const { yamlContent } = req.body;

  if (!yamlContent) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: 'yamlContent is required',
      },
    });
  }

  // Simple validation - check for required fields
  const hasVersion = yamlContent.includes('version:');
  const hasMetadata = yamlContent.includes('metadata:');
  const hasColumns = yamlContent.includes('columns:');

  if (!hasVersion || !hasMetadata || !hasColumns) {
    return res.json({
      success: true,
      data: {
        valid: false,
        errors: [
          !hasVersion && 'Missing version field',
          !hasMetadata && 'Missing metadata section',
          !hasColumns && 'Missing columns section',
        ].filter(Boolean),
      },
    });
  }

  res.json({
    success: true,
    data: {
      valid: true,
      errors: [],
    },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /dataspec/import/preview - Preview import
app.post('/dataspec/import/preview', (req: Request, res: Response) => {
  const { specId, fileContent, fileName, maxRows = 100 } = req.body;

  if (!specId || !fileContent || !fileName) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: 'specId, fileContent, and fileName are required',
      },
    });
  }

  // Parse CSV
  const lines = fileContent.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE',
        message: 'CSV must have headers and at least one data row',
      },
    });
  }

  const headers = lines[0].split(',').map((h: string) => h.trim());
  const rows: Record<string, unknown>[] = [];
  const errors: { rowIndex: number; errors: { field: string; message: string }[] }[] = [];

  for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};

    headers.forEach((header: string, index: number) => {
      row[header] = values[index]?.trim() || '';
    });

    // Simple transformations
    const transformedRow: Record<string, unknown> = {
      ...row,
      first_name: row.first_name?.toUpperCase().trim(),
      last_name: row.last_name?.trim(),
      email: row.email?.toLowerCase().trim(),
    };

    // Basic validation
    const rowErrors: { field: string; message: string }[] = [];

    if (!row.email?.includes('@')) {
      rowErrors.push({ field: 'email', message: 'Invalid email format' });
    }

    if (row.date_of_birth && row.date_of_birth === 'invalid-date') {
      rowErrors.push({ field: 'date_of_birth', message: 'Invalid date format' });
    }

    if (rowErrors.length > 0) {
      errors.push({ rowIndex: i - 1, errors: rowErrors });
    }

    rows.push({
      rowIndex: i - 1,
      data: transformedRow,
      errors: rowErrors,
      isValid: rowErrors.length === 0,
    });
  }

  const validCount = rows.filter((r) => (r as { isValid: boolean }).isValid).length;

  res.json({
    success: true,
    data: {
      rows,
      totalRows: lines.length - 1,
      validRows: validCount,
      invalidRows: rows.length - validCount,
      errors,
      columns: headers.map((h: string) => ({
        name: h,
        sourceColumn: h,
        type: 'string',
        required: ['first_name', 'last_name', 'email'].includes(h),
      })),
    },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /dataspec/import/execute - Execute import
app.post('/dataspec/import/execute', (req: Request, res: Response) => {
  const { specId, fileContent, fileName } = req.body;

  if (!specId || !fileContent || !fileName) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: 'specId, fileContent, and fileName are required',
      },
    });
  }

  // Parse and process CSV
  const lines = fileContent.split('\n').filter((l: string) => l.trim());
  const headers = lines[0].split(',').map((h: string) => h.trim());
  const spec = mockSpecs.find((s) => s.id === specId);
  const entity = spec?.entityId || 'unknown';

  if (!dataStore.has(entity)) {
    dataStore.set(entity, []);
  }

  const entityData = dataStore.get(entity)!;
  let inserted = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, unknown> = {
      id: `${entity}_${Date.now()}_${i}`,
    };

    headers.forEach((header: string, index: number) => {
      row[header] = values[index]?.trim() || '';
    });

    entityData.push(row);
    inserted++;
  }

  res.json({
    success: true,
    data: {
      inserted,
      updated: 0,
      skipped: 0,
      errors: [],
    },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /dataspec/export - Export data
app.post('/dataspec/export', (req: Request, res: Response) => {
  const { entity, format = 'json', applyMasking = true } = req.body;

  if (!entity) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: 'entity is required',
      },
    });
  }

  const data = dataStore.get(entity) || [];

  // Apply masking if needed
  const maskedData = applyMasking
    ? data.map((row) => ({
        ...row,
        email: maskEmail(row.email as string),
        date_of_birth: row.date_of_birth ? '****-**-**' : undefined,
      }))
    : data;

  if (format === 'csv') {
    if (maskedData.length === 0) {
      return res.json({
        success: true,
        data: { content: '', rowCount: 0 },
      });
    }

    const headers = Object.keys(maskedData[0]);
    const csv = [
      headers.join(','),
      ...maskedData.map((row) => headers.map((h) => row[h]).join(',')),
    ].join('\n');

    return res.json({
      success: true,
      data: { content: csv, rowCount: maskedData.length },
    });
  }

  res.json({
    success: true,
    data: { content: maskedData, rowCount: maskedData.length },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /dataspec/mask - Mask a field value
app.post('/dataspec/mask', (req: Request, res: Response) => {
  const { value, mode = 'partial' } = req.body;

  if (value === undefined) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: 'value is required',
      },
    });
  }

  let maskedValue: string;

  switch (mode) {
    case 'full':
      maskedValue = '*'.repeat(Math.min(String(value).length, 10));
      break;
    case 'partial':
      const str = String(value);
      if (str.length <= 4) {
        maskedValue = '*'.repeat(str.length);
      } else {
        maskedValue = str.substring(0, 2) + '***' + str.substring(str.length - 2);
      }
      break;
    default:
      maskedValue = String(value);
  }

  res.json({
    success: true,
    data: { maskedValue },
    meta: {
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
});

// Helper function
function maskEmail(email: string): string {
  if (!email) return email;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal =
    local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : '***';
  return `${maskedLocal}@${domain}`;
}

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
=====================================
   DataSpec Engine API Server
=====================================
   Port: ${PORT}
   Environment: ${process.env.NODE_ENV || 'development'}
   CORS Origins: ${process.env.CORS_ORIGINS || 'http://localhost:3001'}
=====================================
  `);
});

export default app;
