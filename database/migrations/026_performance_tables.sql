-- ============================================
-- FILE: database/migrations/026_performance_tables.sql
-- DESCRIPTION: Complete performance monitoring and optimization tables
-- SAFE MIGRATION: Can be run multiple times without errors
-- HARDWARE: Laptop (16GB RAM, 512GB SSD)
-- REQUIREMENTS COVERED: PR-01 to PR-19 (100% complete)
-- ============================================

-- ============================================
-- PART 1: RESPONSE TIME MONITORING TABLES (PR-01 to PR-06)
-- ============================================

-- [PR-01] Login performance logs
CREATE TABLE IF NOT EXISTS login_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    
    CONSTRAINT fk_login_performance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_performance_logs' AND column_name = 'auth_method') THEN
        ALTER TABLE login_performance_logs ADD COLUMN auth_method VARCHAR(50);
        RAISE NOTICE 'Added auth_method column to login_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_performance_logs' AND column_name = 'failure_reason') THEN
        ALTER TABLE login_performance_logs ADD COLUMN failure_reason VARCHAR(255);
        RAISE NOTICE 'Added failure_reason column to login_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_login_response_time') THEN
        ALTER TABLE login_performance_logs ADD CONSTRAINT check_login_response_time CHECK (response_time_ms >= 0);
        RAISE NOTICE 'Added check constraint to login_performance_logs';
    END IF;
END $$;

COMMENT ON TABLE login_performance_logs IS 'Login performance monitoring for PR-01 (Login < 2 seconds)';
COMMENT ON COLUMN login_performance_logs.response_time_ms IS 'Login response time in milliseconds';
COMMENT ON COLUMN login_performance_logs.auth_method IS 'password, otp, sso';
COMMENT ON COLUMN login_performance_logs.failure_reason IS 'Reason for login failure';

CREATE INDEX IF NOT EXISTS idx_login_performance_time ON login_performance_logs(login_time);
CREATE INDEX IF NOT EXISTS idx_login_performance_slow ON login_performance_logs(response_time_ms) WHERE response_time_ms > 2000;
CREATE INDEX IF NOT EXISTS idx_login_performance_user ON login_performance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_performance_ip ON login_performance_logs(ip_address);

-- Slow login alerts
CREATE TABLE IF NOT EXISTS slow_login_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login_performance_id UUID NOT NULL,
    threshold_ms INTEGER DEFAULT 2000,
    actual_ms INTEGER NOT NULL,
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    
    CONSTRAINT fk_slow_login_alerts_performance FOREIGN KEY (login_performance_id) REFERENCES login_performance_logs(id) ON DELETE CASCADE,
    CONSTRAINT fk_slow_login_alerts_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_slow_login_actual CHECK (actual_ms >= 0)
);

COMMENT ON TABLE slow_login_alerts IS 'Alerts for slow login responses (>2 seconds)';

CREATE INDEX IF NOT EXISTS idx_slow_login_alerts_time ON slow_login_alerts(alert_time);
CREATE INDEX IF NOT EXISTS idx_slow_login_alerts_ack ON slow_login_alerts(acknowledged) WHERE acknowledged = FALSE;

-- Failed attempts tracking
CREATE TABLE IF NOT EXISTS failed_attempts_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    username VARCHAR(100),
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attempt_count_window INTEGER DEFAULT 1,
    locked_until TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE failed_attempts_tracking IS 'Track failed login attempts for brute force detection';

CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON failed_attempts_tracking(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_blocked ON failed_attempts_tracking(is_blocked) WHERE is_blocked = TRUE;
CREATE INDEX IF NOT EXISTS idx_failed_attempts_locked ON failed_attempts_tracking(locked_until) WHERE locked_until IS NOT NULL;

-- [PR-02] Search performance logs
CREATE TABLE IF NOT EXISTS search_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_term TEXT,
    search_type VARCHAR(50), -- patient/doctor/appointment/medicine/inventory/billing
    result_count INTEGER,
    response_time_ms INTEGER NOT NULL,
    search_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    query_hash VARCHAR(64),
    
    CONSTRAINT fk_search_performance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_performance_logs' AND column_name = 'filters_used') THEN
        ALTER TABLE search_performance_logs ADD COLUMN filters_used JSONB;
        RAISE NOTICE 'Added filters_used column to search_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_performance_logs' AND column_name = 'sort_by') THEN
        ALTER TABLE search_performance_logs ADD COLUMN sort_by VARCHAR(50);
        RAISE NOTICE 'Added sort_by column to search_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_performance_logs' AND column_name = 'page_size') THEN
        ALTER TABLE search_performance_logs ADD COLUMN page_size INTEGER;
        RAISE NOTICE 'Added page_size column to search_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_performance_logs' AND column_name = 'page_number') THEN
        ALTER TABLE search_performance_logs ADD COLUMN page_number INTEGER;
        RAISE NOTICE 'Added page_number column to search_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_search_response') THEN
        ALTER TABLE search_performance_logs ADD CONSTRAINT check_search_response CHECK (response_time_ms >= 0);
        RAISE NOTICE 'Added check_search_response constraint';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_result_count') THEN
        ALTER TABLE search_performance_logs ADD CONSTRAINT check_result_count CHECK (result_count >= 0);
        RAISE NOTICE 'Added check_result_count constraint';
    END IF;
END $$;

COMMENT ON TABLE search_performance_logs IS 'Search performance monitoring for PR-02 (Search < 3 seconds)';
COMMENT ON COLUMN search_performance_logs.search_type IS 'patient, doctor, appointment, medicine, inventory, billing';
COMMENT ON COLUMN search_performance_logs.query_hash IS 'Hash of query for identifying frequent searches';

CREATE INDEX IF NOT EXISTS idx_search_performance_time ON search_performance_logs(search_time);
CREATE INDEX IF NOT EXISTS idx_search_performance_slow ON search_performance_logs(response_time_ms) WHERE response_time_ms > 3000;
CREATE INDEX IF NOT EXISTS idx_search_performance_type ON search_performance_logs(search_type);
CREATE INDEX IF NOT EXISTS idx_search_performance_hash ON search_performance_logs(query_hash);

-- Frequent searches tracking
CREATE TABLE IF NOT EXISTS frequent_searches_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    search_term TEXT NOT NULL,
    search_type VARCHAR(50),
    execution_count INTEGER DEFAULT 1,
    avg_response_time_ms DECIMAL(10,2),
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    last_executed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE frequent_searches_tracking IS 'Track frequently executed searches for optimization';

CREATE INDEX IF NOT EXISTS idx_frequent_searches_hash ON frequent_searches_tracking(query_hash);
CREATE INDEX IF NOT EXISTS idx_frequent_searches_count ON frequent_searches_tracking(execution_count) WHERE execution_count > 10;

-- Slow search alerts
CREATE TABLE IF NOT EXISTS slow_search_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_performance_id UUID NOT NULL,
    threshold_ms INTEGER DEFAULT 3000,
    actual_ms INTEGER NOT NULL,
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    
    CONSTRAINT fk_slow_search_alerts_performance FOREIGN KEY (search_performance_id) REFERENCES search_performance_logs(id) ON DELETE CASCADE,
    CONSTRAINT fk_slow_search_alerts_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE slow_search_alerts IS 'Alerts for slow search queries (>3 seconds)';

CREATE INDEX IF NOT EXISTS idx_slow_search_alerts_time ON slow_search_alerts(alert_time);
CREATE INDEX IF NOT EXISTS idx_slow_search_alerts_ack ON slow_search_alerts(acknowledged) WHERE acknowledged = FALSE;

-- [PR-03] Save performance logs
CREATE TABLE IF NOT EXISTS save_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20), -- INSERT/UPDATE/DELETE
    row_count INTEGER,
    duration_ms INTEGER NOT NULL,
    save_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    
    CONSTRAINT fk_save_performance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'save_performance_logs' AND column_name = 'record_id') THEN
        ALTER TABLE save_performance_logs ADD COLUMN record_id UUID;
        RAISE NOTICE 'Added record_id column to save_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'save_performance_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE save_performance_logs ADD COLUMN ip_address INET;
        RAISE NOTICE 'Added ip_address column to save_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'save_performance_logs' AND column_name = 'transaction_id') THEN
        ALTER TABLE save_performance_logs ADD COLUMN transaction_id UUID;
        RAISE NOTICE 'Added transaction_id column to save_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_save_duration') THEN
        ALTER TABLE save_performance_logs ADD CONSTRAINT check_save_duration CHECK (duration_ms >= 0);
        RAISE NOTICE 'Added check_save_duration constraint';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_operation') THEN
        ALTER TABLE save_performance_logs ADD CONSTRAINT check_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'));
        RAISE NOTICE 'Added check_operation constraint';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_row_count') THEN
        ALTER TABLE save_performance_logs ADD CONSTRAINT check_row_count CHECK (row_count >= 0);
        RAISE NOTICE 'Added check_row_count constraint';
    END IF;
END $$;

COMMENT ON TABLE save_performance_logs IS 'Save operation performance monitoring for PR-03 (Save < 2 seconds)';
COMMENT ON COLUMN save_performance_logs.operation IS 'INSERT, UPDATE, DELETE';
COMMENT ON COLUMN save_performance_logs.transaction_id IS 'For grouping related operations';

CREATE INDEX IF NOT EXISTS idx_save_performance_time ON save_performance_logs(save_time);
CREATE INDEX IF NOT EXISTS idx_save_performance_slow ON save_performance_logs(duration_ms) WHERE duration_ms > 2000;
CREATE INDEX IF NOT EXISTS idx_save_performance_table ON save_performance_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_save_performance_operation ON save_performance_logs(operation);

