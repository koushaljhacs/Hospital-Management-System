-- ============================================
-- MIGRATION: 004_create_appointments.sql (FIXED)
-- DESCRIPTION: Create appointments table with complete fields
-- DEPENDS ON: 001_users.sql, 002_patients.sql, 003_employees.sql
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create appointment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status_enum') THEN
        CREATE TYPE appointment_status_enum AS ENUM (
            'scheduled',
            'confirmed',
            'checked_in',
            'in_progress',
            'completed',
            'cancelled',
            'no_show',
            'rescheduled'
        );
        RAISE NOTICE 'Created appointment_status_enum type';
    END IF;
END $$;

-- Create appointment_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type_enum') THEN
        CREATE TYPE appointment_type_enum AS ENUM (
            'regular_checkup',
            'consultation',
            'follow_up',
            'emergency',
            'surgery_consultation',
            'lab_test',
            'vaccination',
            'physical_therapy',
            'telemedicine',
            'home_visit'
        );
        RAISE NOTICE 'Created appointment_type_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE APPOINTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS appointments (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    
    -- ========================================
    -- APPOINTMENT DETAILS
    -- ========================================
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status appointment_status_enum DEFAULT 'scheduled',
    type appointment_type_enum NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    
    -- ========================================
    -- QUEUE MANAGEMENT
    -- ========================================
    queue_number INTEGER,
    estimated_wait_time INTEGER,
    
    -- ========================================
    -- EMERGENCY FLAG
    -- ========================================
    is_emergency BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- VITALS
    -- ========================================
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    temperature DECIMAL(4,2),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    
    -- ========================================
    -- FEES & INSURANCE
    -- ========================================
    consultation_fee DECIMAL(10,2),
    insurance_verified BOOLEAN DEFAULT FALSE,
    pre_authorization_number VARCHAR(100),
    
    -- ========================================
    -- CHECK-IN/OUT
    -- ========================================
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    
    -- ========================================
    -- CANCELLATION DETAILS
    -- ========================================
    cancellation_reason TEXT,
    cancelled_by UUID,
    cancelled_at TIMESTAMP,
    
    -- ========================================
    -- RESCHEDULING
    -- ========================================
    rescheduled_from UUID,
    
    -- ========================================
    -- FOLLOW-UP
    -- ========================================
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_instructions TEXT,
    
    -- ========================================
    -- REMINDERS & NOTIFICATIONS
    -- ========================================
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,
    sms_reminder_sent BOOLEAN DEFAULT FALSE,
    email_reminder_sent BOOLEAN DEFAULT FALSE,
    whatsapp_reminder_sent BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- PATIENT FEEDBACK
    -- ========================================
    patient_feedback TEXT,
    patient_rating INTEGER,
    
    -- ========================================
    -- SYSTEM FIELDS
    -- ========================================
    ip_address INET,
    user_agent TEXT,
    created_by UUID,
    last_modified_by UUID,
    
    -- ========================================
    -- AUDIT COLUMNS
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- ========================================
    -- SOFT DELETE
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id) REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointments_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_appointments_rescheduled_from FOREIGN KEY (rescheduled_from) REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_appointments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_appointments_last_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_appointments_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_appointment_date CHECK (appointment_date >= CURRENT_DATE OR is_emergency = TRUE),
    CONSTRAINT check_appointment_time CHECK (
        (appointment_time BETWEEN '08:00:00' AND '20:00:00') OR is_emergency = TRUE
    ),
    CONSTRAINT check_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    CONSTRAINT check_patient_rating CHECK (patient_rating >= 1 AND patient_rating <= 5),
    CONSTRAINT check_queue_number CHECK (queue_number > 0),
    CONSTRAINT check_estimated_wait CHECK (estimated_wait_time >= 0),
    CONSTRAINT check_follow_up_date CHECK (follow_up_date IS NULL OR follow_up_date > appointment_date),
    CONSTRAINT check_cancellation CHECK (
        (status IN ('cancelled', 'no_show') AND cancellation_reason IS NOT NULL AND cancelled_at IS NOT NULL) OR
        (status NOT IN ('cancelled', 'no_show'))
    ),
    CONSTRAINT check_reminder_sent CHECK (
        (reminder_sent = TRUE AND reminder_sent_at IS NOT NULL) OR
        (reminder_sent = FALSE)
    ),
    CONSTRAINT check_temperature CHECK (temperature IS NULL OR (temperature >= 30 AND temperature <= 45)),
    CONSTRAINT check_heart_rate CHECK (heart_rate IS NULL OR (heart_rate >= 30 AND heart_rate <= 250)),
    CONSTRAINT check_blood_pressure CHECK (
        (blood_pressure_systolic IS NULL AND blood_pressure_diastolic IS NULL) OR
        (blood_pressure_systolic >= 70 AND blood_pressure_systolic <= 250 AND
         blood_pressure_diastolic >= 40 AND blood_pressure_diastolic <= 150)
    )
);

