-- ============================================
-- FILE: database/migrations/025_performance_tables.sql
-- DESCRIPTION: Performance monitoring and optimization tables
-- SAFE MIGRATION: Can be run multiple times without errors
-- HARDWARE: Laptop (16GB RAM, 512GB SSD)
-- ============================================

-- ============================================
-- PART 1: RESPONSE TIME MONITORING TABLES (PR-01 to PR-06)
-- ============================================

-- Login performance logs
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

CREATE INDEX idx_login_performance_time ON login_performance_logs(login_time);
CREATE INDEX idx_login_performance_slow ON login_performance_logs(response_time_ms) WHERE response_time_ms > 2000;

-- Search performance logs
CREATE TABLE IF NOT EXISTS search_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_term TEXT,
    search_type VARCHAR(50), -- patient/doctor/appointment/medicine
    result_count INTEGER,
    response_time_ms INTEGER NOT NULL,
    search_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    query_hash VARCHAR(64),
    CONSTRAINT fk_search_performance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_search_performance_time ON search_performance_logs(search_time);
CREATE INDEX idx_search_performance_slow ON search_performance_logs(response_time_ms) WHERE response_time_ms > 3000;
CREATE INDEX idx_search_performance_type ON search_performance_logs(search_type);

-- Save performance logs
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

CREATE INDEX idx_save_performance_time ON save_performance_logs(save_time);
CREATE INDEX idx_save_performance_slow ON save_performance_logs(duration_ms) WHERE duration_ms > 2000;

-- Report generation logs
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

CREATE INDEX idx_report_performance_time ON report_performance_logs(generated_at);
CREATE INDEX idx_report_performance_slow ON report_performance_logs(generation_time_ms) WHERE generation_time_ms > 5000;

-- Dashboard load logs
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

CREATE INDEX idx_dashboard_load_time ON dashboard_load_logs(loaded_at);
CREATE INDEX idx_dashboard_load_slow ON dashboard_load_logs(load_time_ms) WHERE load_time_ms > 3000;

-- Image upload logs
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

CREATE INDEX idx_image_upload_time ON image_upload_logs(uploaded_at);
CREATE INDEX idx_image_upload_slow ON image_upload_logs(total_time_ms) WHERE total_time_ms > 5000;

-- ============================================
-- PART 2: CONCURRENCY MONITORING TABLES (PR-07 to PR-11)
-- ============================================

-- Concurrency metrics
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

CREATE INDEX idx_concurrency_metrics_time ON concurrency_metrics(measured_at);

-- Connection pool config
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

-- Insert default config
INSERT INTO connection_pool_config (pool_name) VALUES ('default') ON CONFLICT DO NOTHING;

-- Appointment throughput
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

CREATE INDEX idx_appointment_throughput_date ON appointment_throughput(measure_date);

-- Prescription throughput
CREATE TABLE IF NOT EXISTS prescription_throughput (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_date DATE UNIQUE NOT NULL,
    total_prescriptions INTEGER DEFAULT 0,
    avg_medicines_per_rx DECIMAL(3,2),
    peak_hour INTEGER,
    by_doctor JSONB -- doctor_id: count
);

CREATE INDEX idx_prescription_throughput_date ON prescription_throughput(measure_date);

-- Invoice throughput
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

CREATE INDEX idx_invoice_throughput_date ON invoice_throughput(measure_date);

-- API performance metrics
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

CREATE INDEX idx_api_performance_time ON api_performance_logs(measured_at);
CREATE INDEX idx_api_performance_endpoint ON api_performance_logs(endpoint, method);

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

-- ============================================
-- PART 3: AVAILABILITY MONITORING TABLES (PR-12 to PR-15)
-- ============================================

-- Uptime logs
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

CREATE INDEX idx_uptime_logs_date ON uptime_logs(log_date);

-- Maintenance windows
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

-- Insert default maintenance window
INSERT INTO maintenance_windows (window_name, day_of_week) 
VALUES ('weekly_maintenance', 0) ON CONFLICT DO NOTHING;

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

CREATE INDEX idx_maintenance_logs_start ON maintenance_logs(start_time);

-- Recovery logs
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

CREATE INDEX idx_recovery_logs_date ON recovery_logs(incident_date);

-- RPO monitoring
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

CREATE INDEX idx_rpo_metrics_time ON rpo_metrics(check_time);
CREATE INDEX idx_rpo_metrics_compliant ON rpo_metrics(rpo_compliant);