-- Slow save alerts
CREATE TABLE IF NOT EXISTS slow_save_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    save_performance_id UUID NOT NULL,
    threshold_ms INTEGER DEFAULT 2000,
    actual_ms INTEGER NOT NULL,
    table_name VARCHAR(100),
    operation VARCHAR(20),
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    
    CONSTRAINT fk_slow_save_alerts_performance FOREIGN KEY (save_performance_id) REFERENCES save_performance_logs(id) ON DELETE CASCADE,
    CONSTRAINT fk_slow_save_alerts_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE slow_save_alerts IS 'Alerts for slow save operations (>2 seconds)';

-- Transaction duration tracking
CREATE TABLE IF NOT EXISTS transaction_duration_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    tables_affected TEXT[],
    row_count_total INTEGER,
    is_committed BOOLEAN,
    is_rolled_back BOOLEAN,
    user_id UUID
);

COMMENT ON TABLE transaction_duration_tracking IS 'Track long-running transactions';

CREATE INDEX IF NOT EXISTS idx_transaction_duration_start ON transaction_duration_tracking(start_time);
CREATE INDEX IF NOT EXISTS idx_transaction_duration_long ON transaction_duration_tracking(duration_seconds) WHERE duration_seconds > 5;

-- [PR-04] Report generation logs
CREATE TABLE IF NOT EXISTS report_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(200) NOT NULL,
    parameters JSONB,
    row_count INTEGER,
    generation_time_ms INTEGER NOT NULL,
    cache_hit BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    
    CONSTRAINT fk_report_performance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_performance_logs' AND column_name = 'report_type') THEN
        ALTER TABLE report_performance_logs ADD COLUMN report_type VARCHAR(50);
        RAISE NOTICE 'Added report_type column to report_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_performance_logs' AND column_name = 'materialized_view_used') THEN
        ALTER TABLE report_performance_logs ADD COLUMN materialized_view_used BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added materialized_view_used column to report_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_generation_time') THEN
        ALTER TABLE report_performance_logs ADD CONSTRAINT check_generation_time CHECK (generation_time_ms >= 0);
        RAISE NOTICE 'Added check_generation_time constraint';
    END IF;
END $$;

COMMENT ON TABLE report_performance_logs IS 'Report generation performance monitoring for PR-04 (Report < 5 seconds)';
COMMENT ON COLUMN report_performance_logs.cache_hit IS 'Whether report was served from cache';
COMMENT ON COLUMN report_performance_logs.materialized_view_used IS 'Whether materialized view was used';

CREATE INDEX IF NOT EXISTS idx_report_performance_time ON report_performance_logs(generated_at);
CREATE INDEX IF NOT EXISTS idx_report_performance_slow ON report_performance_logs(generation_time_ms) WHERE generation_time_ms > 5000;
CREATE INDEX IF NOT EXISTS idx_report_performance_name ON report_performance_logs(report_name);

-- Cache hit ratio tracking
CREATE TABLE IF NOT EXISTS cache_hit_ratio_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) NOT NULL,
    cache_type VARCHAR(50), -- report/dashboard/query
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    hit_ratio DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN (hits+misses) > 0 THEN (hits::DECIMAL/(hits+misses)*100) ELSE 0 END) STORED,
    last_accessed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE cache_hit_ratio_tracking IS 'Track cache hit ratios for reports and queries';

CREATE INDEX IF NOT EXISTS idx_cache_hit_ratio_key ON cache_hit_ratio_tracking(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_hit_ratio_low ON cache_hit_ratio_tracking(hit_ratio) WHERE hit_ratio < 50;

-- Slow report alerts
CREATE TABLE IF NOT EXISTS slow_report_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_performance_id UUID NOT NULL,
    threshold_ms INTEGER DEFAULT 5000,
    actual_ms INTEGER NOT NULL,
    report_name VARCHAR(200),
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    
    CONSTRAINT fk_slow_report_alerts_performance FOREIGN KEY (report_performance_id) REFERENCES report_performance_logs(id) ON DELETE CASCADE,
    CONSTRAINT fk_slow_report_alerts_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE slow_report_alerts IS 'Alerts for slow report generation (>5 seconds)';

-- [PR-05] Dashboard load logs
CREATE TABLE IF NOT EXISTS dashboard_load_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role VARCHAR(50),
    widget_count INTEGER,
    load_time_ms INTEGER NOT NULL,
    cached_widgets INTEGER DEFAULT 0,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    
    CONSTRAINT fk_dashboard_load_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_load_logs' AND column_name = 'dashboard_type') THEN
        ALTER TABLE dashboard_load_logs ADD COLUMN dashboard_type VARCHAR(50);
        RAISE NOTICE 'Added dashboard_type column to dashboard_load_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_load_logs' AND column_name = 'uncached_widgets') THEN
        ALTER TABLE dashboard_load_logs ADD COLUMN uncached_widgets INTEGER DEFAULT 0;
        RAISE NOTICE 'Added uncached_widgets column to dashboard_load_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_load_logs' AND column_name = 'device_type') THEN
        ALTER TABLE dashboard_load_logs ADD COLUMN device_type VARCHAR(50);
        RAISE NOTICE 'Added device_type column to dashboard_load_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_load_logs' AND column_name = 'browser') THEN
        ALTER TABLE dashboard_load_logs ADD COLUMN browser VARCHAR(50);
        RAISE NOTICE 'Added browser column to dashboard_load_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_load_time') THEN
        ALTER TABLE dashboard_load_logs ADD CONSTRAINT check_load_time CHECK (load_time_ms >= 0);
        RAISE NOTICE 'Added check_load_time constraint';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_widget_counts') THEN
        ALTER TABLE dashboard_load_logs ADD CONSTRAINT check_widget_counts CHECK (widget_count = cached_widgets + COALESCE(uncached_widgets, 0));
        RAISE NOTICE 'Added check_widget_counts constraint';
    END IF;
END $$;

COMMENT ON TABLE dashboard_load_logs IS 'Dashboard load performance monitoring for PR-05 (Dashboard < 3 seconds)';
COMMENT ON COLUMN dashboard_load_logs.dashboard_type IS 'admin, doctor, nurse, reception, pharmacy, lab, patient';

CREATE INDEX IF NOT EXISTS idx_dashboard_load_time ON dashboard_load_logs(loaded_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_load_slow ON dashboard_load_logs(load_time_ms) WHERE load_time_ms > 3000;
CREATE INDEX IF NOT EXISTS idx_dashboard_load_type ON dashboard_load_logs(dashboard_type);

-- Widget usage statistics
CREATE TABLE IF NOT EXISTS widget_usage_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_type VARCHAR(50) NOT NULL,
    widget_name VARCHAR(100) NOT NULL,
    display_count INTEGER DEFAULT 0,
    avg_load_time_ms DECIMAL(10,2),
    last_displayed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE widget_usage_statistics IS 'Track which dashboard widgets are most used';

CREATE INDEX IF NOT EXISTS idx_widget_usage_dashboard ON widget_usage_statistics(dashboard_type);
CREATE INDEX IF NOT EXISTS idx_widget_usage_popular ON widget_usage_statistics(display_count) WHERE display_count > 100;

-- Slow dashboard alerts
CREATE TABLE IF NOT EXISTS slow_dashboard_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_load_id UUID NOT NULL,
    threshold_ms INTEGER DEFAULT 3000,
    actual_ms INTEGER NOT NULL,
    dashboard_type VARCHAR(50),
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    
    CONSTRAINT fk_slow_dashboard_alerts_load FOREIGN KEY (dashboard_load_id) REFERENCES dashboard_load_logs(id) ON DELETE CASCADE,
    CONSTRAINT fk_slow_dashboard_alerts_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE slow_dashboard_alerts IS 'Alerts for slow dashboard loading (>3 seconds)';

-- [PR-06] Image upload logs
CREATE TABLE IF NOT EXISTS image_upload_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_type VARCHAR(50), -- xray/mri/ct/ultrasound
    file_size_kb INTEGER,
    upload_time_ms INTEGER NOT NULL,
    processing_time_ms INTEGER,
    total_time_ms INTEGER GENERATED ALWAYS AS (upload_time_ms + COALESCE(processing_time_ms, 0)) STORED,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    patient_id UUID,
    
    CONSTRAINT fk_image_upload_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_image_upload_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_upload_logs' AND column_name = 'file_name') THEN
        ALTER TABLE image_upload_logs ADD COLUMN file_name VARCHAR(500);
        RAISE NOTICE 'Added file_name column to image_upload_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_upload_logs' AND column_name = 'original_width') THEN
        ALTER TABLE image_upload_logs ADD COLUMN original_width INTEGER;
        RAISE NOTICE 'Added original_width column to image_upload_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_upload_logs' AND column_name = 'original_height') THEN
        ALTER TABLE image_upload_logs ADD COLUMN original_height INTEGER;
        RAISE NOTICE 'Added original_height column to image_upload_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_upload_logs' AND column_name = 'thumbnail_generated') THEN
        ALTER TABLE image_upload_logs ADD COLUMN thumbnail_generated BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added thumbnail_generated column to image_upload_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_upload_logs' AND column_name = 'compression_ratio') THEN
        ALTER TABLE image_upload_logs ADD COLUMN compression_ratio DECIMAL(5,2);
        RAISE NOTICE 'Added compression_ratio column to image_upload_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_upload_logs' AND column_name = 'storage_location') THEN
        ALTER TABLE image_upload_logs ADD COLUMN storage_location VARCHAR(200);
        RAISE NOTICE 'Added storage_location column to image_upload_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_upload_time') THEN
        ALTER TABLE image_upload_logs ADD CONSTRAINT check_upload_time CHECK (upload_time_ms >= 0);
        RAISE NOTICE 'Added check_upload_time constraint';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_file_size') THEN
        ALTER TABLE image_upload_logs ADD CONSTRAINT check_file_size CHECK (file_size_kb >= 0);
        RAISE NOTICE 'Added check_file_size constraint';
    END IF;
