# 💰 DataSpec Engine for Financial Services

> Secure, compliant, auditable data operations for financial institutions.

---

## 👥 Target Audience

| Audience | Focus Areas |
|----------|-------------|
| 👔 **CTOs & Engineering Leaders** | ROI, compliance coverage, integration timeline |
| 💻 **Backend Developers** | Implementation details, API usage, code examples |
| 🔒 **Security & Compliance Teams** | SOX, PCI-DSS, audit capabilities |

---

## 🎯 Financial Services Challenges

### Challenge 1: Regulatory Compliance (SOX, PCI-DSS)

Financial institutions face rigorous compliance requirements:

- **SOX (Sarbanes-Oxley)**: Every financial transaction must have an audit trail
- **PCI-DSS**: Payment card data must be masked in exports and logs
- **GDPR/CCPA**: Customer PII requires consent tracking and right-to-delete

**The Problem**: Most CSV import tools provide no audit trail, no masking, and no compliance features. Finance teams end up building custom solutions or risking non-compliance.

### Challenge 2: Sensitive Data Exposure

Financial data imports often contain:

- Account numbers
- Social Security Numbers (SSNs)
- Credit card numbers
- Transaction amounts
- Customer addresses

**The Problem**: Without proper masking, this data appears in:
- Log files
- Error messages
- Export files sent to vendors
- Preview screens visible to unauthorized staff

### Challenge 3: Audit Trail Requirements

Regulators require answers to:

- Who imported this data?
- When was it imported?
- What was the original file?
- What transformations were applied?
- Who accessed sensitive fields?

**The Problem**: Traditional ETL tools don't track field-level access or provide unmasking audit logs.

---

## ✅ How DataSpec Solves These

### 🔐 Built-in PCI-DSS Compliant Masking

DataSpec provides five sensitivity levels with automatic masking:

```yaml
columns:
  - source: "Card Number"
    target: card_number
    type: string
    sensitivity: secret              # 🔒 PCI-DSS Level
    masking:
      style: partial
      pattern: "****-****-****-"
      visibleChars: 4                # Shows: ****-****-****-1234
```

**Sensitivity Levels for Finance:**

| Level | Use Case | Export Behavior |
|-------|----------|-----------------|
| `public` | Transaction dates, category names | Shown as-is |
| `internal` | Internal reference numbers | Hidden from external exports |
| `confidential` | Customer names, addresses | Masked by default |
| `secret` | Account numbers, SSNs | Always masked, audit logged |
| `highly_restricted` | Credit card numbers, PINs | Encrypted, requires MFA to unmask |

### 📋 SOX-Ready Audit Logging

Every operation is logged with full context:

```typescript
// Automatic audit entry on import
{
  operation: 'import',
  entity: 'transactions',
  spec: 'transactions_standard_v1',
  user_id: 'usr_12345',
  user_roles: ['finance_incharge'],
  timestamp: '2025-12-08T10:30:00Z',
  file_name: 'q4_transactions.csv',
  file_hash: 'sha256:abc123...',
  rows_processed: 1500,
  rows_succeeded: 1498,
  rows_failed: 2,
  duration_ms: 3200
}

// Automatic audit entry on unmask
{
  operation: 'unmask',
  entity: 'transactions',
  field: 'account_number',
  user_id: 'usr_67890',
  user_roles: ['super_admin'],
  timestamp: '2025-12-08T11:45:00Z',
  reason: 'Audit investigation #2025-Q4-001',
  ip_address: '192.168.1.100'
}
```

### 🔒 Role-Based Data Access

Granular permissions per entity and operation:

```sql
-- Financial transactions: Limited import access
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'transactions',
  'Financial Transactions',
  'full',
  ARRAY['admin', 'finance_incharge', 'financial_auditor'],  -- View
  ARRAY['admin'],                                            -- Import (restricted)
  ARRAY['admin', 'finance_incharge']                         -- Export
);

-- Audit table: Export only, no imports allowed
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'transaction_audit',
  'Transaction Audit Trail',
  'export_only',                                             -- 🔒 No imports ever
  ARRAY['admin', 'finance_incharge', 'financial_auditor'],
  ARRAY[]::TEXT[],                                           -- Empty = no one can import
  ARRAY['admin', 'financial_auditor']
);
```

---

## 📝 Example: Transaction Import Spec

Complete YAML specification for financial transaction imports:

```yaml
# =============================================================================
# DataSpec: Financial Transactions Import
# =============================================================================
# VERSION: 1.0.0
# ENTITY: transactions
# COMPLIANCE: SOX, PCI-DSS Ready
#
# DESCRIPTION:
#   Standard spec for importing financial transactions with full audit trail,
#   automatic account lookups, and PCI-compliant sensitive data handling.
#
# EXAMPLE CSV:
#   Date,Type,Account Number,Amount,Currency,Description,Reference
#   2025-01-15,credit,ACC-001234,5000.00,USD,Q1 Revenue,INV-2025-001
# =============================================================================

metadata:
  name: transactions_standard_v1
  entity: transactions
  version: "1.0.0"
  description: |
    SOX-compliant transaction import with automatic account resolution,
    PCI-DSS masking, and full audit trail logging.

  # Role permissions for this spec
  permissions:
    viewRoles: [super_admin, admin, finance_incharge]
    importRoles: [super_admin, admin]
    exportRoles: [super_admin, admin, finance_incharge]

options:
  skipEmptyRows: true
  trimWhitespace: true
  dateFormat: "YYYY-MM-DD"

columns:
  # ---------------------------------------------------------------------------
  # Transaction Date
  # Intent: When the transaction occurred (not when imported)
  # ---------------------------------------------------------------------------
  - source: "Date"
    target: transaction_date
    type: date
    required: true
    sensitivity: public

  # ---------------------------------------------------------------------------
  # Transaction Type
  # Intent: Credit or debit classification
  # ---------------------------------------------------------------------------
  - source: "Type"
    target: type
    type: string
    required: true
    sensitivity: public
    validation:
      - type: enum
        values: ["credit", "debit"]

  # ---------------------------------------------------------------------------
  # Account Number - SENSITIVE
  # Intent: Link to account via lookup
  # Compliance: PCI-DSS - must be masked in exports
  # ---------------------------------------------------------------------------
  - source: "Account Number"
    target: account_id
    type: lookup
    required: true
    sensitivity: secret              # 🔒 PCI-DSS protected
    lookup:
      table: bank_accounts
      keyColumn: account_code
      valueColumn: id
      fallback: error
    masking:
      style: partial
      pattern: "***-"
      visibleChars: 4

  # ---------------------------------------------------------------------------
  # Amount
  # Intent: Transaction value (always positive, type determines direction)
  # ---------------------------------------------------------------------------
  - source: "Amount"
    target: amount
    type: number
    required: true
    sensitivity: confidential        # Financial amounts are sensitive
    validation:
      - type: range
        min: 0.01
        max: 999999999.99

  # ---------------------------------------------------------------------------
  # Currency
  # Intent: ISO 4217 currency code
  # ---------------------------------------------------------------------------
  - source: "Currency"
    target: currency
    type: string
    required: false
    sensitivity: public
    default: "USD"
    validation:
      - type: length
        min: 3
        max: 3

  # ---------------------------------------------------------------------------
  # Description
  # Intent: Human-readable transaction description
  # ---------------------------------------------------------------------------
  - source: "Description"
    target: description
    type: string
    required: false
    sensitivity: internal

  # ---------------------------------------------------------------------------
  # Reference Number
  # Intent: External reference (invoice number, check number, etc.)
  # ---------------------------------------------------------------------------
  - source: "Reference"
    target: reference_number
    type: string
    required: false
    sensitivity: internal
```

---

## 🏢 Who Uses DataSpec for Finance?

### 🕌 saMas Charity Finance (Production)

Real-world deployment managing financial operations:

- **42 entities** configured with operation modes
- **Role-based access** for 5 user types
- **Audit compliance** for donor PII
- **Zero data breaches** since deployment

[Read the full case study →](../case-studies/samas-charity-finance.md)

---

## 🔧 Integration Patterns

### Pattern 1: Bank Statement Reconciliation

```typescript
// Import bank statements and auto-match with transactions
const result = await dataspec.import({
  entity: 'bank_statements',
  spec: 'bank_statements_standard_v1',
  file: bankStatementCSV,
  hooks: {
    afterInsert: async (row, context) => {
      // Auto-reconcile with existing transactions
      await reconcileTransaction(row.reference_number, row.amount);
    }
  }
});
```

### Pattern 2: Regulatory Export

```typescript
// Export for SOX audit with automatic masking
const exportResult = await dataspec.export({
  entity: 'transactions',
  spec: 'transactions_audit_export_v1',
  format: 'xlsx',
  applyMasking: true,  // All sensitive fields masked
  filters: {
    date_range: { start: '2025-01-01', end: '2025-03-31' },
    type: 'all'
  }
});

// Result: Excel file with masked account numbers, full audit trail
```

---

## 📊 Compliance Checklist

| Requirement | DataSpec Feature | Status |
|-------------|------------------|--------|
| **SOX - Audit Trail** | Automatic logging of all imports/exports | ✅ |
| **SOX - Change Tracking** | Audit tables with `export_only` mode | ✅ |
| **SOX - Access Control** | Role-based view/import/export permissions | ✅ |
| **PCI-DSS - Data Masking** | 5-level sensitivity classification | ✅ |
| **PCI-DSS - Access Logging** | Unmask operations logged with reason | ✅ |
| **PCI-DSS - Encryption** | Sensitive fields encrypted at rest | ✅ |
| **GDPR - Data Minimization** | Field-level export filtering | ✅ |
| **GDPR - Right to Delete** | Soft-delete with audit preservation | ✅ |

---

## 🚀 Getting Started

1. **Install DataSpec packages:**
   ```bash
   npm install @samas-it-services/dataspec-core @samas-it-services/dataspec-react
   ```

2. **Configure your financial entities** with appropriate operation modes and roles

3. **Create your first transaction import spec** using the template above

4. **Test with preview mode** before executing real imports

[Full Getting Started Guide →](../getting-started.md)

---

## 📚 Related Documentation

- [Operation Modes Guide](../operation-modes.md) - Configure entity restrictions
- [Role Permissions Guide](../role-permissions.md) - Set up role-based access
- [YAML Spec Guide](../yaml-spec-guide.md) - Complete specification reference
- [API Reference](../api-reference.md) - Full API documentation

---

**Need help with financial services integration?** See our [Integration Guide](../integration-guide.md) or review the [saMas Case Study](../case-studies/samas-charity-finance.md) for a production example.
