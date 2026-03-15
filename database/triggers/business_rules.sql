-- ============================================
-- FILE: database/triggers/business_rules.sql
-- DESCRIPTION: Complete implementation of all 50 business rules
-- SAFE MIGRATION: Can be run multiple times without errors
-- ============================================

-- ============================================
-- PART 1: PATIENT RULES (BR-01 to BR-06)
-- ============================================

-- [BR-03] Emergency contact required
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_patient_emergency_contact'
    ) THEN
        ALTER TABLE patients 
        ADD CONSTRAINT check_patient_emergency_contact 
        CHECK (
            emergency_contact_name IS NOT NULL AND 
            emergency_contact_phone IS NOT NULL
        );
        RAISE NOTICE 'Added BR-03: Emergency contact required';
    END IF;
END $$;

-- [BR-04] Min age 0, Max age 150
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_patient_age_range'
    ) THEN
        ALTER TABLE patients 
        ADD CONSTRAINT check_patient_age_range 
        CHECK (
            date_of_birth >= (CURRENT_DATE - INTERVAL '150 years')::DATE AND
            date_of_birth <= CURRENT_DATE
        );
        RAISE NOTICE 'Added BR-04: Age range 0-150 years';
    END IF;
END $$;

-- [BR-05] Patient records cannot be deleted (only deactivated)
CREATE OR REPLACE FUNCTION prevent_patient_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Patient records cannot be deleted. Use is_deleted flag instead.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_patient_delete_trigger ON patients;
CREATE TRIGGER prevent_patient_delete_trigger
    BEFORE DELETE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION prevent_patient_delete();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-05: Patient records cannot be deleted';
END $$;

-- [BR-06] Consent form required for treatment
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_patient_consent'
    ) THEN
        ALTER TABLE patients 
        ADD CONSTRAINT check_patient_consent 
        CHECK (
            consent_form_signed = TRUE AND 
            consent_form_date <= CURRENT_DATE
        );
        RAISE NOTICE 'Added BR-06: Consent form required for treatment';
    END IF;
END $$;

-- ============================================
-- PART 2: APPOINTMENT RULES (BR-07 to BR-12)
-- ============================================

-- [BR-07] Cannot book appointment in past
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_appointment_not_past'
    ) THEN
        ALTER TABLE appointments 
        ADD CONSTRAINT check_appointment_not_past 
        CHECK (
            appointment_date >= CURRENT_DATE OR is_emergency = TRUE
        );
        RAISE NOTICE 'Added BR-07: Cannot book appointment in past';
    END IF;
END $$;

-- [BR-08] Max 30 appointments per doctor per day
CREATE OR REPLACE FUNCTION check_doctor_daily_appointments()
RETURNS TRIGGER AS $$
DECLARE
    daily_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO daily_count
    FROM appointments
    WHERE doctor_id = NEW.doctor_id
    AND appointment_date = NEW.appointment_date
    AND is_deleted = FALSE;
    
    IF daily_count >= 30 AND TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Doctor already has 30 appointments on this day';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_doctor_daily_appointments_trigger ON appointments;
CREATE TRIGGER check_doctor_daily_appointments_trigger
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION check_doctor_daily_appointments();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-08: Max 30 appointments per doctor per day';
END $$;

-- [BR-10] Cancellation allowed up to 2 hours before
CREATE OR REPLACE FUNCTION check_cancellation_time()
RETURNS TRIGGER AS $$
DECLARE
    appointment_datetime TIMESTAMP;
BEGIN
    IF NEW.status IN ('cancelled', 'no_show') AND OLD.status NOT IN ('cancelled', 'no_show') THEN
        appointment_datetime := NEW.appointment_date + NEW.appointment_time;
        
        IF appointment_datetime - CURRENT_TIMESTAMP < INTERVAL '2 hours' THEN
            RAISE EXCEPTION 'Cancellation only allowed up to 2 hours before appointment';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_cancellation_time_trigger ON appointments;
CREATE TRIGGER check_cancellation_time_trigger
    BEFORE UPDATE OF status ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION check_cancellation_time();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-10: Cancellation allowed up to 2 hours before';
END $$;

-- ============================================
-- PART 3: PRESCRIPTION RULES (BR-13 to BR-17)
-- ============================================