END $$;

COMMENT ON TABLE image_upload_logs IS 'Image upload performance monitoring for PR-06 (Upload < 5 seconds)';
COMMENT ON COLUMN image_upload_logs.total_time_ms IS 'Upload + processing time';
COMMENT ON COLUMN image_upload_logs.compression_ratio IS 'Original size / compressed size';

CREATE INDEX IF NOT EXISTS idx_image_upload_time ON image_upload_logs(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_image_upload_slow ON image_upload_logs(total_time_ms) WHERE total_time_ms > 5000;
CREATE INDEX IF NOT EXISTS idx_image_upload_type ON image_upload_logs(image_type);

-- Processing queue status
CREATE TABLE IF NOT EXISTS processing_queue_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(50) NOT NULL, -- thumbnail/resize/optimize
    items_queued INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    avg_processing_time_ms DECIMAL(10,2),
    oldest_item_time TIMESTAMP,
    queue_status VARCHAR(20), -- healthy/backlogged/stalled
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE processing_queue_status IS 'Track background image processing queue';

-- Storage usage tracking
CREATE TABLE IF NOT EXISTS storage_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_type VARCHAR(50), -- original/thumbnail/optimized
    image_type VARCHAR(50),
    total_files INTEGER DEFAULT 0,
    total_size_mb DECIMAL(10,2),
    avg_size_kb DECIMAL(10,2),
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE storage_usage_tracking IS 'Track storage usage by image type';

-- Upload failure logs
CREATE TABLE IF NOT EXISTS upload_failure_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(500),
    file_size_kb INTEGER,
    image_type VARCHAR(50),
    failure_reason TEXT,
    failure_stage VARCHAR(50), -- upload/processing/thumbnail/storage
    error_message TEXT,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE upload_failure_logs IS 'Track failed uploads for analysis';

CREATE INDEX IF NOT EXISTS idx_upload_failures_resolved ON upload_failure_logs(resolved) WHERE resolved = FALSE;

-- ============================================
-- PART 2: CONCURRENCY MONITORING TABLES (PR-07 to PR-11)
-- ============================================

-- [PR-07] Concurrency metrics
CREATE TABLE IF NOT EXISTS concurrency_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active_users INTEGER,
    active_sessions INTEGER,
    db_connections INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_mb INTEGER,
    disk_io_percent DECIMAL(5,2),
    avg_response_time_ms DECIMAL(10,2),
    error_count INTEGER DEFAULT 0
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'concurrency_metrics' AND column_name = 'network_io_kbps') THEN
        ALTER TABLE concurrency_metrics ADD COLUMN network_io_kbps INTEGER;
        RAISE NOTICE 'Added network_io_kbps column to concurrency_metrics';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'concurrency_metrics' AND column_name = 'peak_concurrent') THEN
        ALTER TABLE concurrency_metrics ADD COLUMN peak_concurrent INTEGER;
        RAISE NOTICE 'Added peak_concurrent column to concurrency_metrics';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'concurrency_metrics' AND column_name = 'slow_query_count') THEN
        ALTER TABLE concurrency_metrics ADD COLUMN slow_query_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added slow_query_count column to concurrency_metrics';
    END IF;
END $$;

COMMENT ON TABLE concurrency_metrics IS 'Track system concurrency and resource usage for PR-07 (100 concurrent users)';

CREATE INDEX IF NOT EXISTS idx_concurrency_metrics_time ON concurrency_metrics(measured_at);

-- Connection pool metrics
CREATE TABLE IF NOT EXISTS connection_pool_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_name VARCHAR(50) NOT NULL,
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    waiting_connections INTEGER,
    max_connections INTEGER,
    connection_timeout_ms INTEGER,
    pool_utilization_percent DECIMAL(5,2) GENERATED ALWAYS AS ((active_connections::DECIMAL / NULLIF(max_connections, 0)) * 100) STORED,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE connection_pool_metrics IS 'Track database connection pool usage';

-- Lock conflict logs
CREATE TABLE IF NOT EXISTS lock_conflict_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lock_type VARCHAR(50), -- table/row/page
    lock_mode VARCHAR(50), -- exclusive/share/update
    relation_name VARCHAR(100),
    blocked_pid INTEGER,
    blocking_pid INTEGER,
    blocked_statement TEXT,
    blocking_statement TEXT,
    conflict_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    resolved BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE lock_conflict_logs IS 'Track database lock conflicts';

-- Deadlock tracking
CREATE TABLE IF NOT EXISTS deadlock_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deadlock_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processes_involved TEXT[],
    queries_involved TEXT[],
    deadlock_graph TEXT,
    frequency_count INTEGER DEFAULT 1,
    last_occurrence TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_action TEXT
);

COMMENT ON TABLE deadlock_tracking IS 'Track deadlock occurrences';

-- Connection pool config (existing)
CREATE TABLE IF NOT EXISTS connection_pool_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_name VARCHAR(100) UNIQUE NOT NULL,
    min_connections INTEGER DEFAULT 10,
    max_connections INTEGER DEFAULT 50,
    connection_timeout_ms INTEGER DEFAULT 30000,
    idle_timeout_ms INTEGER DEFAULT 600000,
    max_lifetime_ms INTEGER DEFAULT 1800000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE connection_pool_config IS 'Connection pool configuration settings';

-- Insert default config
INSERT INTO connection_pool_config (pool_name) VALUES ('default') ON CONFLICT DO NOTHING;

-- [PR-08] Appointment throughput
CREATE TABLE IF NOT EXISTS appointment_throughput (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_appointments INTEGER DEFAULT 0,
    peak_hour INTEGER,
    peak_appointments INTEGER,
    avg_duration_minutes DECIMAL(5,2),
    cancelled_count INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_throughput' AND column_name = 'scheduled_appointments') THEN
        ALTER TABLE appointment_throughput ADD COLUMN scheduled_appointments INTEGER DEFAULT 0;
        RAISE NOTICE 'Added scheduled_appointments column to appointment_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_throughput' AND column_name = 'by_department') THEN
        ALTER TABLE appointment_throughput ADD COLUMN by_department JSONB;
        RAISE NOTICE 'Added by_department column to appointment_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_throughput' AND column_name = 'by_doctor') THEN
        ALTER TABLE appointment_throughput ADD COLUMN by_doctor JSONB;
        RAISE NOTICE 'Added by_doctor column to appointment_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_throughput' AND column_name = 'created_at') THEN
        ALTER TABLE appointment_throughput ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added created_at column to appointment_throughput';
    END IF;
END $$;

COMMENT ON TABLE appointment_throughput IS 'Track appointment volume for PR-08 (1000 appointments/day)';

CREATE INDEX IF NOT EXISTS idx_appointment_throughput_date ON appointment_throughput(measure_date);

-- Daily appointment counts
CREATE TABLE IF NOT EXISTS daily_appointment_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_date DATE UNIQUE NOT NULL,
    total_count INTEGER NOT NULL,
    unique_patients INTEGER,
    new_patients INTEGER,
    followup_patients INTEGER,
    emergency_count INTEGER,
    walk_in_count INTEGER
);

COMMENT ON TABLE daily_appointment_counts IS 'Daily appointment counts for trend analysis';

-- Peak hour analysis
CREATE TABLE IF NOT EXISTS peak_hour_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    hour_of_day INTEGER NOT NULL,
    appointment_count INTEGER,
    doctor_availability INTEGER,
    avg_wait_time_minutes INTEGER,
    is_peak BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE peak_hour_analysis IS 'Analyze peak usage hours';

-- Cancellation trends
CREATE TABLE IF NOT EXISTS cancellation_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trend_date DATE NOT NULL,
    cancellation_count INTEGER,
    cancellation_rate DECIMAL(5,2),
    top_reasons JSONB,
    by_time_of_day JSONB,
    by_day_of_week JSONB
);

COMMENT ON TABLE cancellation_trends IS 'Track appointment cancellation patterns';

-- No-show tracking
CREATE TABLE IF NOT EXISTS no_show_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID,
    patient_id UUID,
    scheduled_date DATE,
    scheduled_time TIME,
    no_show_time TIMESTAMP,
    notified BOOLEAN DEFAULT FALSE,
    penalty_applied BOOLEAN DEFAULT FALSE,
    patient_history_count INTEGER
);

COMMENT ON TABLE no_show_tracking IS 'Track no-show appointments';

-- [PR-09] Prescription throughput
CREATE TABLE IF NOT EXISTS prescription_throughput (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_prescriptions INTEGER DEFAULT 0,
    avg_medicines_per_rx DECIMAL(3,2),
    peak_hour INTEGER,
    by_doctor JSONB
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescription_throughput' AND column_name = 'total_medicines') THEN
        ALTER TABLE prescription_throughput ADD COLUMN total_medicines INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_medicines column to prescription_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescription_throughput' AND column_name = 'electronic_prescriptions') THEN
        ALTER TABLE prescription_throughput ADD COLUMN electronic_prescriptions INTEGER DEFAULT 0;
        RAISE NOTICE 'Added electronic_prescriptions column to prescription_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescription_throughput' AND column_name = 'physical_prescriptions') THEN
        ALTER TABLE prescription_throughput ADD COLUMN physical_prescriptions INTEGER DEFAULT 0;
        RAISE NOTICE 'Added physical_prescriptions column to prescription_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescription_throughput' AND column_name = 'by_department') THEN
        ALTER TABLE prescription_throughput ADD COLUMN by_department JSONB;
        RAISE NOTICE 'Added by_department column to prescription_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescription_throughput' AND column_name = 'created_at') THEN
        ALTER TABLE prescription_throughput ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added created_at column to prescription_throughput';
    END IF;
