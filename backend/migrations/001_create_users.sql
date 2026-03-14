-- ============================================
-- MIGRATION: 001_create_users.sql
-- DESCRIPTION: Create users table for authentication
-- SAFE MIGRATION: Can be run multiple times without errors
-- ============================================

-- ============================================
-- PART 1: SAFE EXTENSION CREATION
-- ============================================
-- Enable UUID extension (idempotent - already has IF NOT EXISTS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 2: SAFE ENUM TYPE CREATION
-- ============================================

-- Create user_role enum type (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'super_admin', 
            'it_admin', 
            'billing_admin', 
            'doctor', 
            'nurse', 
            'receptionist', 
            'pharmacist', 
            'lab_technician', 
            'radiologist', 
            'ground_staff', 
            'patient', 
            'guest'
        );
        RAISE NOTICE 'Created user_role enum type';
    ELSE
        RAISE NOTICE 'user_role enum type already exists, skipping...';
    END IF;
END $$;

-- Create user_status enum type (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM (
            'active', 
            'inactive', 
            'suspended', 
            'locked'
        );
        RAISE NOTICE 'Created user_status enum type';
    ELSE
        RAISE NOTICE 'user_status enum type already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- PART 3: SAFE TABLE CREATION
-- ============================================

-- Create users table (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role user_role NOT NULL,
            status user_status DEFAULT 'active',
            profile_picture TEXT,
            email_verified BOOLEAN DEFAULT FALSE,
            phone_verified BOOLEAN DEFAULT FALSE,
            two_factor_enabled BOOLEAN DEFAULT FALSE,
            last_login TIMESTAMP,
            last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            failed_login_attempts INTEGER DEFAULT 0,
            locked_until TIMESTAMP,
            refresh_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Created users table';
        
        -- Create indexes after table creation
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_username ON users(username);
        CREATE INDEX idx_users_role ON users(role);
        CREATE INDEX idx_users_status ON users(status);
        RAISE NOTICE 'Created indexes on users table';
    ELSE
        RAISE NOTICE 'users table already exists, skipping creation...';
        
        -- Check and create missing indexes (safe)
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email') THEN
            CREATE INDEX idx_users_email ON users(email);
            RAISE NOTICE 'Created missing index idx_users_email';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_username') THEN
            CREATE INDEX idx_users_username ON users(username);
            RAISE NOTICE 'Created missing index idx_users_username';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_role') THEN
            CREATE INDEX idx_users_role ON users(role);
            RAISE NOTICE 'Created missing index idx_users_role';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_status') THEN
            CREATE INDEX idx_users_status ON users(status);
            RAISE NOTICE 'Created missing index idx_users_status';
        END IF;
    END IF;
END $$;

-- ============================================
-- PART 4: SAFE TRIGGER FUNCTION CREATION
-- ============================================

-- Create or replace function for updated_at (always safe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- PART 5: SAFE TRIGGER CREATION
-- ============================================

-- Create trigger on users table (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_users_updated_at';
    ELSE
        RAISE NOTICE 'Trigger update_users_updated_at already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- PART 6: SAFE COMMENTS CREATION
-- ============================================

-- Add comments (safe - using COMMENT ON is idempotent)
COMMENT ON TABLE users IS 'Core user authentication and authorization table';
COMMENT ON COLUMN users.id IS 'Primary key - UUID';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.email IS 'Unique email address';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.role IS 'User role for RBAC';
COMMENT ON COLUMN users.status IS 'Account status';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for brute force protection';
COMMENT ON COLUMN users.locked_until IS 'Timestamp until account is locked';

-- ============================================
-- PART 7: VERIFICATION QUERY
-- ============================================

-- This will show in logs when migration runs
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 001_create_users.sql COMPLETED';
    RAISE NOTICE 'Users table exists: %', (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users'));
    RAISE NOTICE 'Total indexes on users: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'users');
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================