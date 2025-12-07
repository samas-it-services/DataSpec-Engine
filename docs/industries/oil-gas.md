# ⛽ DataSpec Engine for Oil & Gas

> Reliable data operations for energy sector operations, IoT sensors, and regulatory compliance.

---

## 👥 Target Audience

| Audience | Focus Areas |
|----------|-------------|
| 👔 **Energy IT Leaders** | Operational efficiency, regulatory compliance, integration timeline |
| 💻 **Industrial Developers** | IoT integration, batch processing, SCADA connectivity |
| 🔒 **HSE & Compliance Teams** | Safety data, environmental reporting, audit requirements |

---

## 🎯 Oil & Gas Data Challenges

### Challenge 1: IoT Sensor Data Volume

Oil & gas operations generate massive amounts of sensor data:

- **Wellhead sensors**: Pressure, temperature, flow rates
- **Pipeline monitors**: Leak detection, corrosion sensors
- **Refinery systems**: Process control, safety systems
- **Fleet tracking**: GPS, fuel consumption, maintenance alerts

**The Problem**: Traditional import tools choke on high-volume sensor data. Batch imports of 100K+ rows often timeout or corrupt data without proper validation.

### Challenge 2: Regulatory Compliance

Energy companies face strict reporting requirements:

- **EPA Environmental**: Emissions reporting, spill notifications
- **OSHA Safety**: Incident reporting, HSE records
- **DOT Pipeline**: Safety data, inspection records
- **SEC Financial**: Production volumes, reserves reporting

**The Problem**: Each regulatory body requires different formats, different data fields, and different submission schedules. Manual data transformation is error-prone and audit-risky.

### Challenge 3: Equipment Maintenance Records

Asset management requires:

- Equipment serial numbers and specifications
- Maintenance history and schedules
- Part replacements and costs
- Inspection certificates
- Calibration records

**The Problem**: Maintenance data often comes from multiple systems (SCADA, CMMS, ERP) in different formats. Consolidating this data while maintaining integrity is challenging.

---

## ✅ How DataSpec Solves These

### ⚡ High-Volume Batch Processing

DataSpec handles large sensor data imports efficiently:

```yaml
# High-performance sensor data import
metadata:
  name: wellhead_sensors_v1
  entity: sensor_readings
  version: "1.0.0"
  description: |
    High-volume wellhead sensor data import.
    Optimized for batch processing of 100K+ rows.

options:
  skipEmptyRows: true
  trimWhitespace: true
  batchSize: 5000                   # Process in 5K row batches
  parallelLookups: true             # Enable parallel FK resolution
  dateFormat: "YYYY-MM-DDTHH:mm:ss" # ISO 8601 for timestamps

columns:
  - source: "Timestamp"
    target: reading_timestamp
    type: datetime
    required: true
    sensitivity: public

  - source: "Well ID"
    target: well_id
    type: lookup
    required: true
    sensitivity: internal
    lookup:
      table: wells
      keyColumn: well_code
      valueColumn: id
      cache: true                   # Cache lookups for performance
      cacheTTL: 3600                # 1 hour cache

  - source: "Pressure PSI"
    target: pressure_psi
    type: number
    required: true
    sensitivity: internal
    validation:
      - type: range
        min: 0
        max: 15000                  # Max safe pressure

  - source: "Temperature F"
    target: temperature_f
    type: number
    required: true
    sensitivity: internal
    validation:
      - type: range
        min: -40
        max: 400                    # Operating range

  - source: "Flow Rate"
    target: flow_rate_bpd
    type: number
    required: false
    sensitivity: confidential       # Production data is sensitive
```

### 📋 Regulatory Export Templates

Pre-built templates for common regulatory reports:

```yaml
# EPA Emissions Report Export
metadata:
  name: epa_emissions_export_v1
  entity: emissions_data
  version: "1.0.0"
  description: |
    EPA-compliant emissions export format.
    Generates data ready for EPA CEDRI submission.

  permissions:
    viewRoles: [admin, environmental_officer, hse_manager]
    importRoles: [admin, environmental_officer]
    exportRoles: [admin, environmental_officer]

options:
  dateFormat: "MM/DD/YYYY"          # EPA required format
  decimalPrecision: 4               # EPA required precision

columns:
  # EPA Facility ID (required)
  - source: "facility_id"
    target: "Facility ID"           # EPA column name
    type: string
    required: true
    sensitivity: public

  # Reporting Period
  - source: "period_start"
    target: "Reporting Period Start"
    type: date
    required: true
    sensitivity: public

  # Emission Source
  - source: "source_id"
    target: "Emission Unit ID"
    type: lookup
    required: true
    sensitivity: internal
    lookup:
      table: emission_sources
      keyColumn: id
      valueColumn: epa_unit_id      # Map to EPA identifier

  # Pollutant Data
  - source: "co2_tons"
    target: "CO2 Emissions (tons)"
    type: number
    required: true
    sensitivity: confidential       # Competitive data
    transform:
      - type: round
        decimals: 4

  - source: "nox_tons"
    target: "NOx Emissions (tons)"
    type: number
    required: true
    sensitivity: confidential
```

### 🔧 Equipment Asset Management

```yaml
# Equipment maintenance import
metadata:
  name: equipment_maintenance_v1
  entity: maintenance_records
  version: "1.0.0"
  description: |
    Import maintenance records from CMMS systems.
    Links to equipment registry with automatic serial number lookup.

columns:
  # Equipment Serial Number - Lookup to asset registry
  - source: "Serial Number"
    target: equipment_id
    type: lookup
    required: true
    sensitivity: internal
    lookup:
      table: equipment_registry
      keyColumn: serial_number
      valueColumn: id
      fallback: error
      errorMessage: "Unknown equipment serial number"

  # Maintenance Type
  - source: "Maint Type"
    target: maintenance_type
    type: string
    required: true
    sensitivity: public
    validation:
      - type: enum
        values:
          - "preventive"
          - "corrective"
          - "predictive"
          - "emergency"

  # Work Order Details
  - source: "Work Order"
    target: work_order_number
    type: string
    required: true
    sensitivity: internal

  - source: "Date Completed"
    target: completion_date
    type: datetime
    required: true
    sensitivity: public

  # Cost Tracking
  - source: "Labor Hours"
    target: labor_hours
    type: number
    required: false
    sensitivity: confidential       # Cost data

  - source: "Parts Cost"
    target: parts_cost_usd
    type: number
    required: false
    sensitivity: confidential

  # Inspector Information
  - source: "Technician ID"
    target: technician_id
    type: lookup
    required: true
    sensitivity: internal
    lookup:
      table: technicians
      keyColumn: badge_number
      valueColumn: id

  # Certification Reference
  - source: "Cert Reference"
    target: certification_reference
    type: string
    required: false
    sensitivity: internal
```

---

## 🏗️ Oil & Gas Integration Patterns

### Pattern 1: SCADA Data Integration

```typescript
// Import sensor data from SCADA historian
const result = await dataspec.import({
  entity: 'sensor_readings',
  spec: 'scada_historian_v1',
  file: scadaExportCSV,
  options: {
    batchSize: 10000,              // Large batches for performance
    skipDuplicates: true,          // Ignore duplicate timestamps
    onProgress: (progress) => {
      console.log(`Processed ${progress.rowsProcessed} rows`);
    }
  }
});

console.log(`Imported ${result.successfulRows} sensor readings`);
```

### Pattern 2: Regulatory Report Generation

```typescript
// Generate EPA-ready emissions report
const exportResult = await dataspec.export({
  entity: 'emissions_data',
  spec: 'epa_emissions_export_v1',
  format: 'csv',
  options: {
    dateFormat: 'MM/DD/YYYY',      // EPA required format
    includeHeaders: true,
    utf8BOM: true                  // Windows compatibility
  },
  filters: {
    facility_id: 'FAC-001',
    period: { year: 2025, quarter: 'Q1' }
  }
});

// Result: EPA CEDRI-ready CSV file
```

### Pattern 3: Equipment Lifecycle Tracking

```typescript
// Import equipment inspection records
const inspectionResult = await dataspec.import({
  entity: 'inspection_records',
  spec: 'equipment_inspection_v1',
  file: inspectionCSV,
  hooks: {
    afterInsert: async (row, context) => {
      // Update equipment last inspection date
      await updateEquipmentLastInspection(row.equipment_id, row.inspection_date);

      // Flag equipment needing attention
      if (row.findings_count > 0) {
        await createMaintenanceAlert(row.equipment_id, row.findings);
      }
    }
  }
});
```

---

## 📊 Regulatory Compliance Checklist