END $$;

COMMENT ON TABLE prescription_throughput IS 'Track prescription volume for PR-09 (500 prescriptions/day)';

CREATE INDEX IF NOT EXISTS idx_prescription_throughput_date ON prescription_throughput(measure_date);

-- Daily prescription counts
CREATE TABLE IF NOT EXISTS daily_prescription_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_date DATE UNIQUE NOT NULL,
    total_count INTEGER NOT NULL,
    unique_doctors INTEGER,
    unique_patients INTEGER,
    refill_count INTEGER,
    new_rx_count INTEGER
);

COMMENT ON TABLE daily_prescription_counts IS 'Daily prescription counts';

-- Doctor prescription volume
CREATE TABLE IF NOT EXISTS doctor_prescription_volume (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL,
    measure_date DATE NOT NULL,
    prescription_count INTEGER,
    unique_patients INTEGER,
    avg_per_patient DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE doctor_prescription_volume IS 'Track prescription volume by doctor';

-- Medicine frequency stats
CREATE TABLE IF NOT EXISTS medicine_frequency_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID,
    medicine_name VARCHAR(200),
    prescription_count INTEGER,
    unique_doctors INTEGER,
    unique_patients INTEGER,
    avg_quantity DECIMAL(5,2),
    last_prescribed TIMESTAMP
);

COMMENT ON TABLE medicine_frequency_stats IS 'Track most prescribed medicines';

-- [PR-10] Invoice throughput
CREATE TABLE IF NOT EXISTS invoice_throughput (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_invoices INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    paid_count INTEGER DEFAULT 0,
    pending_count INTEGER DEFAULT 0,
    avg_amount DECIMAL(10,2),
    payment_methods JSONB
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_throughput' AND column_name = 'overdue_count') THEN
        ALTER TABLE invoice_throughput ADD COLUMN overdue_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added overdue_count column to invoice_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_throughput' AND column_name = 'peak_hour') THEN
        ALTER TABLE invoice_throughput ADD COLUMN peak_hour INTEGER;
        RAISE NOTICE 'Added peak_hour column to invoice_throughput';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_throughput' AND column_name = 'created_at') THEN
        ALTER TABLE invoice_throughput ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added created_at column to invoice_throughput';
    END IF;
END $$;

COMMENT ON TABLE invoice_throughput IS 'Track invoice volume for PR-10 (200 invoices/day)';

CREATE INDEX IF NOT EXISTS idx_invoice_throughput_date ON invoice_throughput(measure_date);

-- Daily invoice counts
CREATE TABLE IF NOT EXISTS daily_invoice_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_date DATE UNIQUE NOT NULL,
    total_count INTEGER NOT NULL,
    total_revenue DECIMAL(12,2),
    unique_patients INTEGER,
    insurance_claims INTEGER,
    cash_payments INTEGER,
    card_payments INTEGER,
    upi_payments INTEGER
);

COMMENT ON TABLE daily_invoice_counts IS 'Daily invoice counts';

-- Payment processing metrics
CREATE TABLE IF NOT EXISTS payment_processing_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    transaction_count INTEGER,
    total_amount DECIMAL(12,2),
    avg_processing_time_seconds DECIMAL(10,2),
    success_rate DECIMAL(5,2),
    failure_count INTEGER
);

COMMENT ON TABLE payment_processing_metrics IS 'Track payment processing performance';

-- Pending invoice alerts
CREATE TABLE IF NOT EXISTS pending_invoice_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID,
    patient_id UUID,
    due_date DATE,
    amount DECIMAL(10,2),
    days_overdue INTEGER,
    alert_type VARCHAR(20), -- pending/overdue/urgent
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE pending_invoice_alerts IS 'Alerts for pending/overdue invoices';

-- Revenue tracking
CREATE TABLE IF NOT EXISTS revenue_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_date DATE NOT NULL,
    period_type VARCHAR(20), -- daily/weekly/monthly
    total_revenue DECIMAL(12,2),
    consultation_revenue DECIMAL(12,2),
    procedure_revenue DECIMAL(12,2),
    pharmacy_revenue DECIMAL(12,2),
    lab_revenue DECIMAL(12,2),
    radiology_revenue DECIMAL(12,2),
    target_revenue DECIMAL(12,2),
    achievement_percent DECIMAL(5,2)
);

COMMENT ON TABLE revenue_tracking IS 'Track daily/weekly/monthly revenue';

-- [PR-11] API performance metrics
CREATE TABLE IF NOT EXISTS api_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    concurrent_calls INTEGER,
    response_time_ms DECIMAL(10,2),
    p95_response_ms DECIMAL(10,2),
    p99_response_ms DECIMAL(10,2),
    error_rate_percent DECIMAL(5,2),
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_performance_logs' AND column_name = 'total_calls') THEN
        ALTER TABLE api_performance_logs ADD COLUMN total_calls INTEGER;
        RAISE NOTICE 'Added total_calls column to api_performance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_performance_logs' AND column_name = 'error_count') THEN
        ALTER TABLE api_performance_logs ADD COLUMN error_count INTEGER;
        RAISE NOTICE 'Added error_count column to api_performance_logs';
    END IF;
END $$;

COMMENT ON TABLE api_performance_logs IS 'Track API endpoint performance for PR-11 (50 concurrent API calls)';

CREATE INDEX IF NOT EXISTS idx_api_performance_time ON api_performance_logs(measured_at);
CREATE INDEX IF NOT EXISTS idx_api_performance_endpoint ON api_performance_logs(endpoint, method);

-- API rate limits
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_pattern VARCHAR(255) NOT NULL,
    max_requests_per_minute INTEGER,
    max_concurrent INTEGER,
    burst_limit INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'http_method') THEN
        ALTER TABLE api_rate_limits ADD COLUMN http_method VARCHAR(10);
        RAISE NOTICE 'Added http_method column to api_rate_limits';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'max_requests_per_hour') THEN
        ALTER TABLE api_rate_limits ADD COLUMN max_requests_per_hour INTEGER;
        RAISE NOTICE 'Added max_requests_per_hour column to api_rate_limits';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'applies_to_roles') THEN
        ALTER TABLE api_rate_limits ADD COLUMN applies_to_roles UUID[];
        RAISE NOTICE 'Added applies_to_roles column to api_rate_limits';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'applies_to_users') THEN
        ALTER TABLE api_rate_limits ADD COLUMN applies_to_users UUID[];
        RAISE NOTICE 'Added applies_to_users column to api_rate_limits';
    END IF;
END $$;

COMMENT ON TABLE api_rate_limits IS 'Configure rate limits per endpoint';

-- Rate limit breaches
CREATE TABLE IF NOT EXISTS rate_limit_breaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    user_id UUID,
    ip_address INET,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    limit_exceeded VARCHAR(50), -- per_minute/per_hour/concurrent
    current_count INTEGER,
    limit_value INTEGER
);

COMMENT ON TABLE rate_limit_breaches IS 'Track rate limit violations';

-- Slow endpoint alerts
CREATE TABLE IF NOT EXISTS slow_endpoint_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    avg_response_time_ms DECIMAL(10,2),
    threshold_ms INTEGER,
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    resolved BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE slow_endpoint_alerts IS 'Alerts for slow API endpoints';

-- ============================================
-- PART 3: AVAILABILITY MONITORING TABLES (PR-12 to PR-15)
-- ============================================

-- [PR-12] Uptime logs
CREATE TABLE IF NOT EXISTS uptime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE UNIQUE NOT NULL,
    uptime_percent DECIMAL(5,2),
    downtime_seconds INTEGER DEFAULT 0,
    downtime_reason TEXT,
    affected_users INTEGER,
    resolution_time_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE uptime_logs IS 'Track system uptime for PR-12 (99.5% uptime target)';

CREATE INDEX IF NOT EXISTS idx_uptime_logs_date ON uptime_logs(log_date);

-- Downtime incident reports
CREATE TABLE IF NOT EXISTS downtime_incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_start TIMESTAMP NOT NULL,
    incident_end TIMESTAMP,
    duration_seconds INTEGER,
    severity VARCHAR(20), -- critical/high/medium/low
    cause TEXT,
    impact_description TEXT,
    systems_affected TEXT[],
    users_affected INTEGER,
    resolution_actions TEXT,
    preventive_measures TEXT,
    reported_by UUID,
    status VARCHAR(20) -- investigating/resolved/closed
);

COMMENT ON TABLE downtime_incident_reports IS 'Detailed downtime incident reports';

-- Health check history
CREATE TABLE IF NOT EXISTS health_check_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    component VARCHAR(50), -- database/cache/disk/api
    status VARCHAR(20), -- healthy/degraded/down
    response_time_ms INTEGER,
    error_message TEXT,
    consecutive_failures INTEGER DEFAULT 0
);

COMMENT ON TABLE health_check_history IS 'Track health check results';

-- Restart logs
CREATE TABLE IF NOT EXISTS restart_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restart_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    component VARCHAR(50), -- application/database/cache
    reason TEXT,
    initiated_by VARCHAR(50), -- system/admin
    user_id UUID,
    downtime_seconds INTEGER,
    success BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE restart_logs IS 'Track application/database restarts';

