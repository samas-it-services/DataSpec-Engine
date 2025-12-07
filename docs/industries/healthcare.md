# 🏥 DataSpec Engine for Healthcare

> HIPAA-compliant data operations for healthcare organizations.

---

## 👥 Target Audience

| Audience | Focus Areas |
|----------|-------------|
| 👔 **Healthcare IT Leaders** | HIPAA compliance, patient privacy, integration timeline |
| 💻 **Healthcare Developers** | HL7/FHIR integration, PHI handling, code examples |
| 🔒 **Privacy & Compliance Officers** | PHI protection, audit capabilities, breach prevention |

---

## 🎯 Healthcare Data Challenges

### Challenge 1: HIPAA Compliance

Healthcare organizations must protect Protected Health Information (PHI):

- **Privacy Rule**: Patient data must be disclosed only with consent
- **Security Rule**: Technical safeguards required for electronic PHI
- **Breach Notification**: Unauthorized PHI access must be reported within 60 days

**The Problem**: Standard CSV imports expose PHI in logs, error messages, and temporary files. A single misconfigured import can trigger a reportable breach.

### Challenge 2: PHI in Every Import

Healthcare data imports often contain:

- Patient names and addresses
- Social Security Numbers
- Medical Record Numbers (MRNs)
- Diagnosis codes (ICD-10)
- Treatment information
- Insurance details
- Prescription information

**The Problem**: Even "routine" data imports like appointment schedules contain PHI. Without automatic masking, every import is a potential breach.

### Challenge 3: Audit Requirements for Meaningful Use

HIPAA and Meaningful Use require:

- Who accessed patient data?
- When was it accessed?
- What was the purpose?
- Was consent verified?
- What data was exported to third parties?

**The Problem**: Traditional data tools don't track access at the field level or distinguish between viewing masked vs. unmasked data.

---

## ✅ How DataSpec Solves These

### 🔐 Automatic PHI Protection

DataSpec classifies healthcare data with appropriate sensitivity levels:

```yaml
columns:
  # Patient name - PHI requiring protection
  - source: "Patient Name"
    target: patient_name
    type: string
    sensitivity: confidential        # 🔒 HIPAA PHI
    masking:
      style: partial
      visibleChars: 2                # Shows: "Jo*** Sm***"

  # Social Security Number - Highly sensitive
  - source: "SSN"
    target: ssn
    type: string
    sensitivity: highly_restricted   # 🔒 Maximum protection
    masking:
      style: partial
      pattern: "***-**-"
      visibleChars: 4                # Shows: ***-**-1234

  # Medical Record Number - Internal identifier
  - source: "MRN"
    target: medical_record_number
    type: string
    sensitivity: secret              # 🔒 Protected identifier
    masking:
      style: full                    # Shows: ********
```

**Healthcare Sensitivity Mapping:**

| Sensitivity Level | PHI Category | Examples |
|-------------------|--------------|----------|
| `public` | Non-PHI | Facility names, department codes |
| `internal` | Limited PHI | Appointment types, general categories |
| `confidential` | PHI | Patient names, addresses, DOB |
| `secret` | Sensitive PHI | MRN, insurance IDs, diagnoses |
| `highly_restricted` | High-Risk PHI | SSN, HIV status, psychiatric records |

### 📋 HIPAA-Ready Audit Logging

Every PHI access is logged:

```typescript
// Automatic audit entry - patient data import
{
  operation: 'import',
  entity: 'patients',
  spec: 'patient_demographics_v1',
  user_id: 'usr_nurse_12345',
  user_roles: ['clinical_staff'],
  timestamp: '2025-12-08T10:30:00Z',
  phi_fields_accessed: ['patient_name', 'dob', 'address'],
  phi_fields_masked: true,
  purpose: 'Patient registration batch import',
  consent_verified: true
}

// Automatic audit entry - PHI unmasking
{
  operation: 'unmask',
  entity: 'patients',
  field: 'ssn',
  user_id: 'usr_billing_67890',
  user_roles: ['billing_admin'],
  timestamp: '2025-12-08T11:45:00Z',
  reason: 'Insurance claim processing - Claim #CLM-2025-001',
  patient_id: 'PAT-12345',
  minimum_necessary: true,           // HIPAA minimum necessary standard
  ip_address: '192.168.1.100'
}
```

### 🔒 Role-Based PHI Access

Healthcare roles with appropriate data access:

```sql
-- Patient records: Clinical staff can view, limited import
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'patients',
  'Patient Demographics',
  'full',
  ARRAY['admin', 'clinical_staff', 'billing_staff'],  -- View
  ARRAY['admin', 'registration_staff'],                -- Import
  ARRAY['admin']                                       -- Export (restricted)
);

-- Psychiatric records: Maximum restriction
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'psychiatric_records',
  'Psychiatric Records',
  'full',
  ARRAY['admin', 'psychiatric_staff'],                 -- View (limited)
  ARRAY['admin', 'psychiatric_staff'],                 -- Import
  ARRAY['admin']                                       -- Export (admin only)
);

-- Audit log: No imports, export for compliance only
INSERT INTO dataspec_entities (
  name, display_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'phi_access_audit',
  'PHI Access Audit Log',
  'export_only',                                       -- 🔒 No modifications
  ARRAY['admin', 'compliance_officer', 'hipaa_officer'],
  ARRAY[]::TEXT[],
  ARRAY['admin', 'compliance_officer']
);
```

---

## 📝 Example: Patient Demographics Import Spec

Complete YAML specification for HIPAA-compliant patient import:

```yaml
# =============================================================================
# DataSpec: Patient Demographics Import
# =============================================================================
# VERSION: 1.0.0
# ENTITY: patients
# COMPLIANCE: HIPAA Ready
#
# DESCRIPTION:
#   HIPAA-compliant patient demographics import with automatic PHI masking,
#   consent verification, and full audit trail logging.
#
# EXAMPLE CSV:
#   MRN,First Name,Last Name,DOB,SSN,Address,City,State,ZIP,Phone,Insurance ID
#   MRN-001234,John,Smith,1985-03-15,123-45-6789,123 Main St,Boston,MA,02101,555-0100,INS-9876
# =============================================================================

metadata:
  name: patient_demographics_v1
  entity: patients
  version: "1.0.0"
  description: |
    HIPAA-compliant patient demographics import with PHI protection,
    automatic masking, and audit trail for compliance reporting.

  permissions:
    viewRoles: [admin, clinical_staff, billing_staff]
    importRoles: [admin, registration_staff]
    exportRoles: [admin]

options:
  skipEmptyRows: true
  trimWhitespace: true
  dateFormat: "YYYY-MM-DD"

columns:
  # ---------------------------------------------------------------------------
  # Medical Record Number (MRN)
  # Intent: Unique patient identifier within the healthcare system
  # Compliance: HIPAA - Protected identifier
  # ---------------------------------------------------------------------------
  - source: "MRN"
    target: medical_record_number
    type: string
    required: true
    sensitivity: secret              # 🔒 HIPAA protected identifier
    masking:
      style: partial
      pattern: "MRN-***"
      visibleChars: 3

  # ---------------------------------------------------------------------------
  # Patient Name Fields
  # Intent: Legal name for identification and records
  # Compliance: HIPAA PHI - Patient identifying information
  # ---------------------------------------------------------------------------
  - source: "First Name"
    target: first_name
    type: string
    required: true
    sensitivity: confidential        # 🔒 HIPAA PHI
    masking:
      style: partial
      visibleChars: 2

  - source: "Last Name"
    target: last_name
    type: string
    required: true
    sensitivity: confidential        # 🔒 HIPAA PHI
    masking:
      style: partial
      visibleChars: 2

  # ---------------------------------------------------------------------------
  # Date of Birth
  # Intent: Patient age verification and identification
  # Compliance: HIPAA PHI - One of 18 identifiers
  # ---------------------------------------------------------------------------
  - source: "DOB"
    target: date_of_birth
    type: date
    required: true
    sensitivity: confidential        # 🔒 HIPAA PHI
    masking:
      style: partial
      pattern: "****-**-"
      visibleChars: 2                # Shows year only: ****-**-85

  # ---------------------------------------------------------------------------
  # Social Security Number
  # Intent: Insurance and billing verification
  # Compliance: HIPAA - Highly restricted identifier
  # ---------------------------------------------------------------------------
  - source: "SSN"
    target: ssn
    type: string
    required: false
    sensitivity: highly_restricted   # 🔒 Maximum HIPAA protection
    masking:
      style: partial
      pattern: "***-**-"
      visibleChars: 4
    validation:
      - type: regex
        pattern: "^\\d{3}-\\d{2}-\\d{4}$"
        message: "SSN must be in format XXX-XX-XXXX"

  # ---------------------------------------------------------------------------
  # Address Fields
  # Intent: Patient contact and billing address
  # Compliance: HIPAA PHI - Geographic identifiers
  # ---------------------------------------------------------------------------
  - source: "Address"
    target: street_address
    type: string
    required: false
    sensitivity: confidential        # 🔒 HIPAA PHI

  - source: "City"
    target: city
    type: string
    required: false
    sensitivity: confidential

  - source: "State"
    target: state
    type: string
    required: false
    sensitivity: internal            # State alone is less sensitive

  - source: "ZIP"
    target: zip_code
    type: string
    required: false
    sensitivity: confidential        # 🔒 First 3 digits are PHI
    masking:
      style: partial
      visibleChars: 3                # Shows: 021**

  # ---------------------------------------------------------------------------
  # Phone Number
  # Intent: Patient contact for appointments and emergencies
  # Compliance: HIPAA PHI - Contact information
  # ---------------------------------------------------------------------------
  - source: "Phone"
    target: phone_number
    type: string
    required: false
    sensitivity: confidential
    masking:
      style: partial
      pattern: "***-***-"
      visibleChars: 4

  # ---------------------------------------------------------------------------
  # Insurance ID
  # Intent: Billing and insurance verification
  # Compliance: HIPAA PHI - Health plan identifier
  # ---------------------------------------------------------------------------
  - source: "Insurance ID"
    target: insurance_id
    type: string
    required: false
    sensitivity: secret              # 🔒 HIPAA protected
    masking:
      style: partial
      visibleChars: 4
```

