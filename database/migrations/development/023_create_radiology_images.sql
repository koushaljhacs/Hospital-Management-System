-- ============================================
-- MIGRATION: 016_create_radiology_images.sql
-- DESCRIPTION: Create radiology_images table for comprehensive imaging management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: patients table, appointments table, employees table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create radiology_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'radiology_type_enum') THEN
        CREATE TYPE radiology_type_enum AS ENUM (
            'xray',
            'mri',
            'ct_scan',
            'ultrasound',
            'mammogram',
            'fluoroscopy',
            'angiography',
            'pet_scan',
            'bone_scan',
            'nuclear_medicine',
            'other'
        );
        RAISE NOTICE 'Created radiology_type_enum type';
    END IF;
END $$;

-- Create radiology_report_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'radiology_report_status_enum') THEN
        CREATE TYPE radiology_report_status_enum AS ENUM (
            'pending',
            'preliminary',
            'final',
            'amended',
            'cancelled',
            'verified'
        );
        RAISE NOTICE 'Created radiology_report_status_enum type';
    END IF;
END $$;

-- Create radiology_priority enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'radiology_priority_enum') THEN
        CREATE TYPE radiology_priority_enum AS ENUM (
            'routine',
            'urgent',
            'stat',
            'timed'
        );
        RAISE NOTICE 'Created radiology_priority_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE RADIOLOGY IMAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS radiology_images (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_number VARCHAR(50) UNIQUE NOT NULL,
    accession_number VARCHAR(100) UNIQUE,
    
    -- ========================================
    -- PATIENT & APPOINTMENT
    -- ========================================
    patient_id UUID NOT NULL,
    appointment_id UUID,
    visit_id UUID,
    doctor_id UUID,
    
    -- ========================================
    -- IMAGE DETAILS
    -- ========================================
    image_type radiology_type_enum NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    dicom_url TEXT,
    image_metadata JSONB,
    image_size_bytes INTEGER,
    image_dimensions VARCHAR(50),
    image_format VARCHAR(20),
    
    -- ========================================
    -- STUDY DETAILS
    -- ========================================
    study_id VARCHAR(100),
    study_description TEXT,
    series_id VARCHAR(100),
    series_number INTEGER,
    instance_number INTEGER,
    modality VARCHAR(50),
    body_part VARCHAR(100),
    laterality VARCHAR(20),
    
    -- ========================================
    -- CLINICAL INFORMATION
    -- ========================================
    clinical_history TEXT,
    indication TEXT,
    technique TEXT,
    comparison TEXT,
    findings TEXT,
    impression TEXT,
    
    -- ========================================
    -- REPORT DETAILS
    -- ========================================
    report_text TEXT,
    report_status radiology_report_status_enum DEFAULT 'pending',
    report_url TEXT,
    report_html_url TEXT,
    report_pdf_url TEXT,
    preliminary_report TEXT,
    preliminary_report_by UUID,
    preliminary_report_at TIMESTAMP,
    final_report TEXT,
    final_report_by UUID,
    final_report_at TIMESTAMP,
    
    -- ========================================
    -- RADIOLOGIST
    -- ========================================
    radiologist_id UUID,
    resident_id UUID,
    technician_id UUID,
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    verified_by UUID,
    verified_at TIMESTAMP,
    
    -- ========================================
    -- QUALITY & ACCREDITATION
    -- ========================================
    quality_check_passed BOOLEAN DEFAULT FALSE,
    quality_check_by UUID,
    quality_check_at TIMESTAMP,
    quality_notes TEXT,
    peer_reviewed BOOLEAN DEFAULT FALSE,
    peer_review_by UUID,
    peer_review_at TIMESTAMP,
    peer_review_notes TEXT,
    
    -- ========================================
    -- PRIORITY & URGENCY
    -- ========================================
    priority radiology_priority_enum DEFAULT 'routine',
    is_emergency BOOLEAN DEFAULT FALSE,
    is_stat BOOLEAN DEFAULT FALSE,
    turnaround_target INTEGER,
    turnaround_actual INTEGER,
    
    -- ========================================
    -- BILLING
    -- ========================================
    is_billed BOOLEAN DEFAULT FALSE,
    invoice_id UUID,
    price DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    
    -- ========================================
    -- TIMESTAMPS
    -- ========================================
    ordered_at TIMESTAMP,
    scheduled_at TIMESTAMP,
    performed_at TIMESTAMP,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reported_at TIMESTAMP,
    delivered_at TIMESTAMP,
    viewed_at_patient TIMESTAMP,
    viewed_at_doctor TIMESTAMP,
    
    -- ========================================
    -- COMMUNICATION
    -- ========================================
    critical_finding BOOLEAN DEFAULT FALSE,
    critical_finding_communicated_to VARCHAR(200),
    critical_finding_communicated_at TIMESTAMP,
    critical_finding_notes TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,
    notified_to UUID[],
    
    -- ========================================
    -- CONSENT
    -- ========================================
    consent_obtained BOOLEAN DEFAULT TRUE,
    consent_form_url TEXT,
    contrast_used BOOLEAN DEFAULT FALSE,
    contrast_type VARCHAR(100),
    contrast_volume VARCHAR(50),
    contrast_reaction BOOLEAN DEFAULT FALSE,
    contrast_reaction_notes TEXT,
    
    -- ========================================
    -- RADIATION DOSE
    -- ========================================
    radiation_dose DECIMAL(10,2),
    dose_unit VARCHAR(20),
    dlp DECIMAL(10,2),
    ctdi_vol DECIMAL(10,2),
    dose_notes TEXT,
    
    -- ========================================
    -- AI ANALYSIS
    -- ========================================
    ai_analysis_applied BOOLEAN DEFAULT FALSE,
    ai_model_version VARCHAR(50),
    ai_findings JSONB,
    ai_confidence_score DECIMAL(5,2),
    ai_recommendations TEXT,
    
    -- ========================================
    -- TAGS & KEYWORDS
    -- ========================================
    tags TEXT[],
    keywords TEXT,
    findings_keywords TEXT[],
    
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
    CONSTRAINT fk_radiology_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_radiology_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_radiologist FOREIGN KEY (radiologist_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_resident FOREIGN KEY (resident_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_technician FOREIGN KEY (technician_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_reviewed_by FOREIGN KEY (reviewed_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_quality_check_by FOREIGN KEY (quality_check_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_peer_review_by FOREIGN KEY (peer_review_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_preliminary_report_by FOREIGN KEY (preliminary_report_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_final_report_by FOREIGN KEY (final_report_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_radiology_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (performed_at >= scheduled_at),
    CONSTRAINT check_report_dates CHECK (reported_at >= performed_at),
    CONSTRAINT check_upload_dates CHECK (uploaded_at >= performed_at),
    CONSTRAINT check_critical_communication CHECK (
        critical_finding = FALSE OR critical_finding_communicated_at IS NOT NULL
    ),
    CONSTRAINT check_ai_confidence CHECK (
        ai_confidence_score BETWEEN 0 AND 100
    ),
    CONSTRAINT check_turnaround CHECK (
        turnaround_actual >= 0
    ),
    CONSTRAINT check_radiation_dose CHECK (
        radiation_dose >= 0
    )
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_radiology_image_number ON radiology_images(image_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_accession ON radiology_images(accession_number) WHERE accession_number IS NOT NULL AND is_deleted = FALSE;

-- Patient & appointment indexes
CREATE INDEX IF NOT EXISTS idx_radiology_patient ON radiology_images(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_appointment ON radiology_images(appointment_id) WHERE appointment_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_doctor ON radiology_images(doctor_id) WHERE doctor_id IS NOT NULL AND is_deleted = FALSE;

-- Image type indexes
CREATE INDEX IF NOT EXISTS idx_radiology_type ON radiology_images(image_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_modality ON radiology_images(modality) WHERE modality IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_body_part ON radiology_images(body_part) WHERE body_part IS NOT NULL AND is_deleted = FALSE;

-- Study indexes
CREATE INDEX IF NOT EXISTS idx_radiology_study ON radiology_images(study_id) WHERE study_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_series ON radiology_images(series_id) WHERE series_id IS NOT NULL AND is_deleted = FALSE;

-- Report status indexes
CREATE INDEX IF NOT EXISTS idx_radiology_report_status ON radiology_images(report_status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_priority ON radiology_images(priority) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_emergency ON radiology_images(is_emergency) WHERE is_emergency = TRUE AND is_deleted = FALSE;

-- Radiologist indexes
CREATE INDEX IF NOT EXISTS idx_radiology_radiologist ON radiology_images(radiologist_id) WHERE radiologist_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_technician ON radiology_images(technician_id) WHERE technician_id IS NOT NULL AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_radiology_ordered ON radiology_images(ordered_at) WHERE ordered_at IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_performed ON radiology_images(performed_at) WHERE performed_at IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_uploaded ON radiology_images(uploaded_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_radiology_reported ON radiology_images(reported_at) WHERE reported_at IS NOT NULL AND is_deleted = FALSE;

-- Critical findings index
CREATE INDEX IF NOT EXISTS idx_radiology_critical ON radiology_images(critical_finding) WHERE critical_finding = TRUE AND is_deleted = FALSE;

-- AI analysis index
CREATE INDEX IF NOT EXISTS idx_radiology_ai ON radiology_images(ai_analysis_applied) WHERE ai_analysis_applied = TRUE AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_radiology_deleted ON radiology_images(is_deleted, deleted_at);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_radiology_image_metadata ON radiology_images USING gin(image_metadata);
CREATE INDEX IF NOT EXISTS idx_radiology_ai_findings ON radiology_images USING gin(ai_findings);
CREATE INDEX IF NOT EXISTS idx_radiology_tags ON radiology_images USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_radiology_findings_keywords ON radiology_images USING gin(findings_keywords);
CREATE INDEX IF NOT EXISTS idx_radiology_notified_to ON radiology_images USING gin(notified_to);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_radiology_search ON radiology_images USING gin(
    to_tsvector('english', 
        COALESCE(findings, '') || ' ' || 
        COALESCE(impression, '') || ' ' || 
        COALESCE(report_text, '') || ' ' || 
        COALESCE(clinical_history, '') || ' ' || 
        COALESCE(indication, '')
    )
);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_radiology_images_updated_at') THEN
        CREATE TRIGGER update_radiology_images_updated_at
            BEFORE UPDATE ON radiology_images
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_radiology_images_updated_at';
    END IF;
END $$;

-- Function to calculate turnaround time
CREATE OR REPLACE FUNCTION calculate_radiology_turnaround()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.performed_at IS NOT NULL AND NEW.reported_at IS NOT NULL THEN
        NEW.turnaround_actual = EXTRACT(EPOCH FROM (NEW.reported_at - NEW.performed_at)) / 3600;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for turnaround calculation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_radiology_turnaround') THEN
        CREATE TRIGGER calculate_radiology_turnaround
            BEFORE UPDATE OF reported_at ON radiology_images
            FOR EACH ROW
            EXECUTE FUNCTION calculate_radiology_turnaround();
        RAISE NOTICE 'Created trigger calculate_radiology_turnaround';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE radiology_images IS 'Complete radiology imaging management system';
COMMENT ON COLUMN radiology_images.id IS 'Primary key - UUID';
COMMENT ON COLUMN radiology_images.image_number IS 'Unique image number';
COMMENT ON COLUMN radiology_images.accession_number IS 'Accession number from RIS';
COMMENT ON COLUMN radiology_images.patient_id IS 'Patient reference';
COMMENT ON COLUMN radiology_images.appointment_id IS 'Appointment reference';
COMMENT ON COLUMN radiology_images.doctor_id IS 'Referring doctor';
COMMENT ON COLUMN radiology_images.image_type IS 'Type of radiology image';
COMMENT ON COLUMN radiology_images.image_url IS 'URL to image';
COMMENT ON COLUMN radiology_images.dicom_url IS 'URL to DICOM data';
COMMENT ON COLUMN radiology_images.image_metadata IS 'Image metadata in JSON';
COMMENT ON COLUMN radiology_images.study_id IS 'Study ID from modality';
COMMENT ON COLUMN radiology_images.series_id IS 'Series ID';
COMMENT ON COLUMN radiology_images.modality IS 'Modality used';
COMMENT ON COLUMN radiology_images.body_part IS 'Body part imaged';
COMMENT ON COLUMN radiology_images.clinical_history IS 'Clinical history';
COMMENT ON COLUMN radiology_images.findings IS 'Radiology findings';
COMMENT ON COLUMN radiology_images.impression IS 'Radiology impression';
COMMENT ON COLUMN radiology_images.report_text IS 'Full radiology report';
COMMENT ON COLUMN radiology_images.report_status IS 'Status of report';
COMMENT ON COLUMN radiology_images.radiologist_id IS 'Radiologist who interpreted';
COMMENT ON COLUMN radiology_images.priority IS 'Priority of study';
COMMENT ON COLUMN radiology_images.is_emergency IS 'Emergency study flag';
COMMENT ON COLUMN radiology_images.critical_finding IS 'Critical finding detected';
COMMENT ON COLUMN radiology_images.radiation_dose IS 'Radiation dose';
COMMENT ON COLUMN radiology_images.ai_analysis_applied IS 'AI analysis applied';
COMMENT ON COLUMN radiology_images.ai_findings IS 'AI findings in JSON';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radiology_images') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'radiology_images';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'radiology_images';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'radiology_images'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'radiology_images'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'radiology_images';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('radiology_type_enum', 'radiology_report_status_enum', 'radiology_priority_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 016_create_radiology_images.sql COMPLETED';
    RAISE NOTICE 'Radiology Images table exists: %', table_exists;
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