-- [PR-13] Maintenance windows
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_name VARCHAR(100) NOT NULL,
    day_of_week INTEGER DEFAULT 0, -- 0=Sunday
    start_time TIME DEFAULT '02:00:00',
    end_time TIME DEFAULT '04:00:00',
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE maintenance_windows IS 'Schedule maintenance windows for PR-13 (Sunday 2-4 AM)';

-- Insert default maintenance window
INSERT INTO maintenance_windows (window_name, day_of_week) 
VALUES ('weekly_maintenance', 0) ON CONFLICT DO NOTHING;

-- Maintenance schedule
CREATE TABLE IF NOT EXISTS maintenance_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id UUID,
    scheduled_date DATE NOT NULL,
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    status VARCHAR(20), -- scheduled/in-progress/completed/cancelled
    tasks_planned TEXT[],
    notified_users UUID[],
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_maintenance_schedule_window FOREIGN KEY (window_id) REFERENCES maintenance_windows(id) ON DELETE SET NULL
);

COMMENT ON TABLE maintenance_schedule IS 'Upcoming maintenance events';

-- Maintenance execution logs
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id UUID,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    tasks_completed TEXT[],
    tasks_failed TEXT[],
    errors TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_maintenance_logs_window FOREIGN KEY (window_id) REFERENCES maintenance_windows(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_logs' AND column_name = 'schedule_id') THEN
        ALTER TABLE maintenance_logs ADD COLUMN schedule_id UUID;
        RAISE NOTICE 'Added schedule_id column to maintenance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_logs' AND column_name = 'actual_start') THEN
        ALTER TABLE maintenance_logs ADD COLUMN actual_start TIMESTAMP;
        RAISE NOTICE 'Added actual_start column to maintenance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_logs' AND column_name = 'actual_end') THEN
        ALTER TABLE maintenance_logs ADD COLUMN actual_end TIMESTAMP;
        RAISE NOTICE 'Added actual_end column to maintenance_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_logs' AND column_name = 'duration_minutes') THEN
        ALTER TABLE maintenance_logs ADD COLUMN duration_minutes INTEGER;
        RAISE NOTICE 'Added duration_minutes column to maintenance_logs';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_start ON maintenance_logs(start_time);

-- Post-maintenance validation
CREATE TABLE IF NOT EXISTS post_maintenance_validation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id UUID,
    validation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    component VARCHAR(50),
    status VARCHAR(20), -- passed/failed/warning
    check_details TEXT,
    validated_by UUID,
    
    CONSTRAINT fk_post_maintenance_validation_maintenance FOREIGN KEY (maintenance_id) REFERENCES maintenance_logs(id) ON DELETE SET NULL
);

COMMENT ON TABLE post_maintenance_validation IS 'Validate system after maintenance';

-- Rollback execution logs
CREATE TABLE IF NOT EXISTS rollback_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id UUID,
    rollback_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    steps_taken TEXT[],
    success BOOLEAN,
    data_loss BOOLEAN DEFAULT FALSE,
    performed_by UUID,
    
    CONSTRAINT fk_rollback_logs_maintenance FOREIGN KEY (maintenance_id) REFERENCES maintenance_logs(id) ON DELETE SET NULL
);

COMMENT ON TABLE rollback_execution_logs IS 'Track rollback operations';

-- [PR-14] Recovery logs
CREATE TABLE IF NOT EXISTS recovery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_date TIMESTAMP NOT NULL,
    incident_type VARCHAR(100),
    recovery_time_minutes INTEGER,
    data_loss_seconds INTEGER,
    root_cause TEXT,
    action_taken TEXT,
    preventive_measures TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recovery_logs' AND column_name = 'recovery_start') THEN
        ALTER TABLE recovery_logs ADD COLUMN recovery_start TIMESTAMP;
        RAISE NOTICE 'Added recovery_start column to recovery_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recovery_logs' AND column_name = 'recovery_end') THEN
        ALTER TABLE recovery_logs ADD COLUMN recovery_end TIMESTAMP;
        RAISE NOTICE 'Added recovery_end column to recovery_logs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recovery_logs' AND column_name = 'recovery_method') THEN
        ALTER TABLE recovery_logs ADD COLUMN recovery_method VARCHAR(50);
        RAISE NOTICE 'Added recovery_method column to recovery_logs';
    END IF;
END $$;

COMMENT ON TABLE recovery_logs IS 'Track recovery operations for PR-14 (Recovery time < 2 hours)';

CREATE INDEX IF NOT EXISTS idx_recovery_logs_date ON recovery_logs(incident_date);

-- Recovery drill logs
CREATE TABLE IF NOT EXISTS recovery_drill_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drill_date DATE NOT NULL,
    drill_type VARCHAR(50), -- full/partial/wal
    target_rto_minutes INTEGER,
    actual_rto_minutes INTEGER,
    target_rpo_seconds INTEGER,
    actual_rpo_seconds INTEGER,
    success BOOLEAN,
    issues_encountered TEXT,
    improvements_needed TEXT,
    conducted_by UUID
);

COMMENT ON TABLE recovery_drill_logs IS 'Track recovery drill exercises';

-- Restore time metrics
CREATE TABLE IF NOT EXISTS restore_time_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_date DATE,
    backup_size_gb DECIMAL(10,2),
    restore_start TIMESTAMP,
    restore_end TIMESTAMP,
    restore_time_minutes INTEGER,
    verification_time_minutes INTEGER,
    total_time_minutes INTEGER,
    success BOOLEAN
);

COMMENT ON TABLE restore_time_metrics IS 'Track database restore times';

-- Recovery verification
CREATE TABLE IF NOT EXISTS recovery_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_id UUID,
    verification_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_integrity_check BOOLEAN,
    row_count_match BOOLEAN,
    checksum_match BOOLEAN,
    application_compatible BOOLEAN,
    verified_by UUID,
    notes TEXT,
    
    CONSTRAINT fk_recovery_verification_recovery FOREIGN KEY (recovery_id) REFERENCES recovery_logs(id) ON DELETE SET NULL
);

COMMENT ON TABLE recovery_verification IS 'Verify recovery success';

-- Drill schedule
CREATE TABLE IF NOT EXISTS drill_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drill_date DATE NOT NULL,
    drill_type VARCHAR(50),
    description TEXT,
    status VARCHAR(20), -- scheduled/completed/cancelled
    assigned_to UUID[],
    completed_date TIMESTAMP,
    results_summary TEXT
);

COMMENT ON TABLE drill_schedule IS 'Schedule recovery drills';

-- [PR-15] RPO monitoring
CREATE TABLE IF NOT EXISTS rpo_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_full_backup TIMESTAMP,
    last_wal_backup TIMESTAMP,
    wal_files_since_last INTEGER,
    estimated_data_loss_seconds INTEGER,
    rpo_compliant BOOLEAN GENERATED ALWAYS AS (
        estimated_data_loss_seconds <= 900
    ) STORED
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rpo_metrics' AND column_name = 'wal_size_mb') THEN
        ALTER TABLE rpo_metrics ADD COLUMN wal_size_mb INTEGER;
        RAISE NOTICE 'Added wal_size_mb column to rpo_metrics';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rpo_metrics' AND column_name = 'checked_by') THEN
        ALTER TABLE rpo_metrics ADD COLUMN checked_by UUID;
        RAISE NOTICE 'Added checked_by column to rpo_metrics';
    END IF;
END $$;

COMMENT ON TABLE rpo_metrics IS 'Track Recovery Point Objective compliance for PR-15 (RPO < 15 minutes)';

CREATE INDEX IF NOT EXISTS idx_rpo_metrics_time ON rpo_metrics(check_time);
CREATE INDEX IF NOT EXISTS idx_rpo_metrics_compliant ON rpo_metrics(rpo_compliant);

-- Backup history logs
CREATE TABLE IF NOT EXISTS backup_history_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(50), -- full/incremental/differential/wal
    backup_start TIMESTAMP,
    backup_end TIMESTAMP,
    duration_seconds INTEGER,
    size_gb DECIMAL(10,2),
    status VARCHAR(20), -- success/failed/in-progress
    location VARCHAR(500),
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    error_message TEXT
);

COMMENT ON TABLE backup_history_logs IS 'Track backup history';

-- WAL archive status
CREATE TABLE IF NOT EXISTS wal_archive_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_wal VARCHAR(50),
    last_archived VARCHAR(50),
    archive_lag_bytes BIGINT,
    archive_lag_seconds INTEGER,
    archive_rate_kbps INTEGER,
    disk_usage_gb DECIMAL(10,2),
    status VARCHAR(20), -- healthy/warning/critical
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE wal_archive_status IS 'Track WAL archiving status';

-- Backup verification logs
CREATE TABLE IF NOT EXISTS backup_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID,
    verification_start TIMESTAMP,
    verification_end TIMESTAMP,
    verification_duration_seconds INTEGER,
    integrity_check BOOLEAN,
    restore_test BOOLEAN,
    checksum_match BOOLEAN,
    verified_by UUID,
    notes TEXT
);

COMMENT ON TABLE backup_verification_logs IS 'Track backup verification results';

-- ============================================
-- PART 4: CAPACITY PLANNING TABLES (PR-16 to PR-19)
-- ============================================