| Requirement | DataSpec Feature | Status |
|-------------|------------------|--------|
| **EPA - Data Format** | Configurable date/number formats | ✅ |
| **EPA - Audit Trail** | Import/export logging with user info | ✅ |
| **OSHA - Incident Records** | HSE entity with role restrictions | ✅ |
| **OSHA - Access Control** | Role-based view/import/export | ✅ |
| **DOT - Pipeline Data** | Equipment and inspection tracking | ✅ |
| **SEC - Production Volumes** | Confidential data masking | ✅ |
| **General - Data Integrity** | Validation rules, FK lookups | ✅ |
| **General - Traceability** | Full audit history | ✅ |

---

## ⚡ Performance Benchmarks

| Scenario | Rows | Processing Time | Notes |
|----------|------|-----------------|-------|
| Sensor data import | 100,000 | ~45 seconds | With FK lookups |
| Equipment records | 10,000 | ~8 seconds | Complex validation |
| Emissions export | 50,000 | ~12 seconds | With transformations |
| Inspection import | 5,000 | ~4 seconds | With hooks |

*Benchmarks on standard cloud infrastructure (2 vCPU, 4GB RAM)*

---

## 🔐 Energy-Specific Security

### Production Data Protection

```sql
-- Production volumes: Competitive sensitive data
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'production_volumes',
  'Production Volumes',
  'full',
  ARRAY['admin', 'operations_manager', 'reservoir_engineer'],
  ARRAY['admin', 'operations_manager'],
  ARRAY['admin']                    -- Export restricted to admin only
);
```

### HSE Incident Records

```sql
-- Safety incidents: Restricted access
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'safety_incidents',
  'Safety Incidents',
  'full',
  ARRAY['admin', 'hse_manager', 'safety_officer'],
  ARRAY['admin', 'hse_manager', 'safety_officer'],
  ARRAY['admin', 'hse_manager']     -- Compliance exports only
);

-- Safety audit log: Export only, no modifications
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'safety_audit_log',
  'Safety Audit Trail',
  'export_only',                    -- 🔒 Immutable audit trail
  ARRAY['admin', 'hse_manager', 'safety_auditor'],
  ARRAY[]::TEXT[],                  -- No one can import
  ARRAY['admin', 'safety_auditor']
);
```

---

## 🏢 Common Entity Configurations

### Upstream (Exploration & Production)

| Entity | Mode | View Roles | Import Roles | Export Roles |
|--------|------|------------|--------------|--------------|
| wells | full | ops, reservoir | admin | admin, ops |
| sensor_readings | full | ops, engineers | ops, scada_system | admin |
| production_volumes | full | ops, reservoir | ops | admin |
| reserves_estimates | full | admin, reservoir | admin | admin |

### Midstream (Pipeline & Transport)

| Entity | Mode | View Roles | Import Roles | Export Roles |
|--------|------|------------|--------------|--------------|
| pipeline_segments | full | ops, maintenance | admin | admin |
| leak_detections | full | ops, hse | scada_system | admin, hse |
| corrosion_readings | full | maintenance, integrity | integrity_system | admin |
| flow_measurements | full | ops, custody | custody_system | admin, custody |

### Downstream (Refining & Distribution)

| Entity | Mode | View Roles | Import Roles | Export Roles |
|--------|------|------------|--------------|--------------|
| process_units | full | ops, engineers | admin | admin |
| quality_tests | full | quality, ops | quality | admin, quality |
| inventory_levels | full | ops, logistics | inventory_system | admin |
| emissions_data | full | ops, environmental | environmental | admin, environmental |

---

## 🚀 Getting Started

1. **Install DataSpec packages:**
   ```bash
   npm install @samas-it-services/dataspec-core @samas-it-services/dataspec-react
   ```

2. **Configure energy entities** with appropriate access controls

3. **Set up SCADA/historian integration** using batch import APIs

4. **Create regulatory export templates** for your reporting needs

[Full Getting Started Guide →](../getting-started.md)

---

## 📚 Related Documentation

- [Operation Modes Guide](../operation-modes.md) - Configure entity restrictions
- [Role Permissions Guide](../role-permissions.md) - Set up role-based access
- [YAML Spec Guide](../yaml-spec-guide.md) - Complete specification reference
- [API Reference](../api-reference.md) - Full API documentation

---

**Need help with energy sector integration?** See our [Integration Guide](../integration-guide.md) for step-by-step instructions.