---

## 🏢 Healthcare Integration Patterns

### Pattern 1: HL7 ADT Message Import

```typescript
// Import patient admissions from HL7 ADT feed
const result = await dataspec.import({
  entity: 'patient_admissions',
  spec: 'hl7_adt_import_v1',
  file: adtMessageCSV,
  options: {
    validateConsent: true,           // Verify patient consent flags
    minimumNecessary: true,          // Only import required fields
    auditPurpose: 'ADT Feed Processing'
  }
});
```

### Pattern 2: Insurance Claims Export

```typescript
// Export claims data with HIPAA minimum necessary
const exportResult = await dataspec.export({
  entity: 'claims',
  spec: 'claims_export_hipaa_v1',
  format: 'csv',
  applyMasking: true,
  options: {
    minimumNecessary: true,          // Only export required fields
    excludeFields: ['ssn', 'diagnosis_notes'],
    auditPurpose: 'Monthly claims submission to BlueCross'
  },
  filters: {
    status: 'ready_to_submit',
    date_range: { start: '2025-01-01', end: '2025-01-31' }
  }
});
```

### Pattern 3: Research Data De-identification

```typescript
// Export de-identified data for research
const researchExport = await dataspec.export({
  entity: 'patients',
  spec: 'research_deidentified_v1',
  format: 'csv',
  options: {
    deidentify: true,                // Remove all 18 HIPAA identifiers
    generalizeAges: true,            // Age 90+ → "90+"
    truncateZipCodes: 3,             // Only first 3 digits
    auditPurpose: 'IRB Study #2025-001 - Diabetes outcomes'
  }
});
```

---

## 📊 HIPAA Compliance Checklist

| Requirement | DataSpec Feature | Status |
|-------------|------------------|--------|
| **Privacy Rule - Minimum Necessary** | Field-level export filtering | ✅ |
| **Privacy Rule - Consent Tracking** | Consent verification hooks | ✅ |
| **Security Rule - Access Controls** | Role-based view/import/export | ✅ |
| **Security Rule - Audit Controls** | Comprehensive access logging | ✅ |
| **Security Rule - Encryption** | Sensitive fields encrypted | ✅ |
| **Breach Notification - Detection** | Unmask operation alerts | ✅ |
| **Breach Notification - Audit Trail** | Full access history | ✅ |
| **De-identification** | 18 identifier removal support | ✅ |

---

## 🔐 Healthcare-Specific Features

### PHI Indicator Badges

DataSpec UI shows clear PHI indicators:

```tsx
import { PreviewTable, PHIBadge } from '@samas-it-services/dataspec-react';

// PHI fields show warning badges in preview
<PreviewTable
  showPHIIndicators={true}
  highlightSensitiveFields={true}
  requireConsentConfirmation={true}
/>
```

### Consent Verification Hook

```yaml
# In YAML spec
hooks:
  beforeInsert:
    - name: verifyPatientConsent
      type: custom
      config:
        consentField: consent_status
        requiredValue: "verified"
        errorMessage: "Patient consent required before import"
```

### De-identification Transform

```yaml
# Transform for research exports
columns:
  - source: "DOB"
    target: age_at_visit
    type: string
    transform:
      - type: calculate_age
        fromField: date_of_birth
        asOf: visit_date
      - type: generalize_age
        threshold: 90
        replacement: "90+"
```

---

## 🚀 Getting Started

1. **Install DataSpec packages:**
   ```bash
   npm install @samas-it-services/dataspec-core @samas-it-services/dataspec-react
   ```

2. **Configure healthcare entities** with appropriate PHI classifications

3. **Set up role-based access** matching your organization's access controls

4. **Enable audit logging** for HIPAA compliance reporting

[Full Getting Started Guide →](../getting-started.md)

---

## 📚 Related Documentation

- [Operation Modes Guide](../operation-modes.md) - Configure entity restrictions
- [Role Permissions Guide](../role-permissions.md) - Set up role-based access
- [YAML Spec Guide](../yaml-spec-guide.md) - Complete specification reference
- [API Reference](../api-reference.md) - Full API documentation

---

**Need help with healthcare integration?** See our [Integration Guide](../integration-guide.md) for step-by-step instructions.