-- [PR-16] Patient capacity tracking
CREATE TABLE IF NOT EXISTS patient_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_patients INTEGER,
    active_patients INTEGER,
    new_patients_month INTEGER,
    avg_record_size_kb DECIMAL(10,2),
    total_size_mb DECIMAL(10,2),
    estimated_growth_rate DECIMAL(5,2),
    projected_6months INTEGER,
    projected_1year INTEGER
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_capacity' AND column_name = 'inactive_patients') THEN
        ALTER TABLE patient_capacity ADD COLUMN inactive_patients INTEGER;
        RAISE NOTICE 'Added inactive_patients column to patient_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_capacity' AND column_name = 'new_patients_year') THEN
        ALTER TABLE patient_capacity ADD COLUMN new_patients_year INTEGER;
        RAISE NOTICE 'Added new_patients_year column to patient_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_capacity' AND column_name = 'index_size_mb') THEN
        ALTER TABLE patient_capacity ADD COLUMN index_size_mb DECIMAL(10,2);
        RAISE NOTICE 'Added index_size_mb column to patient_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_capacity' AND column_name = 'projected_3years') THEN
        ALTER TABLE patient_capacity ADD COLUMN projected_3years INTEGER;
        RAISE NOTICE 'Added projected_3years column to patient_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_capacity' AND column_name = 'capacity_warning') THEN
        ALTER TABLE patient_capacity ADD COLUMN capacity_warning BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added capacity_warning column to patient_capacity';
    END IF;
END $$;

COMMENT ON TABLE patient_capacity IS 'Track patient records growth for PR-16 (50,000 patient records)';

CREATE INDEX IF NOT EXISTS idx_patient_capacity_date ON patient_capacity(measure_date);

-- Patient growth rate
CREATE TABLE IF NOT EXISTS patient_growth_rate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    growth_month DATE NOT NULL,
    new_patients INTEGER,
    growth_rate_percent DECIMAL(5,2),
    seasonal_factor DECIMAL(5,2),
    projected_next_month INTEGER
);

COMMENT ON TABLE patient_growth_rate IS 'Track patient growth trends';

-- Storage usage by patient
CREATE TABLE IF NOT EXISTS storage_usage_by_patient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    total_records INTEGER,
    total_size_kb INTEGER,
    clinical_records_size INTEGER,
    billing_records_size INTEGER,
    image_count INTEGER,
    image_size_kb INTEGER,
    last_updated TIMESTAMP
);

COMMENT ON TABLE storage_usage_by_patient IS 'Analyze storage per patient';

-- Capacity forecast
CREATE TABLE IF NOT EXISTS capacity_forecast (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_date DATE NOT NULL,
    forecast_type VARCHAR(50), -- patients/appointments/images/db
    current_value INTEGER,
    forecast_3months INTEGER,
    forecast_6months INTEGER,
    forecast_1year INTEGER,
    forecast_3years INTEGER,
    confidence_level DECIMAL(5,2),
    assumptions TEXT
);

COMMENT ON TABLE capacity_forecast IS 'Future capacity projections';

-- [PR-17] Appointment capacity tracking
CREATE TABLE IF NOT EXISTS appointment_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_year INTEGER NOT NULL,
    measure_month INTEGER NOT NULL,
    total_appointments INTEGER,
    monthly_avg INTEGER,
    peak_day INTEGER,
    peak_day_count INTEGER,
    avg_record_size_kb DECIMAL(10,2),
    total_size_mb DECIMAL(10,2),
    UNIQUE(measure_year, measure_month)
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_capacity' AND column_name = 'scheduled_appointments') THEN
        ALTER TABLE appointment_capacity ADD COLUMN scheduled_appointments INTEGER;
        RAISE NOTICE 'Added scheduled_appointments column to appointment_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_capacity' AND column_name = 'completed_appointments') THEN
        ALTER TABLE appointment_capacity ADD COLUMN completed_appointments INTEGER;
        RAISE NOTICE 'Added completed_appointments column to appointment_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_capacity' AND column_name = 'cancelled_appointments') THEN
        ALTER TABLE appointment_capacity ADD COLUMN cancelled_appointments INTEGER;
        RAISE NOTICE 'Added cancelled_appointments column to appointment_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_capacity' AND column_name = 'no_show_appointments') THEN
        ALTER TABLE appointment_capacity ADD COLUMN no_show_appointments INTEGER;
        RAISE NOTICE 'Added no_show_appointments column to appointment_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_capacity' AND column_name = 'index_size_mb') THEN
        ALTER TABLE appointment_capacity ADD COLUMN index_size_mb DECIMAL(10,2);
        RAISE NOTICE 'Added index_size_mb column to appointment_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_capacity' AND column_name = 'archive_recommended') THEN
        ALTER TABLE appointment_capacity ADD COLUMN archive_recommended BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added archive_recommended column to appointment_capacity';
    END IF;
END $$;

COMMENT ON TABLE appointment_capacity IS 'Track appointment records growth for PR-17 (100,000 appointments/year)';

CREATE INDEX IF NOT EXISTS idx_appointment_capacity_year ON appointment_capacity(measure_year);

-- Appointment size metrics
CREATE TABLE IF NOT EXISTS appointment_size_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID,
    record_size_kb INTEGER,
    clinical_notes_size INTEGER,
    prescription_count INTEGER,
    lab_order_count INTEGER,
    radiology_count INTEGER,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE appointment_size_metrics IS 'Track appointment record sizes';

-- Archive recommendations
CREATE TABLE IF NOT EXISTS archive_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    partition_key VARCHAR(50),
    oldest_date DATE,
    rows_archivable INTEGER,
    size_archivable_mb DECIMAL(10,2),
    archive_suggestion TEXT,
    priority INTEGER, -- 1-5 (5 highest)
    implemented BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE archive_recommendations IS 'Recommendations for data archival';

-- Partition usage stats
CREATE TABLE IF NOT EXISTS partition_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100),
    partition_name VARCHAR(100),
    partition_range TEXT,
    row_count INTEGER,
    size_mb DECIMAL(10,2),
    created_date DATE,
    is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE partition_usage_stats IS 'Track partition usage';

-- [PR-18] Image capacity tracking
CREATE TABLE IF NOT EXISTS image_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_images INTEGER,
    total_size_gb DECIMAL(10,2),
    avg_size_mb DECIMAL(10,2),
    by_type JSONB, -- {xray: count, mri: count, ...}
    monthly_growth INTEGER,
    projected_6months_gb DECIMAL(10,2),
    projected_1year_gb DECIMAL(10,2),
    storage_remaining_gb DECIMAL(10,2)
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_capacity' AND column_name = 'by_storage_class') THEN
        ALTER TABLE image_capacity ADD COLUMN by_storage_class JSONB;
        RAISE NOTICE 'Added by_storage_class column to image_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_capacity' AND column_name = 'projected_3years_gb') THEN
        ALTER TABLE image_capacity ADD COLUMN projected_3years_gb DECIMAL(10,2);
        RAISE NOTICE 'Added projected_3years_gb column to image_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_capacity' AND column_name = 'capacity_warning') THEN
        ALTER TABLE image_capacity ADD COLUMN capacity_warning BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added capacity_warning column to image_capacity';
    END IF;
END $$;

COMMENT ON TABLE image_capacity IS 'Track image storage growth for PR-18 (10,000 images)';

CREATE INDEX IF NOT EXISTS idx_image_capacity_date ON image_capacity(measure_date);

-- Storage by image type
CREATE TABLE IF NOT EXISTS storage_by_image_type (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_type VARCHAR(50) NOT NULL,
    count INTEGER,
    total_size_gb DECIMAL(10,2),
    avg_size_mb DECIMAL(10,2),
    min_size_kb INTEGER,
    max_size_mb INTEGER,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE storage_by_image_type IS 'Storage breakdown by image type';

-- Compression effectiveness
CREATE TABLE IF NOT EXISTS compression_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_type VARCHAR(50),
    original_size_kb INTEGER,
    compressed_size_kb INTEGER,
    compression_ratio DECIMAL(5,2),
    quality_setting INTEGER,
    processing_time_ms INTEGER,
    compression_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE compression_effectiveness IS 'Track compression ratios';

-- [PR-19] Database capacity tracking
CREATE TABLE IF NOT EXISTS db_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_size_gb DECIMAL(10,2),
    data_size_gb DECIMAL(10,2),
    index_size_gb DECIMAL(10,2),
    wal_size_gb DECIMAL(10,2),
    temp_size_gb DECIMAL(10,2),
    largest_table VARCHAR(100),
    largest_table_size_gb DECIMAL(10,2),
    growth_rate_mb_per_day DECIMAL(10,2),
    days_until_100gb INTEGER
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'db_capacity' AND column_name = 'largest_index') THEN
        ALTER TABLE db_capacity ADD COLUMN largest_index VARCHAR(100);
        RAISE NOTICE 'Added largest_index column to db_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'db_capacity' AND column_name = 'largest_index_size_gb') THEN
        ALTER TABLE db_capacity ADD COLUMN largest_index_size_gb DECIMAL(10,2);
        RAISE NOTICE 'Added largest_index_size_gb column to db_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'db_capacity' AND column_name = 'days_until_50gb') THEN
        ALTER TABLE db_capacity ADD COLUMN days_until_50gb INTEGER;
        RAISE NOTICE 'Added days_until_50gb column to db_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'db_capacity' AND column_name = 'days_until_80gb') THEN
        ALTER TABLE db_capacity ADD COLUMN days_until_80gb INTEGER;
        RAISE NOTICE 'Added days_until_80gb column to db_capacity';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'db_capacity' AND column_name = 'capacity_warning') THEN
        ALTER TABLE db_capacity ADD COLUMN capacity_warning BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added capacity_warning column to db_capacity';
    END IF;
END $$;

COMMENT ON TABLE db_capacity IS 'Track overall database growth for PR-19 (Database up to 100GB)';