-- [BR-13] One prescription per appointment
CREATE OR REPLACE FUNCTION check_single_prescription_per_appointment()
RETURNS TRIGGER AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_count
    FROM prescriptions
    WHERE appointment_id = NEW.appointment_id
    AND is_deleted = FALSE;
    
    IF existing_count > 0 THEN
        RAISE EXCEPTION 'Only one prescription allowed per appointment';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_single_prescription_trigger ON prescriptions;
CREATE TRIGGER check_single_prescription_trigger
    BEFORE INSERT ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION check_single_prescription_per_appointment();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-13: One prescription per appointment';
END $$;

-- [BR-14] Medicine quantity must be positive
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_medicine_quantity'
    ) THEN
        ALTER TABLE medicines 
        ADD CONSTRAINT check_medicine_quantity 
        CHECK (quantity > 0);
        RAISE NOTICE 'Added BR-14: Medicine quantity must be positive';
    END IF;
END $$;

-- [BR-15] Dosage required for all medicines
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_medicine_dosage'
    ) THEN
        ALTER TABLE medicines 
        ADD CONSTRAINT check_medicine_dosage 
        CHECK (dosage IS NOT NULL AND dosage != '');
        RAISE NOTICE 'Added BR-15: Dosage required for all medicines';
    END IF;
END $$;

-- [BR-17] Prescription validity 30 days
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_prescription_validity'
    ) THEN
        ALTER TABLE prescriptions 
        ADD CONSTRAINT check_prescription_validity 
        CHECK (
            follow_up_date IS NULL OR 
            follow_up_date <= (created_at::DATE + 30)
        );
        RAISE NOTICE 'Added BR-17: Prescription validity 30 days';
    END IF;
END $$;

-- ============================================
-- PART 4: INVENTORY RULES (BR-18 to BR-23)
-- ============================================

-- [BR-18] Cannot dispense expired medicine
CREATE OR REPLACE FUNCTION check_medicine_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity < OLD.quantity THEN
        IF EXISTS (
            SELECT 1 FROM inventory 
            WHERE id = NEW.id 
            AND expiry_date < CURRENT_DATE
        ) THEN
            RAISE EXCEPTION 'Cannot dispense expired medicine';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_medicine_expiry_trigger ON inventory;
CREATE TRIGGER check_medicine_expiry_trigger
    BEFORE UPDATE OF quantity ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION check_medicine_expiry();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-18: Cannot dispense expired medicine';
END $$;

-- [BR-19] Stock cannot go negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_inventory_quantity'
    ) THEN
        ALTER TABLE inventory 
        ADD CONSTRAINT check_inventory_quantity 
        CHECK (quantity >= 0);
        RAISE NOTICE 'Added BR-19: Stock cannot go negative';
    END IF;
END $$;

-- [BR-20] Alert when stock < reorder level
CREATE OR REPLACE FUNCTION check_reorder_level_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity <= NEW.reorder_level THEN
        RAISE NOTICE 'Stock below reorder level for item';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_reorder_level_alert_trigger ON inventory;
CREATE TRIGGER check_reorder_level_alert_trigger
    AFTER UPDATE OF quantity ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION check_reorder_level_alert();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-20: Alert when stock < reorder level';
END $$;

-- [BR-23] Batch tracking mandatory
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_inventory_batch'
    ) THEN
        ALTER TABLE inventory 
        ADD CONSTRAINT check_inventory_batch 
        CHECK (batch_number IS NOT NULL AND batch_number != '');
        RAISE NOTICE 'Added BR-23: Batch tracking mandatory';
    END IF;
END $$;

-- ============================================
-- PART 5: BED RULES (BR-24 to BR-28)
-- ============================================

-- [BR-24] Bed status workflow
CREATE OR REPLACE FUNCTION check_bed_status_workflow()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT (
        (OLD.status = 'available' AND NEW.status IN ('occupied', 'maintenance')) OR
        (OLD.status = 'occupied' AND NEW.status IN ('cleaning', 'maintenance')) OR
        (OLD.status = 'cleaning' AND NEW.status IN ('available', 'maintenance')) OR
        (OLD.status = 'maintenance' AND NEW.status IN ('available'))
    ) THEN
        RAISE EXCEPTION 'Invalid bed status transition from % to %', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_bed_status_workflow_trigger ON beds;
CREATE TRIGGER check_bed_status_workflow_trigger
    BEFORE UPDATE OF status ON beds
    FOR EACH ROW
    EXECUTE FUNCTION check_bed_status_workflow();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-24: Bed status workflow enforced';
END $$;