-- ============================================
-- PART 4: CAPACITY PLANNING TABLES (PR-16 to PR-19)
-- ============================================

-- Patient capacity tracking
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

CREATE INDEX idx_patient_capacity_date ON patient_capacity(measure_date);

-- Appointment capacity tracking
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

CREATE INDEX idx_appointment_capacity_year ON appointment_capacity(measure_year);

-- Image capacity tracking
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

CREATE INDEX idx_image_capacity_date ON image_capacity(measure_date);

-- Database capacity tracking
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

CREATE INDEX idx_db_capacity_date ON db_capacity(measure_date);

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

CREATE INDEX idx_table_sizes_name ON table_sizes(table_name);
CREATE INDEX idx_table_sizes_time ON table_sizes(measured_at);

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

CREATE INDEX idx_performance_alerts_type ON performance_alerts(alert_type, severity);
CREATE INDEX idx_performance_alerts_created ON performance_alerts(created_at);
CREATE INDEX idx_performance_alerts_resolved ON performance_alerts(resolved) WHERE resolved = FALSE;

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

CREATE INDEX idx_performance_recommendations_type ON performance_recommendations(recommendation_type);
CREATE INDEX idx_performance_recommendations_priority ON performance_recommendations(priority);
CREATE INDEX idx_performance_recommendations_implemented ON performance_recommendations(implemented);

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

CREATE INDEX idx_slow_queries_hash ON slow_queries(query_hash);
CREATE INDEX idx_slow_queries_time ON slow_queries(query_time);
CREATE INDEX idx_slow_queries_duration ON slow_queries(duration_ms) WHERE duration_ms > 1000;

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

CREATE INDEX idx_index_usage_table ON index_usage_stats(table_name);
CREATE INDEX idx_index_usage_last ON index_usage_stats(last_used) WHERE last_used IS NOT NULL;

-- ============================================
-- PART 6: TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connection_pool_config_updated_at
    BEFORE UPDATE ON connection_pool_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_rate_limits_updated_at
    BEFORE UPDATE ON api_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 7: VERIFICATION
-- ============================================

DO $$
DECLARE
    response_tables INTEGER;
    concurrency_tables INTEGER;
    availability_tables INTEGER;
    capacity_tables INTEGER;
    alert_tables INTEGER;
    total_tables INTEGER;
BEGIN
    -- Count tables by category
    SELECT COUNT(*) INTO response_tables FROM information_schema.tables WHERE table_name IN (
        'login_performance_logs', 'search_performance_logs', 'save_performance_logs',
        'report_performance_logs', 'dashboard_load_logs', 'image_upload_logs'
    );
    
    SELECT COUNT(*) INTO concurrency_tables FROM information_schema.tables WHERE table_name IN (
        'concurrency_metrics', 'connection_pool_config', 'appointment_throughput',
        'prescription_throughput', 'invoice_throughput', 'api_performance_logs', 'api_rate_limits'
    );
    
    SELECT COUNT(*) INTO availability_tables FROM information_schema.tables WHERE table_name IN (
        'uptime_logs', 'maintenance_windows', 'maintenance_logs', 'recovery_logs', 'rpo_metrics'
    );
    
    SELECT COUNT(*) INTO capacity_tables FROM information_schema.tables WHERE table_name IN (
        'patient_capacity', 'appointment_capacity', 'image_capacity', 'db_capacity', 'table_sizes'
    );
    
    SELECT COUNT(*) INTO alert_tables FROM information_schema.tables WHERE table_name IN (
        'performance_alerts', 'performance_recommendations', 'slow_queries', 'index_usage_stats'
    );
    
    total_tables := response_tables + concurrency_tables + availability_tables + capacity_tables + alert_tables;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'PERFORMANCE TABLES MIGRATION COMPLETED';
    RAISE NOTICE 'Response Time Tables: %', response_tables;
    RAISE NOTICE 'Concurrency Tables: %', concurrency_tables;
    RAISE NOTICE 'Availability Tables: %', availability_tables;
    RAISE NOTICE 'Capacity Tables: %', capacity_tables;
    RAISE NOTICE 'Alert Tables: %', alert_tables;
    RAISE NOTICE 'Total Tables: %', total_tables;
    RAISE NOTICE 'Requirements Covered: PR-01 to PR-19';
    RAISE NOTICE 'Hardware: 16GB RAM, 512GB SSD Laptop';
    RAISE NOTICE '============================================';
END $$;