CREATE INDEX IF NOT EXISTS idx_db_capacity_date ON db_capacity(measure_date);

-- Table size tracking
CREATE TABLE IF NOT EXISTS table_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    row_count INTEGER,
    table_size_mb DECIMAL(10,2),
    index_size_mb DECIMAL(10,2),
    total_size_mb DECIMAL(10,2) GENERATED ALWAYS AS (table_size_mb + index_size_mb) STORED,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_table_measurement UNIQUE (table_name, measured_at)
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'table_sizes' AND column_name = 'schema_name') THEN
        ALTER TABLE table_sizes ADD COLUMN schema_name VARCHAR(50) DEFAULT 'public';
        RAISE NOTICE 'Added schema_name column to table_sizes';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'table_sizes' AND column_name = 'bloat_estimate_mb') THEN
        ALTER TABLE table_sizes ADD COLUMN bloat_estimate_mb DECIMAL(10,2);
        RAISE NOTICE 'Added bloat_estimate_mb column to table_sizes';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'table_sizes' AND column_name = 'last_vacuum') THEN
        ALTER TABLE table_sizes ADD COLUMN last_vacuum TIMESTAMP;
        RAISE NOTICE 'Added last_vacuum column to table_sizes';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'table_sizes' AND column_name = 'last_analyze') THEN
        ALTER TABLE table_sizes ADD COLUMN last_analyze TIMESTAMP;
        RAISE NOTICE 'Added last_analyze column to table_sizes';
    END IF;
END $$;

COMMENT ON TABLE table_sizes IS 'Track individual table sizes';

CREATE INDEX IF NOT EXISTS idx_table_sizes_name ON table_sizes(table_name);
CREATE INDEX IF NOT EXISTS idx_table_sizes_time ON table_sizes(measured_at);
CREATE INDEX IF NOT EXISTS idx_table_sizes_largest ON table_sizes(total_size_mb DESC) WHERE total_size_mb > 100;

-- Index usage statistics
CREATE TABLE IF NOT EXISTS index_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100),
    index_name VARCHAR(200),
    index_size_mb DECIMAL(10,2),
    scans_count INTEGER,
    tuples_read INTEGER,
    tuples_fetched INTEGER,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'index_usage_stats' AND column_name = 'is_unique') THEN
        ALTER TABLE index_usage_stats ADD COLUMN is_unique BOOLEAN;
        RAISE NOTICE 'Added is_unique column to index_usage_stats';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'index_usage_stats' AND column_name = 'is_primary') THEN
        ALTER TABLE index_usage_stats ADD COLUMN is_primary BOOLEAN;
        RAISE NOTICE 'Added is_primary column to index_usage_stats';
    END IF;
END $$;

COMMENT ON TABLE index_usage_stats IS 'Index usage statistics for optimization';

CREATE INDEX IF NOT EXISTS idx_index_usage_table ON index_usage_stats(table_name);
CREATE INDEX IF NOT EXISTS idx_index_usage_last ON index_usage_stats(last_used) WHERE last_used IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_index_usage_unused ON index_usage_stats(last_used) WHERE last_used IS NULL;

-- Growth rate analysis
CREATE TABLE IF NOT EXISTS growth_rate_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100),
    week_start DATE,
    week_end DATE,
    rows_added INTEGER,
    size_increase_mb DECIMAL(10,2),
    growth_rate_percent DECIMAL(5,2),
    projected_1year_mb DECIMAL(10,2)
);

COMMENT ON TABLE growth_rate_analysis IS 'Analyze growth patterns';

-- Size forecast alerts
CREATE TABLE IF NOT EXISTS size_forecast_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component VARCHAR(50), -- database/table/index
    component_name VARCHAR(100),
    current_size_gb DECIMAL(10,2),
    threshold_gb DECIMAL(10,2),
    threshold_type VARCHAR(20), -- warning/critical
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_action TEXT
);

COMMENT ON TABLE size_forecast_alerts IS 'Alerts for capacity thresholds';

-- ============================================
-- PART 5: PERFORMANCE ALERTS & RECOMMENDATIONS
-- ============================================

-- Performance alerts
CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50), -- response_time/concurrency/availability/capacity
    metric_name VARCHAR(100),
    threshold_value DECIMAL(10,2),
    actual_value DECIMAL(10,2),
    severity VARCHAR(20), -- warning/critical
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_performance_alerts_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_alerts' AND column_name = 'component') THEN
        ALTER TABLE performance_alerts ADD COLUMN component VARCHAR(100);
        RAISE NOTICE 'Added component column to performance_alerts';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_alerts' AND column_name = 'resolution_notes') THEN
        ALTER TABLE performance_alerts ADD COLUMN resolution_notes TEXT;
        RAISE NOTICE 'Added resolution_notes column to performance_alerts';
    END IF;
END $$;

COMMENT ON TABLE performance_alerts IS 'Central performance alerts table';

CREATE INDEX IF NOT EXISTS idx_performance_alerts_type ON performance_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_created ON performance_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_performance_alerts_component ON performance_alerts(component);

-- Performance recommendations
CREATE TABLE IF NOT EXISTS performance_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_type VARCHAR(50), -- index/query/config/maintenance
    table_name VARCHAR(100),
    current_value TEXT,
    recommended_value TEXT,
    sql_command TEXT,
    estimated_improvement VARCHAR(100),
    priority INTEGER CHECK (priority BETWEEN 1 AND 5),
    implemented BOOLEAN DEFAULT FALSE,
    implemented_at TIMESTAMP,
    impact_measured VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_recommendations' AND column_name = 'updated_at') THEN
        ALTER TABLE performance_recommendations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to performance_recommendations';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_recommendations' AND column_name = 'recommendation_type' AND data_type = 'character varying' AND character_maximum_length = 50) THEN
        -- Column exists, check if we need to modify it
        RAISE NOTICE 'recommendation_type column already exists';
    END IF;
END $$;

COMMENT ON TABLE performance_recommendations IS 'Automated performance optimization recommendations';

CREATE INDEX IF NOT EXISTS idx_performance_recommendations_type ON performance_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_performance_recommendations_priority ON performance_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_performance_recommendations_implemented ON performance_recommendations(implemented);

-- Slow query log
CREATE TABLE IF NOT EXISTS slow_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64),
    query_text TEXT,
    database VARCHAR(100),
    duration_ms INTEGER NOT NULL,
    rows_returned INTEGER,
    rows_examined INTEGER,
    query_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    application_name VARCHAR(200),
    
    CONSTRAINT fk_slow_queries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add new columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slow_queries' AND column_name = 'calls_count') THEN
        ALTER TABLE slow_queries ADD COLUMN calls_count INTEGER DEFAULT 1;
        RAISE NOTICE 'Added calls_count column to slow_queries';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slow_queries' AND column_name = 'total_duration_ms') THEN
        ALTER TABLE slow_queries ADD COLUMN total_duration_ms INTEGER;
        RAISE NOTICE 'Added total_duration_ms column to slow_queries';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slow_queries' AND column_name = 'avg_duration_ms') THEN
        ALTER TABLE slow_queries ADD COLUMN avg_duration_ms DECIMAL(10,2);
        RAISE NOTICE 'Added avg_duration_ms column to slow_queries';
    END IF;
END $$;

COMMENT ON TABLE slow_queries IS 'Log of slow performing queries';

CREATE INDEX IF NOT EXISTS idx_slow_queries_hash ON slow_queries(query_hash);
CREATE INDEX IF NOT EXISTS idx_slow_queries_time ON slow_queries(query_time);
CREATE INDEX IF NOT EXISTS idx_slow_queries_duration ON slow_queries(duration_ms) WHERE duration_ms > 1000;
CREATE INDEX IF NOT EXISTS idx_slow_queries_avg_duration ON slow_queries(avg_duration_ms) WHERE avg_duration_ms > 1000;

-- Index usage statistics (duplicate check - already created above)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'index_usage_stats') THEN
        -- Table already created above, but just in case
        RAISE NOTICE 'index_usage_stats table already exists';
    END IF;
END $$;

-- Resource utilization
CREATE TABLE IF NOT EXISTS resource_utilization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cpu_percent DECIMAL(5,2),
    memory_percent DECIMAL(5,2),
    memory_used_mb INTEGER,
    disk_percent DECIMAL(5,2),
    disk_used_gb DECIMAL(10,2),
    disk_free_gb DECIMAL(10,2),
    network_in_mbps INTEGER,
    network_out_mbps INTEGER,
    process_count INTEGER
);

COMMENT ON TABLE resource_utilization IS 'Track system resource usage';

CREATE INDEX IF NOT EXISTS idx_resource_utilization_time ON resource_utilization(measured_at);

-- Peak usage patterns
CREATE TABLE IF NOT EXISTS peak_usage_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_date DATE,
    hour_of_day INTEGER,
    day_of_week INTEGER,
    concurrent_users INTEGER,
    api_calls INTEGER,
    db_connections INTEGER,
    cpu_peak_percent DECIMAL(5,2),
    memory_peak_mb INTEGER,
    is_peak BOOLEAN
);

COMMENT ON TABLE peak_usage_patterns IS 'Identify peak usage times';

CREATE INDEX IF NOT EXISTS idx_peak_patterns_hour ON peak_usage_patterns(hour_of_day);

-- ============================================
-- PART 6: CACHE TABLES (for dashboard performance)
-- ============================================

-- Admin dashboard cache
CREATE TABLE IF NOT EXISTS admin_dashboard_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    cache_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    refresh_interval_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE admin_dashboard_cache IS 'Cached data for admin dashboard';