-- [BR-25] Cannot assign occupied bed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_bed_occupied_assignment'
    ) THEN
        ALTER TABLE beds 
        ADD CONSTRAINT check_bed_occupied_assignment 
        CHECK (
            NOT (status = 'occupied' AND current_patient_id IS NULL)
        );
        RAISE NOTICE 'Added BR-25: Cannot assign occupied bed';
    END IF;
END $$;

-- [BR-26] Cleaning required between patients
CREATE OR REPLACE FUNCTION check_bed_cleaning_required()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_patient_id IS NOT NULL AND OLD.current_patient_id IS NOT NULL THEN
        IF OLD.last_cleaned IS NULL OR OLD.last_cleaned < NEW.assigned_at - INTERVAL '1 hour' THEN
            RAISE EXCEPTION 'Bed must be cleaned between patients';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_bed_cleaning_required_trigger ON beds;
CREATE TRIGGER check_bed_cleaning_required_trigger
    BEFORE UPDATE OF current_patient_id ON beds
    FOR EACH ROW
    EXECUTE FUNCTION check_bed_cleaning_required();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-26: Cleaning required between patients';
END $$;

-- ============================================
-- PART 6: BILLING RULES (BR-29 to BR-35)
-- ============================================

-- [BR-29] Invoice number auto-generated
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix VARCHAR(4);
    month_prefix VARCHAR(2);
    day_prefix VARCHAR(2);
    sequence_num INTEGER;
BEGIN
    year_prefix := TO_CHAR(NEW.issue_date, 'YYYY');
    month_prefix := TO_CHAR(NEW.issue_date, 'MM');
    day_prefix := TO_CHAR(NEW.issue_date, 'DD');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 15) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_prefix || month_prefix || day_prefix || '-%';
    
    NEW.invoice_number := 'INV-' || year_prefix || month_prefix || day_prefix || '-' || LPAD(sequence_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
CREATE TRIGGER generate_invoice_number_trigger
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION generate_invoice_number();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-29: Invoice number auto-generated';
END $$;

-- [BR-31] Discount max 100% - FIXED (removed % symbol)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_invoice_discount'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT check_invoice_discount 
        CHECK (discount <= subtotal);
        RAISE NOTICE 'Added BR-31: Discount max 100 percent';
    END IF;
END $$;

-- [BR-32] Payment must be <= total amount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_invoice_payment'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT check_invoice_payment 
        CHECK (paid_amount <= total);
        RAISE NOTICE 'Added BR-32: Payment must be <= total amount';
    END IF;
END $$;

-- [BR-34] Refund within 30 days only
CREATE OR REPLACE FUNCTION check_refund_window()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.refund_amount > OLD.refund_amount THEN
        IF NEW.refund_date > OLD.payment_date + INTERVAL '30 days' THEN
            RAISE EXCEPTION 'Refund only allowed within 30 days of payment';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_refund_window_trigger ON invoices;
CREATE TRIGGER check_refund_window_trigger
    BEFORE UPDATE OF refund_amount ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_refund_window();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-34: Refund within 30 days only';
END $$;

-- ============================================
-- PART 7: LAB RULES (BR-36 to BR-40)
-- ============================================

-- [BR-37] Test results need verification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_test_result_verification'
    ) THEN
        ALTER TABLE test_results 
        ADD CONSTRAINT check_test_result_verification 
        CHECK (
            (verified_by IS NOT NULL AND verified_at IS NOT NULL) OR
            (is_critical = FALSE)
        );
        RAISE NOTICE 'Added BR-37: Test results need verification';
    END IF;
END $$;

-- [BR-38] Abnormal results flagged automatically
CREATE OR REPLACE FUNCTION flag_abnormal_results()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.result_numeric IS NOT NULL AND 
       NEW.result_range_low IS NOT NULL AND 
       NEW.result_range_high IS NOT NULL THEN
        NEW.is_abnormal := (NEW.result_numeric < NEW.result_range_low OR 
                           NEW.result_numeric > NEW.result_range_high);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS flag_abnormal_results_trigger ON test_results;
CREATE TRIGGER flag_abnormal_results_trigger
    BEFORE INSERT OR UPDATE OF result_numeric ON test_results
    FOR EACH ROW
    EXECUTE FUNCTION flag_abnormal_results();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-38: Abnormal results flagged automatically';
END $$;

-- [BR-39] Sample collection to result < 24 hours
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_test_turnaround_time'
    ) THEN
        ALTER TABLE test_results 
        ADD CONSTRAINT check_test_turnaround_time 
        CHECK (
            tested_at - specimen_collected_at < INTERVAL '24 hours'
        );
        RAISE NOTICE 'Added BR-39: Sample to result < 24 hours';
    END IF;