-- ============================================
-- PART 3: CREATE INDEXES (FIXED - Removed problematic predicates)
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(type) WHERE is_deleted = FALSE;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date ON appointments(patient_id, appointment_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status) WHERE is_deleted = FALSE;

-- Queue management indexes
CREATE INDEX IF NOT EXISTS idx_appointments_queue ON appointments(appointment_date, queue_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_wait_time ON appointments(estimated_wait_time) WHERE is_deleted = FALSE;

-- Emergency and follow-up indexes
CREATE INDEX IF NOT EXISTS idx_appointments_emergency ON appointments(is_emergency, appointment_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_follow_up ON appointments(follow_up_date) WHERE follow_up_required = TRUE;

-- Reminder indexes (FIXED - Removed CURRENT_DATE condition)
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON appointments(reminder_sent) WHERE reminder_sent = FALSE;

-- Patient feedback indexes
CREATE INDEX IF NOT EXISTS idx_appointments_rating ON appointments(patient_rating) WHERE patient_rating IS NOT NULL;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_appointments_deleted ON appointments(is_deleted, deleted_at);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at') THEN
        CREATE TRIGGER update_appointments_updated_at
            BEFORE UPDATE ON appointments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_appointments_updated_at';
    END IF;
END $$;

-- Function for auto queue number
CREATE OR REPLACE FUNCTION generate_appointment_queue_number()
RETURNS TRIGGER AS $$
DECLARE
    last_queue INTEGER;
BEGIN
    IF NEW.queue_number IS NULL THEN
        SELECT COALESCE(MAX(queue_number), 0) + 1
        INTO last_queue
        FROM appointments
        WHERE appointment_date = NEW.appointment_date;
        
        NEW.queue_number = last_queue;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto queue number
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'generate_appointment_queue') THEN
        CREATE TRIGGER generate_appointment_queue
            BEFORE INSERT ON appointments
            FOR EACH ROW
            EXECUTE FUNCTION generate_appointment_queue_number();
        RAISE NOTICE 'Created trigger generate_appointment_queue';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE appointments IS 'Complete patient appointments and scheduling';
COMMENT ON COLUMN appointments.id IS 'Primary key - UUID';
COMMENT ON COLUMN appointments.patient_id IS 'Patient who booked the appointment';
COMMENT ON COLUMN appointments.doctor_id IS 'Doctor assigned to the appointment';
COMMENT ON COLUMN appointments.appointment_date IS 'Date of appointment';
COMMENT ON COLUMN appointments.appointment_time IS 'Time of appointment';
COMMENT ON COLUMN appointments.duration_minutes IS 'Expected duration in minutes';
COMMENT ON COLUMN appointments.status IS 'Current status of appointment';
COMMENT ON COLUMN appointments.type IS 'Type of appointment';
COMMENT ON COLUMN appointments.reason IS 'Reason for visit';
COMMENT ON COLUMN appointments.notes IS 'Additional notes from patient/doctor';
COMMENT ON COLUMN appointments.queue_number IS 'Queue number for the day';
COMMENT ON COLUMN appointments.estimated_wait_time IS 'Estimated wait time in minutes';
COMMENT ON COLUMN appointments.is_emergency IS 'Emergency appointment flag';
COMMENT ON COLUMN appointments.blood_pressure_systolic IS 'Systolic blood pressure';
COMMENT ON COLUMN appointments.blood_pressure_diastolic IS 'Diastolic blood pressure';
COMMENT ON COLUMN appointments.heart_rate IS 'Heart rate in BPM';
COMMENT ON COLUMN appointments.temperature IS 'Body temperature in Celsius';
COMMENT ON COLUMN appointments.weight IS 'Weight in kg';
COMMENT ON COLUMN appointments.height IS 'Height in cm';
COMMENT ON COLUMN appointments.consultation_fee IS 'Fee for consultation';
COMMENT ON COLUMN appointments.insurance_verified IS 'Whether insurance was verified';
COMMENT ON COLUMN appointments.pre_authorization_number IS 'Insurance pre-authorization number';
COMMENT ON COLUMN appointments.check_in_time IS 'When patient checked in';
COMMENT ON COLUMN appointments.check_out_time IS 'When patient checked out';
COMMENT ON COLUMN appointments.cancellation_reason IS 'Reason for cancellation';
COMMENT ON COLUMN appointments.cancelled_by IS 'User who cancelled the appointment';
COMMENT ON COLUMN appointments.cancelled_at IS 'When appointment was cancelled';
COMMENT ON COLUMN appointments.rescheduled_from IS 'Original appointment ID if rescheduled';
COMMENT ON COLUMN appointments.follow_up_required IS 'Whether follow-up is needed';
COMMENT ON COLUMN appointments.follow_up_date IS 'Suggested follow-up date';
COMMENT ON COLUMN appointments.follow_up_instructions IS 'Follow-up instructions';
COMMENT ON COLUMN appointments.reminder_sent IS 'Whether reminder was sent';
COMMENT ON COLUMN appointments.reminder_sent_at IS 'When reminder was sent';
COMMENT ON COLUMN appointments.sms_reminder_sent IS 'Whether SMS reminder was sent';
COMMENT ON COLUMN appointments.email_reminder_sent IS 'Whether email reminder was sent';
COMMENT ON COLUMN appointments.whatsapp_reminder_sent IS 'Whether WhatsApp reminder was sent';
COMMENT ON COLUMN appointments.patient_feedback IS 'Feedback from patient';
COMMENT ON COLUMN appointments.patient_rating IS 'Patient rating (1-5)';
COMMENT ON COLUMN appointments.ip_address IS 'Client IP address';
COMMENT ON COLUMN appointments.user_agent IS 'Browser/device info';
COMMENT ON COLUMN appointments.created_by IS 'User who created the appointment';
COMMENT ON COLUMN appointments.last_modified_by IS 'User who last modified the appointment';
COMMENT ON COLUMN appointments.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN appointments.deleted_at IS 'Timestamp when soft deleted';
COMMENT ON COLUMN appointments.deleted_by IS 'User who soft deleted';

-- ============================================
-- PART 6: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    index_count INTEGER;
    trigger_count INTEGER;
    enum_count INTEGER;
    column_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- Check table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') INTO table_exists;
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'appointments';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'appointments';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('appointment_status_enum', 'appointment_type_enum');
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'appointments';
    
    -- Count constraints
    SELECT COUNT(*) INTO constraint_count FROM pg_constraint WHERE conrelid = 'appointments'::regclass;
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 004_create_appointments.sql COMPLETED';
    RAISE NOTICE 'Appointments table exists: %', table_exists;
    RAISE NOTICE 'Total columns: %', column_count;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE 'Total triggers: %', trigger_count;
    RAISE NOTICE 'Total enums: %', enum_count;
    RAISE NOTICE 'Total constraints: %', constraint_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================