-- Doctor dashboard cache
CREATE TABLE IF NOT EXISTS doctor_dashboard_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID UNIQUE,
    cache_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    refresh_interval_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE doctor_dashboard_cache IS 'Cached data for doctor dashboard';

-- Nurse dashboard cache
CREATE TABLE IF NOT EXISTS nurse_dashboard_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID UNIQUE,
    ward VARCHAR(100),
    cache_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE nurse_dashboard_cache IS 'Cached data for nurse dashboard';

-- Reception dashboard cache
CREATE TABLE IF NOT EXISTS reception_dashboard_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receptionist_id UUID UNIQUE,
    cache_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE reception_dashboard_cache IS 'Cached data for reception dashboard';

-- Patient portal cache
CREATE TABLE IF NOT EXISTS patient_portal_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID UNIQUE,
    cache_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE patient_portal_cache IS 'Cached data for patient portal';

-- ============================================
-- PART 7: SUMMARY TABLES (for aggregated data)
-- ============================================

-- Daily aggregates
CREATE TABLE IF NOT EXISTS daily_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_date DATE UNIQUE NOT NULL,
    new_patients INTEGER,
    total_appointments INTEGER,
    completed_appointments INTEGER,
    cancelled_appointments INTEGER,
    no_show_appointments INTEGER,
    total_revenue DECIMAL(12,2),
    discharges INTEGER,
    avg_length_of_stay DECIMAL(5,2),
    bed_occupancy_rate DECIMAL(5,2)
);

COMMENT ON TABLE daily_aggregates IS 'Daily aggregated metrics';

-- Weekly aggregates
CREATE TABLE IF NOT EXISTS weekly_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    new_patients INTEGER,
    total_appointments INTEGER,
    total_revenue DECIMAL(12,2),
    avg_daily_patients DECIMAL(5,2),
    peak_day DATE,
    peak_patients INTEGER,
    UNIQUE(week_start, week_end)
);

COMMENT ON TABLE weekly_aggregates IS 'Weekly aggregated metrics';

-- Monthly aggregates
CREATE TABLE IF NOT EXISTS monthly_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_year DATE NOT NULL, -- first day of month
    new_patients INTEGER,
    total_appointments INTEGER,
    total_revenue DECIMAL(12,2),
    clinical_revenue DECIMAL(12,2),
    pharmacy_revenue DECIMAL(12,2),
    lab_revenue DECIMAL(12,2),
    avg_revenue_per_patient DECIMAL(10,2),
    top_departments JSONB,
    UNIQUE(month_year)
);

COMMENT ON TABLE monthly_aggregates IS 'Monthly aggregated metrics';

-- ============================================
-- PART 8: ADDITIONAL TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function already exists from previous migrations
-- Adding missing triggers for tables with updated_at

DROP TRIGGER IF EXISTS update_connection_pool_config_updated_at ON connection_pool_config;
CREATE TRIGGER update_connection_pool_config_updated_at
    BEFORE UPDATE ON connection_pool_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_rate_limits_updated_at ON api_rate_limits;
CREATE TRIGGER update_api_rate_limits_updated_at
    BEFORE UPDATE ON api_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add triggers for new tables with updated_at
DROP TRIGGER IF EXISTS update_frequent_searches_updated_at ON frequent_searches_tracking;
CREATE TRIGGER update_frequent_searches_updated_at
    BEFORE UPDATE ON frequent_searches_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cache_hit_ratio_updated_at ON cache_hit_ratio_tracking;
CREATE TRIGGER update_cache_hit_ratio_updated_at
    BEFORE UPDATE ON cache_hit_ratio_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_widget_usage_updated_at ON widget_usage_statistics;
CREATE TRIGGER update_widget_usage_updated_at
    BEFORE UPDATE ON widget_usage_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_recommendations_updated_at ON performance_recommendations;
CREATE TRIGGER update_performance_recommendations_updated_at
    BEFORE UPDATE ON performance_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Cache table triggers
DROP TRIGGER IF EXISTS update_admin_dashboard_cache_updated_at ON admin_dashboard_cache;
CREATE TRIGGER update_admin_dashboard_cache_updated_at
    BEFORE UPDATE ON admin_dashboard_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_dashboard_cache_updated_at ON doctor_dashboard_cache;
CREATE TRIGGER update_doctor_dashboard_cache_updated_at
    BEFORE UPDATE ON doctor_dashboard_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nurse_dashboard_cache_updated_at ON nurse_dashboard_cache;
CREATE TRIGGER update_nurse_dashboard_cache_updated_at
    BEFORE UPDATE ON nurse_dashboard_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reception_dashboard_cache_updated_at ON reception_dashboard_cache;
CREATE TRIGGER update_reception_dashboard_cache_updated_at
    BEFORE UPDATE ON reception_dashboard_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_portal_cache_updated_at ON patient_portal_cache;
CREATE TRIGGER update_patient_portal_cache_updated_at
    BEFORE UPDATE ON patient_portal_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 9: VERIFICATION (UPDATED)
-- ============================================

DO $$
DECLARE
    response_tables INTEGER;
    concurrency_tables INTEGER;
    availability_tables INTEGER;
    capacity_tables INTEGER;
    alert_tables INTEGER;
    cache_tables INTEGER;
    summary_tables INTEGER;
    total_tables INTEGER;
BEGIN
    -- Count tables by category
    SELECT COUNT(*) INTO response_tables FROM information_schema.tables WHERE table_name IN (
        'login_performance_logs', 'slow_login_alerts', 'failed_attempts_tracking',
        'search_performance_logs', 'frequent_searches_tracking', 'slow_search_alerts',
        'save_performance_logs', 'slow_save_alerts', 'transaction_duration_tracking',
        'report_performance_logs', 'cache_hit_ratio_tracking', 'slow_report_alerts',
        'dashboard_load_logs', 'widget_usage_statistics', 'slow_dashboard_alerts',
        'image_upload_logs', 'processing_queue_status', 'storage_usage_tracking', 'upload_failure_logs'
    );
    
    SELECT COUNT(*) INTO concurrency_tables FROM information_schema.tables WHERE table_name IN (
        'concurrency_metrics', 'connection_pool_metrics', 'lock_conflict_logs', 'deadlock_tracking',
        'connection_pool_config', 'appointment_throughput', 'daily_appointment_counts',
        'peak_hour_analysis', 'cancellation_trends', 'no_show_tracking',
        'prescription_throughput', 'daily_prescription_counts', 'doctor_prescription_volume',
        'medicine_frequency_stats', 'invoice_throughput', 'daily_invoice_counts',
        'payment_processing_metrics', 'pending_invoice_alerts', 'revenue_tracking',
        'api_performance_logs', 'api_rate_limits', 'rate_limit_breaches', 'slow_endpoint_alerts'
    );
    
    SELECT COUNT(*) INTO availability_tables FROM information_schema.tables WHERE table_name IN (
        'uptime_logs', 'downtime_incident_reports', 'health_check_history', 'restart_logs',
        'maintenance_windows', 'maintenance_schedule', 'maintenance_logs',
        'post_maintenance_validation', 'rollback_execution_logs',
        'recovery_logs', 'recovery_drill_logs', 'restore_time_metrics',
        'recovery_verification', 'drill_schedule',
        'rpo_metrics', 'backup_history_logs', 'wal_archive_status', 'backup_verification_logs'
    );
    
    SELECT COUNT(*) INTO capacity_tables FROM information_schema.tables WHERE table_name IN (
        'patient_capacity', 'patient_growth_rate', 'storage_usage_by_patient', 'capacity_forecast',
        'appointment_capacity', 'appointment_size_metrics', 'archive_recommendations', 'partition_usage_stats',
        'image_capacity', 'storage_by_image_type', 'compression_effectiveness',
        'db_capacity', 'table_sizes', 'index_usage_stats', 'growth_rate_analysis', 'size_forecast_alerts'
    );
    
    SELECT COUNT(*) INTO alert_tables FROM information_schema.tables WHERE table_name IN (
        'performance_alerts', 'performance_recommendations', 'slow_queries', 'resource_utilization', 'peak_usage_patterns'
    );
    
    SELECT COUNT(*) INTO cache_tables FROM information_schema.tables WHERE table_name IN (
        'admin_dashboard_cache', 'doctor_dashboard_cache', 'nurse_dashboard_cache',
        'reception_dashboard_cache', 'patient_portal_cache'
    );
    
    SELECT COUNT(*) INTO summary_tables FROM information_schema.tables WHERE table_name IN (
        'daily_aggregates', 'weekly_aggregates', 'monthly_aggregates'
    );
    
    total_tables := response_tables + concurrency_tables + availability_tables + capacity_tables + 
                    alert_tables + cache_tables + summary_tables;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'PERFORMANCE TABLES MIGRATION COMPLETED';
    RAISE NOTICE 'Response Time Tables: %', response_tables;
    RAISE NOTICE 'Concurrency Tables: %', concurrency_tables;
    RAISE NOTICE 'Availability Tables: %', availability_tables;
    RAISE NOTICE 'Capacity Tables: %', capacity_tables;
    RAISE NOTICE 'Alert Tables: %', alert_tables;
    RAISE NOTICE 'Cache Tables: %', cache_tables;
    RAISE NOTICE 'Summary Tables: %', summary_tables;
    RAISE NOTICE 'TOTAL TABLES: %', total_tables;
    RAISE NOTICE 'Requirements Covered: PR-01 to PR-19';
    RAISE NOTICE 'Hardware: 16GB RAM, 512GB SSD Laptop';
    RAISE NOTICE '============================================';
END $$;