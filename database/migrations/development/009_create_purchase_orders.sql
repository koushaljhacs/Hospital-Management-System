-- ============================================
-- MIGRATION: 009_create_purchase_orders.sql
-- DESCRIPTION: Create purchase orders table with complete procurement management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: suppliers table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create purchase_order_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status_enum') THEN
        CREATE TYPE purchase_order_status_enum AS ENUM (
            'draft',
            'submitted',
            'pending_approval',
            'approved',
            'rejected',
            'ordered',
            'partially_received',
            'received',
            'cancelled',
            'completed'
        );
        RAISE NOTICE 'Created purchase_order_status_enum type';
    END IF;
END $$;

-- Create payment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        CREATE TYPE payment_status_enum AS ENUM (
            'pending',
            'partial',
            'paid',
            'overdue'
        );
        RAISE NOTICE 'Created payment_status_enum type';
    END IF;
END $$;

-- Create delivery_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status_enum') THEN
        CREATE TYPE delivery_status_enum AS ENUM (
            'pending',
            'shipped',
            'in_transit',
            'delivered',
            'delayed',
            'partial'
        );
        RAISE NOTICE 'Created delivery_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE PURCHASE ORDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL,
    
    -- ========================================
    -- ORDER DETAILS
    -- ========================================
    order_date DATE NOT NULL,
    expected_delivery DATE NOT NULL,
    actual_delivery DATE,
    delivery_status delivery_status_enum,
    
    -- ========================================
    -- FINANCIAL
    -- ========================================
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    discount_type VARCHAR(20),
    tax_amount DECIMAL(12,2) DEFAULT 0,
    tax_details JSONB,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    other_charges DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    
    -- ========================================
    -- PAYMENT TERMS
    -- ========================================
    payment_terms VARCHAR(100),
    payment_due_date DATE,
    payment_status payment_status_enum DEFAULT 'pending',
    advance_paid DECIMAL(12,2) DEFAULT 0,
    balance_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - advance_paid) STORED,
    payment_history JSONB,
    
    -- ========================================
    -- ORDER ITEMS
    -- ========================================
    items JSONB NOT NULL,
    item_count INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    
    -- ========================================
    -- SHIPPING
    -- ========================================
    shipping_address TEXT,
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    shipping_notes TEXT,
    
    -- ========================================
    -- DOCUMENTS
    -- ========================================
    po_document_url TEXT,
    invoice_received_url TEXT,
    delivery_challan_url TEXT,
    other_documents JSONB,
    
    -- ========================================
    -- APPROVAL WORKFLOW
    -- ========================================
    status purchase_order_status_enum DEFAULT 'draft',
    approval_level INTEGER DEFAULT 0,
    submitted_by UUID,
    submitted_at TIMESTAMP,
    approved_by UUID,
    approved_at TIMESTAMP,
    rejected_by UUID,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    cancelled_by UUID,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    -- ========================================
    -- RECEIVED INFORMATION
    -- ========================================
    received_by UUID,
    received_at TIMESTAMP,
    received_notes TEXT,
    quality_check_passed BOOLEAN,
    quality_check_notes TEXT,
    inspected_by UUID,
    inspected_at TIMESTAMP,
    
    -- ========================================
    -- NOTES & METADATA
    -- ========================================
    notes TEXT,
    internal_notes TEXT,
    metadata JSONB,
    
    -- ========================================
    -- AUDIT
    -- ========================================
    created_by UUID,
    updated_by UUID,
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
    CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) 
        REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_orders_submitted_by FOREIGN KEY (submitted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_approved_by FOREIGN KEY (approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_rejected_by FOREIGN KEY (rejected_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_cancelled_by FOREIGN KEY (cancelled_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_received_by FOREIGN KEY (received_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_inspected_by FOREIGN KEY (inspected_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (expected_delivery >= order_date),
    CONSTRAINT check_actual_delivery CHECK (actual_delivery IS NULL OR actual_delivery >= order_date),
    CONSTRAINT check_amounts CHECK (subtotal >= 0 AND discount >= 0 AND tax_amount >= 0),
    CONSTRAINT check_total CHECK (total_amount = subtotal - discount + tax_amount + shipping_cost + other_charges),
    CONSTRAINT check_payment CHECK (advance_paid >= 0 AND advance_paid <= total_amount),
    CONSTRAINT check_item_count CHECK (item_count >= 0),
    CONSTRAINT check_quantity CHECK (total_quantity >= 0),
    CONSTRAINT check_approval_level CHECK (approval_level >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id) WHERE is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_expected_delivery ON purchase_orders(expected_delivery) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_actual_delivery ON purchase_orders(actual_delivery) WHERE actual_delivery IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_status ON purchase_orders(delivery_status) WHERE delivery_status IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_status ON purchase_orders(payment_status) WHERE is_deleted = FALSE;

-- Approval workflow indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_approved_by ON purchase_orders(approved_by) WHERE approved_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_submitted_by ON purchase_orders(submitted_by) WHERE submitted_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_approval_level ON purchase_orders(approval_level) WHERE is_deleted = FALSE;

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_total_amount ON purchase_orders(total_amount) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_currency ON purchase_orders(currency) WHERE is_deleted = FALSE;

-- Received information indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_received_by ON purchase_orders(received_by) WHERE received_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_quality_check ON purchase_orders(quality_check_passed) WHERE quality_check_passed IS NOT NULL AND is_deleted = FALSE;

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by) WHERE created_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at) WHERE is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_purchase_orders_deleted ON purchase_orders(is_deleted, deleted_at);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_items ON purchase_orders USING gin(items);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tax_details ON purchase_orders USING gin(tax_details);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_history ON purchase_orders USING gin(payment_history);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_other_documents ON purchase_orders USING gin(other_documents);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_metadata ON purchase_orders USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_purchase_orders_updated_at') THEN
        CREATE TRIGGER update_purchase_orders_updated_at
            BEFORE UPDATE ON purchase_orders
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_purchase_orders_updated_at';
    END IF;
END $$;

-- Function to update status when received
CREATE OR REPLACE FUNCTION update_purchase_order_on_receive()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_delivery IS NOT NULL AND OLD.actual_delivery IS NULL THEN
        NEW.status = 'received';
        NEW.delivery_status = 'delivered';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for receive status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_purchase_order_receive_status') THEN
        CREATE TRIGGER update_purchase_order_receive_status
            BEFORE UPDATE OF actual_delivery ON purchase_orders
            FOR EACH ROW
            EXECUTE FUNCTION update_purchase_order_on_receive();
        RAISE NOTICE 'Created trigger update_purchase_order_receive_status';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE purchase_orders IS 'Complete purchase orders management';
COMMENT ON COLUMN purchase_orders.id IS 'Primary key - UUID';
COMMENT ON COLUMN purchase_orders.po_number IS 'Unique purchase order number';
COMMENT ON COLUMN purchase_orders.supplier_id IS 'Foreign key to suppliers table';
COMMENT ON COLUMN purchase_orders.order_date IS 'Date when order was placed';
COMMENT ON COLUMN purchase_orders.expected_delivery IS 'Expected delivery date';
COMMENT ON COLUMN purchase_orders.actual_delivery IS 'Actual delivery date';
COMMENT ON COLUMN purchase_orders.delivery_status IS 'Current delivery status';
COMMENT ON COLUMN purchase_orders.subtotal IS 'Subtotal before taxes and charges';
COMMENT ON COLUMN purchase_orders.discount IS 'Discount amount';
COMMENT ON COLUMN purchase_orders.discount_type IS 'Discount type (percentage/fixed)';
COMMENT ON COLUMN purchase_orders.tax_amount IS 'Total tax amount';
COMMENT ON COLUMN purchase_orders.tax_details IS 'Tax breakdown in JSON';
COMMENT ON COLUMN purchase_orders.shipping_cost IS 'Shipping cost';
COMMENT ON COLUMN purchase_orders.other_charges IS 'Other charges';
COMMENT ON COLUMN purchase_orders.total_amount IS 'Total order amount';
COMMENT ON COLUMN purchase_orders.currency IS 'Currency code';
COMMENT ON COLUMN purchase_orders.exchange_rate IS 'Exchange rate if foreign currency';
COMMENT ON COLUMN purchase_orders.payment_terms IS 'Payment terms agreed with supplier';
COMMENT ON COLUMN purchase_orders.payment_due_date IS 'Date when payment is due';
COMMENT ON COLUMN purchase_orders.payment_status IS 'Current payment status';
COMMENT ON COLUMN purchase_orders.advance_paid IS 'Advance payment amount';
COMMENT ON COLUMN purchase_orders.balance_amount IS 'Remaining balance (generated)';
COMMENT ON COLUMN purchase_orders.payment_history IS 'Payment history in JSON';
COMMENT ON COLUMN purchase_orders.items IS 'Order items in JSON array';
COMMENT ON COLUMN purchase_orders.item_count IS 'Number of items in order';
COMMENT ON COLUMN purchase_orders.total_quantity IS 'Total quantity of all items';
COMMENT ON COLUMN purchase_orders.shipping_address IS 'Shipping address';
COMMENT ON COLUMN purchase_orders.shipping_method IS 'Shipping method';
COMMENT ON COLUMN purchase_orders.tracking_number IS 'Shipment tracking number';
COMMENT ON COLUMN purchase_orders.carrier IS 'Shipping carrier';
COMMENT ON COLUMN purchase_orders.shipping_notes IS 'Shipping instructions';
COMMENT ON COLUMN purchase_orders.po_document_url IS 'Purchase order document URL';
COMMENT ON COLUMN purchase_orders.invoice_received_url IS 'Supplier invoice URL';
COMMENT ON COLUMN purchase_orders.delivery_challan_url IS 'Delivery challan URL';
COMMENT ON COLUMN purchase_orders.other_documents IS 'Other documents in JSON';
COMMENT ON COLUMN purchase_orders.status IS 'Purchase order status';
COMMENT ON COLUMN purchase_orders.approval_level IS 'Approval level required';
COMMENT ON COLUMN purchase_orders.submitted_by IS 'User who submitted for approval';
COMMENT ON COLUMN purchase_orders.submitted_at IS 'Submission timestamp';
COMMENT ON COLUMN purchase_orders.approved_by IS 'User who approved';
COMMENT ON COLUMN purchase_orders.approved_at IS 'Approval timestamp';
COMMENT ON COLUMN purchase_orders.rejected_by IS 'User who rejected';
COMMENT ON COLUMN purchase_orders.rejected_at IS 'Rejection timestamp';
COMMENT ON COLUMN purchase_orders.rejection_reason IS 'Reason for rejection';
COMMENT ON COLUMN purchase_orders.cancelled_by IS 'User who cancelled';
COMMENT ON COLUMN purchase_orders.cancelled_at IS 'Cancellation timestamp';
COMMENT ON COLUMN purchase_orders.cancellation_reason IS 'Reason for cancellation';
COMMENT ON COLUMN purchase_orders.received_by IS 'User who received the order';
COMMENT ON COLUMN purchase_orders.received_at IS 'Receiving timestamp';
COMMENT ON COLUMN purchase_orders.received_notes IS 'Notes on receiving';
COMMENT ON COLUMN purchase_orders.quality_check_passed IS 'Whether quality check passed';
COMMENT ON COLUMN purchase_orders.quality_check_notes IS 'Quality check notes';
COMMENT ON COLUMN purchase_orders.inspected_by IS 'User who inspected';
COMMENT ON COLUMN purchase_orders.inspected_at IS 'Inspection timestamp';
COMMENT ON COLUMN purchase_orders.notes IS 'General notes';
COMMENT ON COLUMN purchase_orders.internal_notes IS 'Internal notes';
COMMENT ON COLUMN purchase_orders.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN purchase_orders.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'purchase_orders';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'purchase_orders';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'purchase_orders'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'purchase_orders'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'purchase_orders';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('purchase_order_status_enum', 'payment_status_enum', 'delivery_status_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 009_create_purchase_orders.sql COMPLETED';
    RAISE NOTICE 'Purchase Orders table exists: %', table_exists;
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