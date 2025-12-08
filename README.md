# 🚀 DataSpec Engine

**Enterprise-Grade Data Import/Export for Modern Applications**

> Transform messy CSV imports into reliable, auditable, secure data operations.

[![Tests](https://img.shields.io/badge/tests-434%20passing-brightgreen)](#-testing--quality-assurance)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)](#-test-coverage)
[![Packages](https://img.shields.io/badge/packages-4%20complete-blue)](#-packages)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](#-packages)

---

## 🆕 What's New in v0.3.0

**Entity Operation Modes & Role-Based Permissions** - Enterprise-grade access control:

| Feature | Description |
|---------|-------------|
| 🔒 **Operation Modes** | Control entity access: `full`, `export_only`, `view_only`, `import_only` |
| 👥 **Role-Based Permissions** | Separate roles for view, import, and export per entity |
| 📁 **Entity Categories** | Organize entities: `core`, `financial`, `audit`, `system`, `link` |
| ✅ **React 18 Compatibility** | Fixed async test patterns for Strict Mode |

[View full changelog →](CHANGELOG.md)

---

## 🎯 Who Is This For?

| Audience | What You'll Find |
|----------|------------------|
| 👔 **Decision Makers** | [Why DataSpec?](#-why-dataspec) • [Case Studies](#-case-studies) • [Industry Solutions](#-industry-solutions) |
| 💻 **Developers** | [Quick Start](#-quick-start) • [API Reference](docs/api-reference.md) • [Examples](#-examples) |
| 🏗️ **Architects** | [Architecture](#-architecture) • [Integration Guide](docs/integration-guide.md) |
| 🔒 **Security Teams** | [Compliance Features](#-built-in-sensitivity--compliance) • [Audit Logging](#audit-logging) |

---

## 🤔 Why DataSpec?

### 😫 The Problem: Data Import/Export Is Harder Than It Looks

Every enterprise application eventually faces these challenges:

#### Challenge 1: "Just Import This CSV" Becomes a Nightmare 📊

Your stakeholder hands you a CSV with 50,000 rows of customer data. Sounds simple, right?

**Reality hits:**
- 🔀 Column names don't match your database fields (`First Name` vs `first_name`)
- 📅 Dates are in 5 different formats (`12/25/2024`, `2024-12-25`, `Dec 25, 2024`)
- 📱 Phone numbers have inconsistent formatting (`+1-555-123-4567` vs `5551234567`)
- ❌ Some rows have missing required fields
- 🔄 Duplicate entries that need merging, not inserting
- 🔗 Foreign key lookups needed (customer name → customer_id)

**Traditional approach:** Write custom scripts for each import. 3 weeks later, you have 2,000 lines of spaghetti code that only one developer understands. 🍝

**DataSpec approach:** Define a YAML spec once, reuse forever: ✨

```yaml
entity: customers
fields:
  - source: "First Name"
    target: first_name
    transform: trim
    required: true

  - source: "Phone"
    target: phone_number
    transform: phone_normalize
    validation: phone_format

  - source: "Account Manager"
    target: account_manager_id
    lookup:
      table: employees
      match: full_name
      return: id
```

#### Challenge 2: Sensitive Data Exposure 🔐

Your export feature just dumped 10,000 customer records with SSNs, credit card numbers, and salaries into a CSV that got emailed to the wrong person. 😱

**Traditional approach:** Hope nobody notices. Add a checkbox. Get fined for GDPR violations. 💸

**DataSpec approach:** Built-in sensitivity classification with automatic masking: 🛡️

```yaml
fields:
  - source: ssn
    target: social_security_number
    sensitivity: highly-restricted
    mask: partial  # Shows: ***-**-1234

  - source: salary
    target: annual_salary
    sensitivity: confidential
    mask: full  # Shows: ********
    unmask:
      roles: [hr_admin, finance_manager]
      audit: true  # Every unmask is logged
```

#### Challenge 3: "It Worked on My Machine" 🤷

Import logic scattered across:
- 🖥️ Backend controllers
- 📦 Stored procedures
- 🌐 Frontend validation
- 📝 Manual SQL scripts

When something breaks, nobody knows which version of which script was used.

**DataSpec approach:** Single source of truth in version-controlled YAML specs. The same spec runs in preview mode (no database changes) and execute mode (with full audit trail). ✅

#### Challenge 4: The UI/API/Database Coupling Mess 🔗

Your React app talks directly to Supabase. Your import logic lives in 47 different places. Adding a new field means updating frontend, backend, database, and documentation.

**DataSpec approach:** Complete separation of concerns:

```
React App  →  API Layer  →  Core Engine  →  Database Adapter
    │              │              │                  │
    ▼              ▼              ▼                  ▼
 UI only      Validation     Transform           Any DB
             & routing       & Logic          (Supabase,
                                              Postgres,
                                              MySQL...)
```

---

## ✅ How DataSpec Engine Solves These Problems

### 📝 1. YAML-First Specifications

Human-readable, version-controllable, reusable specifications that define:
- 🔀 Field mappings and transformations
- ✔️ Validation rules
- 🔗 Lookup relationships
- 🏷️ Sensitivity classifications
- 🎭 Masking policies

### 🔌 2. API-First Architecture

Your frontend never touches the database directly. Everything flows through a secure API layer that:
- 🔐 Validates permissions before any operation
- 🎭 Applies masking based on user roles
- 📋 Logs every action for audit compliance
- ⚠️ Provides consistent error handling

### 👁️ 3. Preview Before Execute

Every import can be previewed first:
- 👀 See exactly what will be inserted, updated, or rejected
- 🔍 Identify validation errors before they hit your database
- 🔄 Review transformed data before committing
- 🚫 No more "oops, I imported to production"

### 🛡️ 4. Built-in Sensitivity & Compliance

Five sensitivity levels out of the box:
- 🟢 **Public** - No restrictions
- 🔵 **Internal** - Company employees only
- 🟡 **Confidential** - Need-to-know basis
- 🟠 **Secret** - Highly restricted access
- 🔴 **Highly-Restricted** - Maximum protection (PII, financial data)

Every unmask operation requires authorization and creates an audit log.

---

## 🏭 Industry Solutions

DataSpec Engine solves data challenges across industries:

### 💰 Financial Services
- Transaction import with automatic account lookups
- Sensitive data masking (account numbers, SSNs)
- SOX compliance audit logging
- PCI-DSS compliant data handling

[Read more →](docs/industries/finance.md)

### 🏥 Healthcare
- HIPAA-compliant patient data handling
- PHI masking and role-based unmasking
- HL7/FHIR data transformation
- Audit trails for regulatory compliance

[Read more →](docs/industries/healthcare.md)

### ⛽ Oil & Gas
- IoT sensor data batch import
- Equipment maintenance records
- Regulatory compliance exports
- Environmental reporting data

[Read more →](docs/industries/oil-gas.md)

---

## 📋 Case Studies

### 🕌 saMas Charity Finance (Production)

Real-world deployment managing financial operations for educational charities:

| Metric | Value |
|--------|-------|
| 📊 **Entities Configured** | 42 with operation modes |
| 👥 **User Roles** | 5 types (admin, finance, auditor, zonal, super_admin) |
| 🔐 **Audit Compliance** | Full donor PII protection |
| 🛡️ **Data Breaches** | Zero since deployment |
| ⚡ **Import Speed** | 10k rows in <30 seconds |

**Key Features Used:**
- Operation modes (full, export_only, view_only)
- Role-based permissions per entity
- Automatic audit table protection
- Sensitive donor data masking

[Read the full case study →](docs/case-studies/samas-charity-finance.md)

---

## 🚀 Quick Start

### Installation

```bash
npm install @dataspec-engine/core @dataspec-engine/react @dataspec-engine/supabase-adapter
```

### Basic Usage

```tsx
import {
  DataSpecProvider,
  EntitySelector,
  FileUpload,
  PreviewTable,
  useDataSpecContext
} from '@dataspec-engine/react';

function ImportWizard() {
  const {
    selectedEntity,
    preview,
    generatePreview,
    executeImport
  } = useDataSpecContext();

  return (
    <div>
      <EntitySelector mode="cards" />
      <FileUpload accept={['.csv', '.xlsx']} />
      <PreviewTable data={preview?.rows} showMasking={true} />
      <button onClick={executeImport}>Import Data</button>
    </div>
  );
}

function App() {
  return (
    <DataSpecProvider config={{ api: { baseUrl: '/api' } }}>
      <ImportWizard />
    </DataSpecProvider>
  );
}
```

📖 See [Getting Started Guide](./docs/getting-started.md) for complete setup instructions.

---

## 📦 Packages

| Package | Description | Status | Tests |
|---------|-------------|--------|-------|
| [`@dataspec-engine/core`](./packages/core) | 🔧 YAML parser, transformers, masking engine, import/export executors | ✅ Complete | 320 |
| [`@dataspec-engine/supabase-adapter`](./packages/supabase-adapter) | 🗄️ Supabase database integration with RLS support | ✅ Complete | 120 |
| [`@dataspec-engine/react`](./packages/react) | ⚛️ React UI components and hooks | ✅ Complete | 76 |
| [`@dataspec-engine/api`](./packages/api) | 🌐 REST API (Express + Supabase Edge Functions) | ✅ Complete | - |

---

## ✨ Features at a Glance

| Feature | Description |
|---------|-------------|
| 📝 **YAML Specifications** | Human-readable, versionable import/export definitions |
| 🔄 **Field Transformations** | 20+ built-in transforms (trim, uppercase, date parsing, phone normalization) |
| 🔗 **Lookup Resolution** | Automatic foreign key lookups with single or composite keys |
| ✔️ **Validation Rules** | Required fields, regex patterns, custom validators |
| 🏷️ **Sensitivity Classification** | 5 levels from Public to Highly-Restricted |
| 🎭 **Data Masking** | Full, partial, and regex-based masking with role-based unmasking |
| 🪝 **Hook System** | 9 extension points for custom logic (beforeValidate, afterInsert, etc.) |
| 👁️ **Preview Mode** | Dry-run imports to see results before committing |
| 📋 **Audit Logging** | Complete trail of all operations for compliance |
| ⚛️ **React Components** | Ready-to-use EntitySelector, FileUpload, PreviewTable, ImportProgress |
| 🔒 **Operation Modes** | Control entity access (full, export_only, view_only, import_only) |
| 👥 **Role Permissions** | Separate view/import/export permissions per entity |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Application                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │EntitySelector│  │ FileUpload  │  │PreviewTable │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                           │                                      │
│                    @dataspec-engine/react                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │  Edge Functions     │  │      Docker Container           │   │
│  │  (Light Operations) │  │     (Heavy Processing)          │   │
│  │  - YAML validation  │  │  - Large file parsing           │   │
│  │  - Quick previews   │  │  - Batch imports (10k+ rows)    │   │
│  │  - Spec listing     │  │  - Complex transformations      │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                           │                                      │
│                    @dataspec-engine/api                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Core Engine                                │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐   │
│  │  YAML    │  │   Field    │  │ Masking  │  │   Hook      │   │
│  │  Parser  │  │ Transformer│  │  Engine  │  │  Executor   │   │
│  └──────────┘  └────────────┘  └──────────┘  └─────────────┘   │
│                           │                                      │
│                    @dataspec-engine/core                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Adapter                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Supabase   │  │     RLS      │  │    Audit Logger      │   │
│  │   Adapter    │  │   Validator  │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                           │                                      │
│                @dataspec-engine/supabase-adapter                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    Supabase     │
                   │    Postgres     │
                   └─────────────────┘
```

📖 See [Architecture Documentation](./architecture.md) for detailed component descriptions.

---

## 🧪 Testing & Quality Assurance

DataSpec Engine is rigorously tested at multiple levels to ensure reliability and correctness.

### 📊 Test Summary

| Test Type | Count | Passing | Coverage |
|-----------|-------|---------|----------|
| **Unit Tests** | 396 | 392 (99%) | 94%+ |
| **E2E Tests** | 56 | 25+ | - |
| **Total** | 452 | 417+ | - |

### 🎯 Why We Test So Thoroughly

Data import/export operations are **high-risk**:
- ❌ A bug in transformation logic could corrupt thousands of records
- 🔓 A masking failure could expose sensitive customer data
- 💥 A validation bypass could insert invalid data into production

Our comprehensive test suite catches these issues before they reach your users.

📖 **Read more:** [Complete Testing Philosophy & Methodology](./docs/TESTING.md)

### 🏃 Running Tests

```bash
# Run complete test suite (unit + E2E)
./scripts/test-all.sh

# Quick mode - skip E2E for faster feedback
./scripts/test-all.sh --quick

# Generate comprehensive test report
./scripts/generate-test-report.sh
```

---

## 📈 Test Coverage

We maintain high code coverage to ensure reliability:

| Package | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| **Core** | 94.26% | 83.17% | 96.01% | 94.34% |
| **Supabase Adapter** | 97.22% | 91.67% | 98.00% | 97.22% |

Coverage thresholds are enforced in CI - PRs with coverage below 70% will fail.

---

## 📖 Documentation

### 🔧 Technical Guides

| Document | 👥 Audience | Description |
|----------|-------------|-------------|
| [Getting Started](docs/getting-started.md) | 💻 Developers | Installation, setup, first import |
| [YAML Spec Guide](docs/yaml-spec-guide.md) | 💻 Developers | Specification format and examples |
| [API Reference](docs/api-reference.md) | 💻 Developers | Complete component documentation |
| [Operation Modes](docs/operation-modes.md) | 🏗️ Architects | Entity permission configuration |
| [Role Permissions](docs/role-permissions.md) | 🔒 Security | Role-based access control |
| [Integration Guide](docs/integration-guide.md) | 🏗️ Architects | How to integrate into your app |
| [Testing Guide](docs/TESTING.md) | 💻 Developers | Running and writing tests |

### 🏭 Industry Guides

| Guide | Industry | Key Features |
|-------|----------|--------------|
| [Finance Solutions](docs/industries/finance.md) | 💰 Finance | SOX compliance, PCI-DSS masking |
| [Healthcare Solutions](docs/industries/healthcare.md) | 🏥 Healthcare | HIPAA compliance, PHI protection |
| [Oil & Gas Solutions](docs/industries/oil-gas.md) | ⛽ Energy | Sensor data, regulatory exports |

### 📋 Case Studies

| Case Study | Industry | Scale |
|------------|----------|-------|
| [saMas Charity Finance](docs/case-studies/samas-charity-finance.md) | 🕌 Non-Profit | 42 entities, 5 roles |

---

## 🌟 Examples

We include working examples to help you get started:

| Example | Description | Location |
|---------|-------------|----------|
| **Basic Import** | Minimal CSV import example | [`examples/basic-import/`](./examples/basic-import/) |
| **Full-Stack Demo** | Complete React + API application | [`examples/full-stack-demo/`](./examples/full-stack-demo/) |
| **Supabase Demo** | Supabase Edge Functions integration | [`examples/supabase-demo/`](./examples/supabase-demo/) |

### 🏃 Running the Full-Stack Demo

```bash
# Terminal 1: Start the API server
cd examples/full-stack-demo/api
npm install
npm run dev

# Terminal 2: Start the React frontend
cd examples/full-stack-demo/frontend
npm install
npm run dev

# Open http://localhost:3001 in your browser
```

---

## 🌍 Real-World Use Cases

### 🏥 Healthcare: Patient Data Import

```yaml
entity: patients
fields:
  - source: "Patient SSN"
    target: ssn
    sensitivity: highly-restricted
    mask: partial
    validation: ssn_format

  - source: "Date of Birth"
    target: dob
    transform: date_parse
    sensitivity: confidential

  - source: "Primary Physician"
    target: physician_id
    lookup:
      table: physicians
      match: full_name
      return: id
```

### 💰 Finance: Transaction Import

```yaml
entity: transactions
fields:
  - source: "Account Number"
    target: account_id
    sensitivity: secret
    mask: partial  # Shows: ****1234
    lookup:
      table: accounts
      match: account_number
      return: id

  - source: "Amount"
    target: amount
    transform: currency_normalize
    validation: positive_number
```

### 👥 HR: Employee Onboarding

```yaml
entity: employees
fields:
  - source: "Salary"
    target: annual_salary
    sensitivity: confidential
    mask: full
    unmask:
      roles: [hr_admin, payroll_manager]
      audit: true

  - source: "Department"
    target: department_id
    lookup:
      table: departments
      match: name
      return: id
      fallback: create  # Create department if not found
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### 💻 Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/dataspec-engine.git
cd dataspec-engine

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start development servers
./scripts/test-fullstack-demo.sh
```

---

## 📄 License

ISC License - See [LICENSE](./LICENSE) for details.

---

## 🆘 Support

- 📖 **Documentation**: [docs/](./docs/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/dataspec-engine/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-org/dataspec-engine/discussions)

---

**Built with 💚 for developers who've suffered through too many broken CSV imports.**
