/**
 * ======================================================================
 * FILE: backend/src/services/patient/billingService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient billing service handling invoices, payments, and insurance.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * BUSINESS RULES:
 * - [BR-29] Invoice number auto-generated
 * - [BR-30] Tax calculated automatically
 * - [BR-31] Discount max 100%
 * - [BR-32] Payment must be ≤ total amount
 * - [BR-33] Partial payment allowed
 * - [BR-34] Refund within 30 days only
 * - [BR-35] Insurance claims require verification
 * 
 * ======================================================================
 */

const Patient = require('../../models/Patient');
const logger = require('../../utils/logger');
const db = require('../../config/database');

/**
 * Patient Billing Service
 */
const billingService = {
    /**
     * Get invoice by ID with patient verification
     * @param {string} invoiceId - Invoice UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Invoice object
     */
    async getInvoiceById(invoiceId, patientId) {
        try {
            const query = `
                SELECT i.*, 
                       p.first_name, p.last_name, p.email, p.phone
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.id = $1 AND i.patient_id = $2 AND i.is_deleted = false
            `;
            
            const result = await db.query(query, [invoiceId, patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting invoice by ID', { 
                error: error.message,
                invoiceId,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get invoice breakdown (itemized charges)
     * @param {string} invoiceId - Invoice UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Invoice breakdown
     */
    async getInvoiceBreakdown(invoiceId, patientId) {
        try {
            // First verify invoice belongs to patient
            const invoice = await this.getInvoiceById(invoiceId, patientId);
            
            if (!invoice) {
                return null;
            }

            // Get invoice items
            const itemsQuery = `
                SELECT * FROM invoice_items
                WHERE invoice_id = $1
                ORDER BY created_at ASC
            `;
            
            const items = await db.query(itemsQuery, [invoiceId]);

            // Calculate summary
            const summary = {
                subtotal: 0,
                tax_total: 0,
                discount_total: 0,
                items: items.rows
            };

            items.rows.forEach(item => {
                summary.subtotal += parseFloat(item.amount || 0);
                summary.tax_total += parseFloat(item.tax_amount || 0);
                summary.discount_total += parseFloat(item.discount_amount || 0);
            });

            return {
                invoice: {
                    id: invoice.id,
                    number: invoice.invoice_number,
                    date: invoice.issue_date,
                    due_date: invoice.due_date,
                    status: invoice.status
                },
                patient: {
                    name: `${invoice.first_name} ${invoice.last_name}`,
                    email: invoice.email,
                    phone: invoice.phone
                },
                items: items.rows,
                summary: {
                    ...summary,
                    total: invoice.total,
                    paid: invoice.paid_amount,
                    balance: invoice.total - invoice.paid_amount
                }
            };
        } catch (error) {
            logger.error('Error getting invoice breakdown', { 
                error: error.message,
                invoiceId,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Generate invoice PDF
     * @param {string} invoiceId - Invoice UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Buffer>} PDF buffer
     */
    async generateInvoicePDF(invoiceId, patientId) {
        try {
            // Get invoice data
            const invoice = await this.getInvoiceBreakdown(invoiceId, patientId);
            
            if (!invoice) {
                return null;
            }

            // TODO: Implement PDF generation
            // For now, return JSON string as buffer
            logger.info('PDF generation requested', { invoiceId });
            
            return Buffer.from(JSON.stringify(invoice, null, 2));
        } catch (error) {
            logger.error('Error generating invoice PDF', { 
                error: error.message,
                invoiceId,
                patientId 
            });
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    },

    /**
     * Get patient payments with pagination
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Payments list with pagination
     */
    async getPayments(patientId, options = {}) {
        try {
            const { page = 1, limit = 20, fromDate, toDate } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT p.*, i.invoice_number
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE i.patient_id = $1
            `;
            const values = [patientId];
            let paramIndex = 2;

            if (fromDate) {
                query += ` AND p.payment_date >= $${paramIndex}`;
                values.push(fromDate);
                paramIndex++;
            }

            if (toDate) {
                query += ` AND p.payment_date <= $${paramIndex}`;
                values.push(toDate);
                paramIndex++;
            }

            query += ` ORDER BY p.payment_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const payments = await db.query(query, values);

            const total = await db.query(
                'SELECT COUNT(*) as count FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.patient_id = $1',
                [patientId]
            );

            return {
                data: payments.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting payments', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get payment by ID
     * @param {string} paymentId - Payment UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Payment object
     */
    async getPaymentById(paymentId, patientId) {
        try {
            const query = `
                SELECT p.*, i.invoice_number, i.total as invoice_total
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE p.id = $1 AND i.patient_id = $2
            `;
            
            const result = await db.query(query, [paymentId, patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting payment by ID', { 
                error: error.message,
                paymentId,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Process a payment
     * @param {Object} paymentData - Payment data
     * @returns {Promise<Object>} Created payment
     */
    async processPayment(paymentData) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Insert payment
            const paymentQuery = `
                INSERT INTO payments (
                    invoice_id, patient_id, amount, payment_method,
                    card_last_four, bank_name, reference_number,
                    ip_address, user_agent, payment_date, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING *
            `;

            const paymentValues = [
                paymentData.invoice_id,
                paymentData.patient_id,
                paymentData.amount,
                paymentData.payment_method,
                paymentData.card_last_four || null,
                paymentData.bank_name || null,
                paymentData.reference_number || null,
                paymentData.ip,
                paymentData.user_agent
            ];

            const payment = await client.query(paymentQuery, paymentValues);

            // Update invoice paid amount
            const updateInvoiceQuery = `
                UPDATE invoices 
                SET paid_amount = paid_amount + $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `;

            const updatedInvoice = await client.query(updateInvoiceQuery, [
                paymentData.amount,
                paymentData.invoice_id
            ]);

            // Check if invoice is fully paid
            if (updatedInvoice.rows[0].paid_amount >= updatedInvoice.rows[0].total) {
                await client.query(
                    `UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = $1`,
                    [paymentData.invoice_id]
                );
            }

            await db.commitTransaction(client);

            logger.info('Payment processed successfully', {
                paymentId: payment.rows[0].id,
                invoiceId: paymentData.invoice_id,
                amount: paymentData.amount,
                patientId: paymentData.patient_id
            });

            return payment.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error processing payment', { 
                error: error.message,
                invoiceId: paymentData.invoice_id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Initiate online payment
     * @param {Object} sessionData - Payment session data
     * @returns {Promise<Object>} Payment session
     */
    async initiateOnlinePayment(sessionData) {
        try {
            // TODO: Integrate with actual payment gateway (Razorpay/Stripe/etc)
            // For now, create a mock session
            
            const sessionQuery = `
                INSERT INTO online_payments (
                    invoice_id, patient_id, amount, payment_gateway,
                    order_id, status, customer_details, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING *
            `;

            const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const values = [
                sessionData.invoice_id,
                sessionData.patient_id,
                sessionData.amount,
                sessionData.payment_gateway,
                orderId,
                'initiated',
                JSON.stringify(sessionData.customer_details)
            ];

            const result = await db.query(sessionQuery, values);

            logger.info('Online payment initiated', {
                sessionId: result.rows[0].id,
                orderId,
                invoiceId: sessionData.invoice_id,
                amount: sessionData.amount
            });

            return {
                id: result.rows[0].id,
                order_id: orderId,
                amount: sessionData.amount,
                currency: 'INR',
                gateway: sessionData.payment_gateway,
                // Mock payment links
                payment_link: `https://payment.example.com/pay/${orderId}`,
                expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
            };
        } catch (error) {
            logger.error('Error initiating online payment', { 
                error: error.message,
                invoiceId: sessionData.invoice_id 
            });
            throw new Error(`Payment initiation failed: ${error.message}`);
        }
    },

    /**
     * Verify online payment
     * @param {Object} verificationData - Verification data
     * @returns {Promise<Object>} Verification result
     */
    async verifyOnlinePayment(verificationData) {
        try {
            const { session_id, payment_id, status, signature } = verificationData;

            // Update payment status
            const query = `
                UPDATE online_payments 
                SET payment_status = $1,
                    gateway_transaction_id = $2,
                    gateway_response = $3,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                status,
                payment_id,
                JSON.stringify({ signature }),
                session_id
            ];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Payment session not found');
            }

            // If payment successful, process the actual payment
            if (status === 'success') {
                await this.processPayment({
                    invoice_id: result.rows[0].invoice_id,
                    patient_id: result.rows[0].patient_id,
                    amount: result.rows[0].amount,
                    payment_method: 'online',
                    reference_number: payment_id,
                    ip: 'system',
                    user_agent: 'payment_gateway'
                });
            }

            logger.info('Online payment verified', {
                sessionId: session_id,
                paymentId: payment_id,
                status
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error verifying online payment', { 
                error: error.message,
                sessionId: verificationData.session_id 
            });
            throw new Error(`Payment verification failed: ${error.message}`);
        }
    },

    /**
     * Get patient payment methods
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Array>} List of payment methods
     */
    async getPaymentMethods(patientId) {
        try {
            const query = `
                SELECT * FROM payment_methods
                WHERE patient_id = $1 AND is_active = true
                ORDER BY is_default DESC, created_at DESC
            `;
            
            const result = await db.query(query, [patientId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting payment methods', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Add payment method
     * @param {Object} methodData - Payment method data
     * @returns {Promise<Object>} Added payment method
     */
    async addPaymentMethod(methodData) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // If this is the first method or set as default, clear other defaults
            if (methodData.is_default) {
                await client.query(
                    `UPDATE payment_methods SET is_default = false WHERE patient_id = $1`,
                    [methodData.patient_id]
                );
            }

            // Mask sensitive data
            let maskedDetails = '';
            if (methodData.type === 'card') {
                maskedDetails = `****${methodData.card_number?.slice(-4)}`;
            } else if (methodData.type === 'upi') {
                maskedDetails = methodData.upi_id;
            } else if (methodData.type === 'bank') {
                maskedDetails = `****${methodData.account_number?.slice(-4)}`;
            }

            const query = `
                INSERT INTO payment_methods (
                    patient_id, method_type, provider, token,
                    masked_details, expiry_month, expiry_year,
                    is_default, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
                RETURNING *
            `;

            const values = [
                methodData.patient_id,
                methodData.type,
                methodData.provider || null,
                methodData.token || null,
                maskedDetails,
                methodData.expiry_month || null,
                methodData.expiry_year || null,
                methodData.is_default || false
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Payment method added', {
                methodId: result.rows[0].id,
                patientId: methodData.patient_id,
                type: methodData.type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error adding payment method', { 
                error: error.message,
                patientId: methodData.patient_id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete payment method
     * @param {string} methodId - Method UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<boolean>} Success status
     */
    async deletePaymentMethod(methodId, patientId) {
        try {
            const query = `
                UPDATE payment_methods 
                SET is_active = false, updated_at = NOW()
                WHERE id = $1 AND patient_id = $2
                RETURNING id
            `;
            
            const result = await db.query(query, [methodId, patientId]);
            
            if (result.rows.length === 0) {
                throw new Error('Payment method not found');
            }

            logger.info('Payment method deleted', {
                methodId,
                patientId
            });

            return true;
        } catch (error) {
            logger.error('Error deleting payment method', { 
                error: error.message,
                methodId,
                patientId 
            });
            throw error;
        }
    },

    /**
     * Set default payment method
     * @param {string} methodId - Method UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Updated method
     */
    async setDefaultPaymentMethod(methodId, patientId) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Clear existing defaults
            await client.query(
                `UPDATE payment_methods SET is_default = false WHERE patient_id = $1`,
                [patientId]
            );

            // Set new default
            const query = `
                UPDATE payment_methods 
                SET is_default = true, updated_at = NOW()
                WHERE id = $1 AND patient_id = $2
                RETURNING *
            `;

            const result = await client.query(query, [methodId, patientId]);

            if (result.rows.length === 0) {
                throw new Error('Payment method not found');
            }

            await db.commitTransaction(client);

            logger.info('Default payment method set', {
                methodId,
                patientId
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error setting default payment method', { 
                error: error.message,
                methodId,
                patientId 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get insurance claims
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Claims list with pagination
     */
    async getInsuranceClaims(patientId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT * FROM insurance_claims
                WHERE patient_id = $1
                ORDER BY submitted_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [patientId, limit, offset]);

            const total = await db.query(
                'SELECT COUNT(*) as count FROM insurance_claims WHERE patient_id = $1',
                [patientId]
            );

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting insurance claims', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get insurance claim by ID
     * @param {string} claimId - Claim UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Claim object
     */
    async getInsuranceClaimById(claimId, patientId) {
        try {
            const query = `
                SELECT * FROM insurance_claims
                WHERE id = $1 AND patient_id = $2
            `;
            
            const result = await db.query(query, [claimId, patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting insurance claim by ID', { 
                error: error.message,
                claimId,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Submit insurance claim
     * @param {Object} claimData - Claim data
     * @returns {Promise<Object>} Created claim
     */
    async submitInsuranceClaim(claimData) {
        try {
            const claimNumber = `CLM${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

            const query = `
                INSERT INTO insurance_claims (
                    claim_number, patient_id, invoice_id, provider,
                    policy_number, diagnosis, procedure_codes,
                    documents, amount, claim_status, submitted_at, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', NOW(), NOW())
                RETURNING *
            `;

            const values = [
                claimNumber,
                claimData.patient_id,
                claimData.invoice_id,
                claimData.provider,
                claimData.policy_number,
                claimData.diagnosis,
                JSON.stringify(claimData.procedure_codes || []),
                JSON.stringify(claimData.documents || []),
                claimData.amount
            ];

            const result = await db.query(query, values);

            logger.info('Insurance claim submitted', {
                claimId: result.rows[0].id,
                claimNumber,
                patientId: claimData.patient_id,
                invoiceId: claimData.invoice_id
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error submitting insurance claim', { 
                error: error.message,
                patientId: claimData.patient_id,
                invoiceId: claimData.invoice_id
            });
            throw new Error(`Claim submission failed: ${error.message}`);
        }
    },

    /**
     * Check insurance coverage
     * @param {Object} coverageData - Coverage check data
     * @returns {Promise<Object>} Coverage details
     */
    async checkInsuranceCoverage(coverageData) {
        try {
            // TODO: Integrate with insurance API for real-time verification
            // For now, return mock data
            
            const coverage = {
                has_insurance: true,
                provider: coverageData.provider,
                policy_number: coverageData.policy_number,
                is_active: true,
                coverage_percentage: 70,
                deductible_met: true,
                copay: 0,
                pre_authorization_required: false,
                covered_services: ['consultation', 'lab_tests', 'radiology', 'pharmacy'],
                exclusions: ['cosmetic', 'experimental'],
                estimated_coverage: coverageData.estimated_amount * 0.7,
                patient_responsibility: coverageData.estimated_amount * 0.3,
                disclaimer: 'This is an estimate. Actual coverage may vary based on policy terms.'
            };

            // Log coverage check
            await db.query(
                `INSERT INTO coverage_checks (
                    patient_id, provider, service_type, estimated_amount,
                    coverage_percentage, covered_amount, checked_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                    coverageData.patient_id,
                    coverageData.provider,
                    coverageData.service_type,
                    coverageData.estimated_amount,
                    coverage.coverage_percentage,
                    coverage.estimated_coverage
                ]
            );

            return coverage;
        } catch (error) {
            logger.error('Error checking insurance coverage', { 
                error: error.message,
                patientId: coverageData.patient_id 
            });
            throw new Error(`Coverage check failed: ${error.message}`);
        }
    },

    /**
     * Verify insurance
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Verification result
     */
    async verifyInsurance(patientId) {
        try {
            const patient = await Patient.findById(patientId);
            
            if (!patient || !patient.insurance_provider || !patient.insurance_policy) {
                return {
                    verified: false,
                    message: 'No insurance details found'
                };
            }

            // TODO: Call insurance API for verification
            const verification = {
                verified: true,
                provider: patient.insurance_provider,
                policy_number: patient.insurance_policy,
                policy_holder: `${patient.first_name} ${patient.last_name}`,
                expiry_date: patient.insurance_expiry,
                status: patient.insurance_expiry > new Date() ? 'active' : 'expired',
                coverage_details: {
                    inpatient: '80% after deductible',
                    outpatient: '70% up to ₹50,000',
                    maternity: 'Covered after 24 months',
                    pre_existing: 'Covered after 24 months'
                }
            };

            return verification;
        } catch (error) {
            logger.error('Error verifying insurance', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Insurance verification failed: ${error.message}`);
        }
    },

    /**
     * Get billing summary
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object>} Billing summary
     */
    async getBillingSummary(patientId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                    SUM(total) as total_amount,
                    SUM(paid_amount) as total_paid,
                    SUM(total - paid_amount) as total_due
                FROM invoices
                WHERE patient_id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [patientId]);

            // Get recent transactions
            const recentQuery = `
                SELECT 'invoice' as type, id, invoice_number as reference, 
                       total as amount, status, issue_date as date
                FROM invoices
                WHERE patient_id = $1
                UNION ALL
                SELECT 'payment' as type, p.id, i.invoice_number as reference,
                       p.amount, 'completed' as status, p.payment_date as date
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE i.patient_id = $1
                ORDER BY date DESC
                LIMIT 10
            `;

            const recent = await db.query(recentQuery, [patientId]);

            return {
                summary: result.rows[0],
                recent_transactions: recent.rows,
                payment_methods: await this.getPaymentMethods(patientId)
            };
        } catch (error) {
            logger.error('Error getting billing summary', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get payment receipts
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Receipts list
     */
    async getPaymentReceipts(patientId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT p.*, i.invoice_number, i.total as invoice_total,
                       CONCAT(pt.first_name, ' ', pt.last_name) as patient_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN patients pt ON i.patient_id = pt.id
                WHERE i.patient_id = $1
                ORDER BY p.payment_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [patientId, limit, offset]);

            const total = await db.query(
                'SELECT COUNT(*) as count FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.patient_id = $1',
                [patientId]
            );

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting payment receipts', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Generate payment receipt PDF
     * @param {string} paymentId - Payment UUID
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Buffer>} PDF buffer
     */
    async generatePaymentReceiptPDF(paymentId, patientId) {
        try {
            const query = `
                SELECT p.*, i.invoice_number, i.total as invoice_total,
                       CONCAT(pt.first_name, ' ', pt.last_name) as patient_name,
                       pt.email, pt.phone, pt.address
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN patients pt ON i.patient_id = pt.id
                WHERE p.id = $1 AND i.patient_id = $2
            `;

            const result = await db.query(query, [paymentId, patientId]);

            if (result.rows.length === 0) {
                return null;
            }

            // TODO: Generate actual PDF
            logger.info('Receipt PDF generation requested', { paymentId });

            return Buffer.from(JSON.stringify(result.rows[0], null, 2));
        } catch (error) {
            logger.error('Error generating payment receipt PDF', { 
                error: error.message,
                paymentId,
                patientId 
            });
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }
};

module.exports = billingService;