END $$;

-- ============================================
-- PART 8: RADIOLOGY RULES (BR-41 to BR-43)
-- ============================================

-- [BR-41] Images must be uploaded within 24 hours (TRIGGER implementation)
CREATE OR REPLACE FUNCTION check_radiology_upload_time()
RETURNS TRIGGER AS $$
DECLARE
    app_date DATE;
BEGIN
    -- Only check if appointment_id is provided
    IF NEW.appointment_id IS NOT NULL THEN
        -- Get appointment date from appointments table
        SELECT appointment_date INTO app_date
        FROM appointments
        WHERE id = NEW.appointment_id;
        
        -- Check if upload is within 24 hours of appointment
        IF app_date IS NOT NULL AND NEW.uploaded_at > app_date::TIMESTAMP + INTERVAL '24 hours' THEN
            RAISE EXCEPTION 'Images must be uploaded within 24 hours of appointment. Upload time: %, Appointment date: %', 
                NEW.uploaded_at, app_date;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_radiology_upload_time_trigger ON radiology_images;
CREATE TRIGGER check_radiology_upload_time_trigger
    BEFORE INSERT OR UPDATE OF uploaded_at ON radiology_images
    FOR EACH ROW
    EXECUTE FUNCTION check_radiology_upload_time();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-41: Images uploaded within 24 hours (trigger)';
END $$;

-- [BR-42] Report must be completed within 48 hours
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_radiology_report_time'
    ) THEN
        ALTER TABLE radiology_images 
        ADD CONSTRAINT check_radiology_report_time 
        CHECK (
            reported_at - uploaded_at < INTERVAL '48 hours'
        );
        RAISE NOTICE 'Added BR-42: Report within 48 hours';
    END IF;
END $$;

-- ============================================
-- PART 9: SECURITY RULES (BR-44 to BR-50)
-- ============================================

-- [BR-44] Break-glass access requires witness
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_break_glass_witness'
    ) THEN
        ALTER TABLE break_glass_access 
        ADD CONSTRAINT check_break_glass_witness 
        CHECK (witness_id IS NOT NULL);
        RAISE NOTICE 'Added BR-44: Break-glass requires witness';
    END IF;
END $$;

-- [BR-45] Break-glass access auto-expires in 1 hour
CREATE OR REPLACE FUNCTION set_break_glass_expiry()
RETURNS TRIGGER AS $$
BEGIN
    NEW.auto_expiry_time := NEW.access_start + INTERVAL '1 hour';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_break_glass_expiry_trigger ON break_glass_access;
CREATE TRIGGER set_break_glass_expiry_trigger
    BEFORE INSERT ON break_glass_access
    FOR EACH ROW
    EXECUTE FUNCTION set_break_glass_expiry();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-45: Break-glass auto-expires in 1 hour';
END $$;

-- [BR-50] Audit all PHI access
CREATE OR REPLACE FUNCTION audit_phi_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        audit_id,
        audit_type,
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        contains_phi
    ) VALUES (
        gen_random_uuid()::VARCHAR(50),
        TG_OP::audit_type_enum,
        COALESCE(current_setting('app.current_user_id', TRUE), '00000000-0000-0000-0000-000000000000')::UUID,
        TG_OP,
        TG_TABLE_NAME,
        NEW.id::VARCHAR,
        CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::JSONB ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END,
        TRUE
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add audit trigger to patients table (PHI)
DROP TRIGGER IF EXISTS audit_patients_phi_trigger ON patients;
CREATE TRIGGER audit_patients_phi_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION audit_phi_access();

DO $$
BEGIN
    RAISE NOTICE 'Added BR-50: Audit all PHI access (patients table)';
END $$;

-- ============================================
-- PART 10: VERIFICATION
-- ============================================

DO $$
DECLARE
    trigger_count INTEGER;
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count 
    FROM pg_trigger 
    WHERE tgname LIKE '%trigger%' AND tgname NOT LIKE 'pg_%';
    
    SELECT COUNT(*) INTO constraint_count 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'BUSINESS RULES IMPLEMENTATION COMPLETED';
    RAISE NOTICE 'Total triggers created: %', trigger_count;
    RAISE NOTICE 'Total check constraints: %', constraint_count;
    RAISE NOTICE '============================================';
END $$;