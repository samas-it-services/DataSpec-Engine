-- DataSpec Engine - Migration 002: Entity Operation Modes & Role-Based Permissions
-- This migration adds support for controlling entity operation modes and role-based access

-- =============================================================================
-- 1. Create dataspec_entities table (entity registry)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dataspec_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    table_name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. Add Operation Mode column
-- =============================================================================
-- Modes:
--   full        - All operations allowed (view, import, export)
--   export_only - View and export only, no import (e.g., audit tables)
--   view_only   - View only, no import or export (e.g., system tables)
--   import_only - View and import only, no export (e.g., staging tables)

ALTER TABLE dataspec_entities ADD COLUMN IF NOT EXISTS operation_mode TEXT DEFAULT 'full'
    CHECK (operation_mode IN ('full', 'export_only', 'view_only', 'import_only'));

-- =============================================================================
-- 3. Add Role-Based Permission columns
-- =============================================================================
-- Each operation has its own list of allowed roles
-- Empty array = no one can perform this operation (except enforced by operation_mode)

ALTER TABLE dataspec_entities ADD COLUMN IF NOT EXISTS view_roles TEXT[] DEFAULT ARRAY['super_admin'];
ALTER TABLE dataspec_entities ADD COLUMN IF NOT EXISTS import_roles TEXT[] DEFAULT ARRAY['super_admin'];
ALTER TABLE dataspec_entities ADD COLUMN IF NOT EXISTS export_roles TEXT[] DEFAULT ARRAY['super_admin'];

-- =============================================================================
-- 4. Add Category and Sort Order for grouping in UI
-- =============================================================================

ALTER TABLE dataspec_entities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE dataspec_entities ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- =============================================================================
-- 5. Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_entities_name ON dataspec_entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_table_name ON dataspec_entities(table_name);
CREATE INDEX IF NOT EXISTS idx_entities_operation_mode ON dataspec_entities(operation_mode);
CREATE INDEX IF NOT EXISTS idx_entities_category ON dataspec_entities(category);
CREATE INDEX IF NOT EXISTS idx_entities_enabled ON dataspec_entities(enabled);
CREATE INDEX IF NOT EXISTS idx_entities_sort_order ON dataspec_entities(sort_order);

-- GIN indexes for role array searches
CREATE INDEX IF NOT EXISTS idx_entities_view_roles ON dataspec_entities USING GIN(view_roles);
CREATE INDEX IF NOT EXISTS idx_entities_import_roles ON dataspec_entities USING GIN(import_roles);
CREATE INDEX IF NOT EXISTS idx_entities_export_roles ON dataspec_entities USING GIN(export_roles);

-- =============================================================================
-- 6. Update trigger for updated_at
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS update_dataspec_entities_updated_at
    BEFORE UPDATE ON dataspec_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 7. Row Level Security (RLS)
-- =============================================================================

ALTER TABLE dataspec_entities ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view entities (UI filtering is done by roles)
CREATE POLICY IF NOT EXISTS "Authenticated users can view entities"
    ON dataspec_entities
    FOR SELECT
    TO authenticated
    USING (enabled = true);

-- Policy: Only super_admin can modify entities
CREATE POLICY IF NOT EXISTS "Super admins can modify entities"
    ON dataspec_entities
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role_name = 'super_admin'
        )
    );

-- =============================================================================
-- 8. Documentation
-- =============================================================================

COMMENT ON TABLE dataspec_entities IS 'Registry of all entities available in DataSpec Engine with operation modes and permissions';
COMMENT ON COLUMN dataspec_entities.operation_mode IS 'Controls which operations are allowed: full, export_only, view_only, import_only';
COMMENT ON COLUMN dataspec_entities.view_roles IS 'Array of role names that can view this entity in the UI';
COMMENT ON COLUMN dataspec_entities.import_roles IS 'Array of role names that can import data to this entity';
COMMENT ON COLUMN dataspec_entities.export_roles IS 'Array of role names that can export data from this entity';
COMMENT ON COLUMN dataspec_entities.category IS 'Category for grouping entities in UI (e.g., core, financial, audit, system)';
COMMENT ON COLUMN dataspec_entities.sort_order IS 'Display order within category';

-- =============================================================================
-- 9. Helper function to check if user has permission for an operation
-- =============================================================================

CREATE OR REPLACE FUNCTION dataspec_check_permission(
    p_entity_name TEXT,
    p_operation TEXT,
    p_user_roles TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_entity RECORD;
    v_allowed_roles TEXT[];
BEGIN
    -- Get the entity
    SELECT * INTO v_entity
    FROM dataspec_entities
    WHERE name = p_entity_name AND enabled = true;

    IF v_entity IS NULL THEN
        RETURN false;
    END IF;

    -- Check operation mode first
    CASE p_operation
        WHEN 'view' THEN
            -- View is always allowed (filtered by view_roles)
            v_allowed_roles := v_entity.view_roles;
        WHEN 'import' THEN
            -- Import not allowed for export_only and view_only modes
            IF v_entity.operation_mode IN ('export_only', 'view_only') THEN
                RETURN false;
            END IF;
            v_allowed_roles := v_entity.import_roles;
        WHEN 'export' THEN
            -- Export not allowed for view_only and import_only modes
            IF v_entity.operation_mode IN ('view_only', 'import_only') THEN
                RETURN false;
            END IF;
            v_allowed_roles := v_entity.export_roles;
        ELSE
            RETURN false;
    END CASE;

    -- Check if user has any of the allowed roles
    RETURN v_allowed_roles && p_user_roles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION dataspec_check_permission IS 'Checks if a user with given roles can perform an operation on an entity';
