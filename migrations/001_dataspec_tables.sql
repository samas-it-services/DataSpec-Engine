-- DataSpec Engine - Database Tables
-- Migration 001: Core tables for DataSpec operations

-- Operation logs table (audit trail)
CREATE TABLE IF NOT EXISTS dataspec_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    spec_id UUID,
    spec_name VARCHAR(255),
    execution_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email VARCHAR(255),
    user_roles TEXT[],
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL,
    records_affected INTEGER,
    execution_time_ms INTEGER,
    error_message TEXT,
    error_details JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for operation logs
CREATE INDEX IF NOT EXISTS idx_operation_logs_event_type ON dataspec_operation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity_type ON dataspec_operation_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON dataspec_operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_execution_id ON dataspec_operation_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON dataspec_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON dataspec_operation_logs(status);

-- Unmask logs table (tracks access to sensitive data)
CREATE TABLE IF NOT EXISTS dataspec_unmask_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_roles TEXT[],
    reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for unmask logs
CREATE INDEX IF NOT EXISTS idx_unmask_logs_user_id ON dataspec_unmask_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_unmask_logs_table_name ON dataspec_unmask_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_unmask_logs_field_name ON dataspec_unmask_logs(field_name);
CREATE INDEX IF NOT EXISTS idx_unmask_logs_created_at ON dataspec_unmask_logs(created_at DESC);

-- Spec definitions table (stores YAML specs)
CREATE TABLE IF NOT EXISTS dataspec_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    entity VARCHAR(100) NOT NULL,
    description TEXT,
    yaml_content TEXT NOT NULL,
    parsed_spec JSONB,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    author_id UUID REFERENCES auth.users(id),
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for spec definitions
CREATE INDEX IF NOT EXISTS idx_spec_definitions_entity ON dataspec_definitions(entity);
CREATE INDEX IF NOT EXISTS idx_spec_definitions_is_active ON dataspec_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_spec_definitions_tags ON dataspec_definitions USING GIN(tags);

-- Spec versions table (version history)
CREATE TABLE IF NOT EXISTS dataspec_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_id UUID NOT NULL REFERENCES dataspec_definitions(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    yaml_content TEXT NOT NULL,
    parsed_spec JSONB,
    change_summary TEXT,
    author_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for spec versions
CREATE INDEX IF NOT EXISTS idx_spec_versions_spec_id ON dataspec_versions(spec_id);
CREATE INDEX IF NOT EXISTS idx_spec_versions_created_at ON dataspec_versions(created_at DESC);

-- Security profiles table (role-based masking configurations)
CREATE TABLE IF NOT EXISTS dataspec_security_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    role_permissions JSONB NOT NULL,
    sensitivity_access JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default security profile
INSERT INTO dataspec_security_profiles (name, description, role_permissions, sensitivity_access)
VALUES (
    'default',
    'Default security profile',
    '{}',
    '{
        "admin": ["public", "internal", "confidential", "secret", "highly_restricted"],
        "manager": ["public", "internal", "confidential"],
        "user": ["public", "internal"],
        "guest": ["public"]
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dataspec_definitions_updated_at
    BEFORE UPDATE ON dataspec_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dataspec_security_profiles_updated_at
    BEFORE UPDATE ON dataspec_security_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE dataspec_operation_logs IS 'Audit trail for all DataSpec operations (imports, exports, etc.)';
COMMENT ON TABLE dataspec_unmask_logs IS 'Tracks when sensitive data is unmasked and by whom';
COMMENT ON TABLE dataspec_definitions IS 'Stores DataSpec YAML specifications';
COMMENT ON TABLE dataspec_versions IS 'Version history for DataSpec specifications';
COMMENT ON TABLE dataspec_security_profiles IS 'Role-based security configurations for data masking';
