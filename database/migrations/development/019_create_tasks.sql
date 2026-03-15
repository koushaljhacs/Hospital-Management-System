-- ============================================
-- MIGRATION: 019_create_tasks.sql
-- DESCRIPTION: Create tasks table for comprehensive task management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: users table, patients table, appointments table, beds table, 
--             equipment table, test_orders table, prescriptions table, 
--             departments table, shifts table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create task_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type_enum') THEN
        CREATE TYPE task_type_enum AS ENUM (
            'patient_transport',
            'sample_collection',
            'equipment_maintenance',
            'cleaning',
            'medication_delivery',
            'document_delivery',
            'patient_care',
            'lab_test',
            'radiology',
            'pharmacy',
            'billing',
            'administrative',
            'emergency',
            'follow_up',
            'other'
        );
        RAISE NOTICE 'Created task_type_enum type';
    END IF;
END $$;

-- Create task_priority enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority_enum') THEN
        CREATE TYPE task_priority_enum AS ENUM (
            'low',
            'medium',
            'high',
            'urgent',
            'critical'
        );
        RAISE NOTICE 'Created task_priority_enum type';
    END IF;
END $$;

-- Create task_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status_enum') THEN
        CREATE TYPE task_status_enum AS ENUM (
            'pending',
            'assigned',
            'accepted',
            'in_progress',
            'paused',
            'completed',
            'verified',
            'cancelled',
            'failed'
        );
        RAISE NOTICE 'Created task_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number VARCHAR(50) UNIQUE NOT NULL,
    task_type task_type_enum NOT NULL,
    
    -- ========================================
    -- ASSIGNMENT
    -- ========================================
    assigned_to UUID NOT NULL,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    department_id UUID,
    shift_id UUID,
    
    -- ========================================
    -- RELATED ENTITIES
    -- ========================================
    patient_id UUID,
    appointment_id UUID,
    bed_id UUID,
    equipment_id UUID,
    test_order_id UUID,
    prescription_id UUID,
    
    -- ========================================
    -- TASK DETAILS
    -- ========================================
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT,
    location VARCHAR(200),
    
    -- ========================================
    -- PRIORITY & URGENCY
    -- ========================================
    priority task_priority_enum NOT NULL,
    urgency_level INTEGER DEFAULT 1,
    is_emergency BOOLEAN DEFAULT FALSE,
    estimated_duration INTEGER,
    
    -- ========================================
    -- STATUS & TIMING
    -- ========================================
    status task_status_enum NOT NULL DEFAULT 'pending',
    due_time TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by UUID,
    
    -- ========================================
    -- DEPENDENCIES
    -- ========================================
    parent_task_id UUID,
    dependent_task_ids UUID[],
    blocking_tasks UUID[],
    
    -- ========================================
    -- PROGRESS TRACKING
    -- ========================================
    progress_percentage INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,
    escalation_level INTEGER DEFAULT 0,
    escalated_to UUID,
    escalated_at TIMESTAMP,
    escalation_reason TEXT,
    
    -- ========================================
    -- QUALITY & FEEDBACK
    -- ========================================
    quality_check_required BOOLEAN DEFAULT FALSE,
    quality_check_by UUID,
    quality_check_at TIMESTAMP,
    quality_check_passed BOOLEAN,
    quality_check_notes TEXT,
    feedback_from_patient TEXT,
    feedback_from_supervisor TEXT,
    feedback_rating INTEGER,
    
    -- ========================================
    -- ATTACHMENTS
    -- ========================================
    attachments JSONB,
    images TEXT[],
    documents JSONB,
    
    -- ========================================
    -- NOTES
    -- ========================================
    notes TEXT,
    internal_notes TEXT,
    metadata JSONB,
    
    -- ========================================
    -- AUDIT
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- ========================================
    -- SOFT DELETE
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_assigned_by FOREIGN KEY (assigned_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_bed FOREIGN KEY (bed_id) 
        REFERENCES beds(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_equipment FOREIGN KEY (equipment_id) 
        REFERENCES equipment(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_test_order FOREIGN KEY (test_order_id) 
        REFERENCES test_orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_prescription FOREIGN KEY (prescription_id) 
        REFERENCES prescriptions(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_parent_task FOREIGN KEY (parent_task_id) 
        REFERENCES tasks(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_shift FOREIGN KEY (shift_id) 
        REFERENCES shifts(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_escalated_to FOREIGN KEY (escalated_to) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_quality_check_by FOREIGN KEY (quality_check_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_cancelled_by FOREIGN KEY (cancelled_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (due_time >= assigned_at),
    CONSTRAINT check_completion CHECK (completed_at >= started_at),
    CONSTRAINT check_progress CHECK (progress_percentage BETWEEN 0 AND 100),
    CONSTRAINT check_time_spent CHECK (time_spent >= 0),
    CONSTRAINT check_estimated_duration CHECK (estimated_duration >= 0),
    CONSTRAINT check_urgency CHECK (urgency_level BETWEEN 1 AND 10),
    CONSTRAINT check_escalation CHECK (escalation_level >= 0),
    CONSTRAINT check_feedback_rating CHECK (feedback_rating BETWEEN 1 AND 5)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_tasks_number ON tasks(task_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE is_deleted = FALSE;

-- Assignment indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id) WHERE department_id IS NOT NULL AND is_deleted = FALSE;

-- Related entity indexes
CREATE INDEX IF NOT EXISTS idx_tasks_patient ON tasks(patient_id) WHERE patient_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_appointment ON tasks(appointment_id) WHERE appointment_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_bed ON tasks(bed_id) WHERE bed_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_equipment ON tasks(equipment_id) WHERE equipment_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_test_order ON tasks(test_order_id) WHERE test_order_id IS NOT NULL AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_tasks_due_time ON tasks(due_time) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_at ON tasks(assigned_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL AND is_deleted = FALSE;

-- Urgency indexes
CREATE INDEX IF NOT EXISTS idx_tasks_emergency ON tasks(is_emergency) WHERE is_emergency = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_urgency ON tasks(urgency_level) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_escalation ON tasks(escalation_level) WHERE escalation_level > 0 AND is_deleted = FALSE;

-- Dependency indexes
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL AND is_deleted = FALSE;

-- Progress indexes
CREATE INDEX IF NOT EXISTS idx_tasks_progress ON tasks(progress_percentage) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_reminder ON tasks(reminder_sent) WHERE reminder_sent = FALSE AND is_deleted = FALSE;

-- Quality indexes
CREATE INDEX IF NOT EXISTS idx_tasks_quality_required ON tasks(quality_check_required) WHERE quality_check_required = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_rating ON tasks(feedback_rating) WHERE feedback_rating IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(is_deleted, deleted_at);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_tasks_dependent_ids ON tasks USING gin(dependent_task_ids);
CREATE INDEX IF NOT EXISTS idx_tasks_blocking_tasks ON tasks USING gin(blocking_tasks);
CREATE INDEX IF NOT EXISTS idx_tasks_images ON tasks USING gin(images);
CREATE INDEX IF NOT EXISTS idx_tasks_attachments ON tasks USING gin(attachments);
CREATE INDEX IF NOT EXISTS idx_tasks_documents ON tasks USING gin(documents);
CREATE INDEX IF NOT EXISTS idx_tasks_metadata ON tasks USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
        CREATE TRIGGER update_tasks_updated_at
            BEFORE UPDATE ON tasks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_tasks_updated_at';
    END IF;
END $$;

-- Function to calculate time spent
CREATE OR REPLACE FUNCTION calculate_task_time_spent()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL THEN
        NEW.time_spent = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for time spent calculation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_task_time_spent') THEN
        CREATE TRIGGER calculate_task_time_spent
            BEFORE UPDATE OF completed_at ON tasks
            FOR EACH ROW
            EXECUTE FUNCTION calculate_task_time_spent();
        RAISE NOTICE 'Created trigger calculate_task_time_spent';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE tasks IS 'Complete task management system';
COMMENT ON COLUMN tasks.id IS 'Primary key - UUID';
COMMENT ON COLUMN tasks.task_number IS 'Unique task number';
COMMENT ON COLUMN tasks.task_type IS 'Type of task';
COMMENT ON COLUMN tasks.assigned_to IS 'User assigned to task';
COMMENT ON COLUMN tasks.assigned_by IS 'User who assigned task';
COMMENT ON COLUMN tasks.assigned_at IS 'When task was assigned';
COMMENT ON COLUMN tasks.department_id IS 'Department where task belongs';
COMMENT ON COLUMN tasks.shift_id IS 'Shift during which task was created';
COMMENT ON COLUMN tasks.patient_id IS 'Related patient';
COMMENT ON COLUMN tasks.appointment_id IS 'Related appointment';
COMMENT ON COLUMN tasks.bed_id IS 'Related bed';
COMMENT ON COLUMN tasks.equipment_id IS 'Related equipment';
COMMENT ON COLUMN tasks.test_order_id IS 'Related test order';
COMMENT ON COLUMN tasks.prescription_id IS 'Related prescription';
COMMENT ON COLUMN tasks.title IS 'Task title';
COMMENT ON COLUMN tasks.description IS 'Task description';
COMMENT ON COLUMN tasks.instructions IS 'Detailed instructions';
COMMENT ON COLUMN tasks.location IS 'Location where task needs to be done';
COMMENT ON COLUMN tasks.priority IS 'Task priority';
COMMENT ON COLUMN tasks.urgency_level IS 'Urgency level (1-10)';
COMMENT ON COLUMN tasks.is_emergency IS 'Whether task is emergency';
COMMENT ON COLUMN tasks.estimated_duration IS 'Estimated duration in minutes';
COMMENT ON COLUMN tasks.status IS 'Current task status';
COMMENT ON COLUMN tasks.due_time IS 'When task is due';
COMMENT ON COLUMN tasks.started_at IS 'When task was started';
COMMENT ON COLUMN tasks.completed_at IS 'When task was completed';
COMMENT ON COLUMN tasks.cancelled_at IS 'When task was cancelled';
COMMENT ON COLUMN tasks.cancellation_reason IS 'Reason for cancellation';
COMMENT ON COLUMN tasks.cancelled_by IS 'User who cancelled task';
COMMENT ON COLUMN tasks.parent_task_id IS 'Parent task ID for subtasks';
COMMENT ON COLUMN tasks.dependent_task_ids IS 'Tasks that depend on this task';
COMMENT ON COLUMN tasks.blocking_tasks IS 'Tasks blocking this task';
COMMENT ON COLUMN tasks.progress_percentage IS 'Progress percentage';
COMMENT ON COLUMN tasks.time_spent IS 'Time spent in minutes';
COMMENT ON COLUMN tasks.reminder_sent IS 'Whether reminder was sent';
COMMENT ON COLUMN tasks.reminder_sent_at IS 'When reminder was sent';
COMMENT ON COLUMN tasks.escalation_level IS 'Escalation level';
COMMENT ON COLUMN tasks.escalated_to IS 'User to whom task was escalated';
COMMENT ON COLUMN tasks.escalated_at IS 'When task was escalated';
COMMENT ON COLUMN tasks.escalation_reason IS 'Reason for escalation';
COMMENT ON COLUMN tasks.quality_check_required IS 'Whether quality check is required';
COMMENT ON COLUMN tasks.quality_check_by IS 'User who performed quality check';
COMMENT ON COLUMN tasks.quality_check_at IS 'When quality check was performed';
COMMENT ON COLUMN tasks.quality_check_passed IS 'Whether quality check passed';
COMMENT ON COLUMN tasks.quality_check_notes IS 'Quality check notes';
COMMENT ON COLUMN tasks.feedback_from_patient IS 'Feedback from patient';
COMMENT ON COLUMN tasks.feedback_from_supervisor IS 'Feedback from supervisor';
COMMENT ON COLUMN tasks.feedback_rating IS 'Feedback rating (1-5)';
COMMENT ON COLUMN tasks.attachments IS 'Attachments in JSON';
COMMENT ON COLUMN tasks.images IS 'Image URLs';
COMMENT ON COLUMN tasks.documents IS 'Documents in JSON';
COMMENT ON COLUMN tasks.notes IS 'General notes';
COMMENT ON COLUMN tasks.internal_notes IS 'Internal notes';
COMMENT ON COLUMN tasks.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN tasks.is_deleted IS 'Soft delete flag';

-- ============================================
-- PART 6: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
    check_count INTEGER;
    trigger_count INTEGER;
    enum_count INTEGER;
BEGIN
    -- Check table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'tasks';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'tasks';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'tasks'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'tasks'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'tasks';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('task_type_enum', 'task_priority_enum', 'task_status_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 019_create_tasks.sql COMPLETED';
    RAISE NOTICE 'Tasks table exists: %', table_exists;
    RAISE NOTICE 'Total columns: %', column_count;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE 'Foreign keys: %', fk_count;
    RAISE NOTICE 'Check constraints: %', check_count;
    RAISE NOTICE 'Triggers: %', trigger_count;
    RAISE NOTICE 'Enums created: %', enum_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================