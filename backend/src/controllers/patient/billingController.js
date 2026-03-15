/**
 * ======================================================================
 * FILE: backend/src/controllers/patient/billingController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient billing controller handling all financial operations.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /patient/invoices                    - All invoices
 * GET    /patient/invoices/pending               - Pending invoices
 * GET    /patient/invoices/paid                    - Paid invoices
 * GET    /patient/invoices/overdue                   - Overdue invoices
 * GET    /patient/invoices/:id                          - Get invoice by ID
 * GET    /patient/invoices/:id/pdf                        - Download invoice PDF
 * GET    /patient/invoices/:id/breakdown                    - Get invoice breakdown
 * GET    /patient/payments                                    - Payment history
 * GET    /patient/payments/:id                                   - Get payment by ID
 * POST   /patient/payments                                          - Make payment
 * POST   /patient/payments/online                                      - Process online payment
 * GET    /patient/payments/methods                                       - Saved payment methods
 * POST   /patient/payments/methods                                          - Add payment method
 * DELETE /patient/payments/methods/:id                                       - Delete payment method
 * GET    /patient/insurance                                                   - Insurance details
 * PUT    /patient/insurance                                                      - Update insurance
 * GET    /patient/insurance/claims                                                - Insurance claims
 * GET    /patient/insurance/claims/:id                                               - Get claim by ID
 * POST   /patient/insurance/claims                                                    - Submit claim
 * GET    /patient/insurance/coverage                                                    - Check coverage
 * GET    /patient/insurance/verification                                                  - Get verification
 * 
 * ======================================================================
 */

const patientService = require('../../services/patient/patientService');
const billingService = require('../../services/patient/billingService');
const logger = require('../../utils/logger');

/**
 * Patient Billing Controller
 */
const billingController = {
    // ============================================
    // INVOICE MANAGEMENT
    // ============================================

    /**
     * Get all invoices with filters
     * GET /api/v1/patient/invoices
     */
    async getInvoices(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                fromDate,
                toDate
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                fromDate,
                toDate
            };

            const invoices = await patientService.getInvoices(req.user.id, options);

            logger.info('Invoices retrieved', { 
                userId: req.user.id,
                count: invoices.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: invoices.data || invoices,
                summary: invoices.summary,
                pagination: invoices.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get pending invoices
     * GET /api/v1/patient/invoices/pending
     */
    async getPendingInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const invoices = await patientService.getInvoices(req.user.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                status: 'pending'
            });

            res.json({
                success: true,
                data: invoices.data || invoices,
                pagination: invoices.pagination,
                summary: {
                    total_pending: invoices.summary?.pending_count || 0,
                    total_amount: invoices.summary?.total_due || 0
                }
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get paid invoices
     * GET /api/v1/patient/invoices/paid
     */
    async getPaidInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const invoices = await patientService.getInvoices(req.user.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                status: 'paid'
            });

            res.json({
                success: true,
                data: invoices.data || invoices,
                pagination: invoices.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get overdue invoices
     * GET /api/v1/patient/invoices/overdue
     */
    async getOverdueInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const invoices = await patientService.getInvoices(req.user.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                status: 'overdue'
            });

            res.json({
                success: true,
                data: invoices.data || invoices,
                pagination: invoices.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get invoice by ID
     * GET /api/v1/patient/invoices/:id
     */
    async getInvoiceById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const invoice = await billingService.getInvoiceById(id, patient.id);

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            logger.info('Invoice retrieved by ID', {
                userId: req.user.id,
                invoiceId: id
            });

            res.json({
                success: true,
                data: invoice
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Download invoice PDF
     * GET /api/v1/patient/invoices/:id/pdf
     */
    async downloadInvoicePDF(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const pdfBuffer = await billingService.generateInvoicePDF(id, patient.id);

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            logger.info('Invoice PDF downloaded', {
                userId: req.user.id,
                invoiceId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get invoice breakdown (itemized charges)
     * GET /api/v1/patient/invoices/:id/breakdown
     */
    async getInvoiceBreakdown(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const breakdown = await billingService.getInvoiceBreakdown(id, patient.id);

            if (!breakdown) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            res.json({
                success: true,
                data: breakdown
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // PAYMENT MANAGEMENT
    // ============================================

    /**
     * Get payment history
     * GET /api/v1/patient/payments
     */
    async getPayments(req, res, next) {
        try {
            const { page = 1, limit = 20, fromDate, toDate } = req.query;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const payments = await billingService.getPayments(patient.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                fromDate,
                toDate
            });

            logger.info('Payments retrieved', {
                userId: req.user.id,
                count: payments.data?.length || 0
            });

            res.json({
                success: true,
                data: payments.data || payments,
                pagination: payments.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get payment by ID
     * GET /api/v1/patient/payments/:id
     */
    async getPaymentById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const payment = await billingService.getPaymentById(id, patient.id);

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            res.json({
                success: true,
                data: payment
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Make payment (cash/offline)
     * POST /api/v1/patient/payments
     */
    async makePayment(req, res, next) {
        try {
            const { 
                invoiceId, 
                amount, 
                paymentMethod,
                cardLastFour,
                bankName,
                referenceNumber
            } = req.body;

            // Validate required fields
            if (!invoiceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice ID is required'
                });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            if (!paymentMethod) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment method is required'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            // Verify invoice belongs to patient
            const invoice = await billingService.getInvoiceById(invoiceId, patient.id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            // Check if amount is valid
            const dueAmount = invoice.total - invoice.paid_amount;
            if (amount > dueAmount) {
                return res.status(400).json({
                    success: false,
                    error: `Payment amount (${amount}) exceeds due amount (${dueAmount})`
                });
            }

            const payment = await billingService.processPayment({
                invoice_id: invoiceId,
                patient_id: patient.id,
                amount,
                payment_method: paymentMethod,
                card_last_four: cardLastFour,
                bank_name: bankName,
                reference_number: referenceNumber,
                ip: req.ip,
                user_agent: req.headers['user-agent']
            });

            logger.info('Payment processed', {
                userId: req.user.id,
                invoiceId,
                amount,
                paymentMethod
            });

            res.status(201).json({
                success: true,
                data: payment,
                message: 'Payment processed successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message.includes('already paid')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Process online payment (via payment gateway)
     * POST /api/v1/patient/payments/online
     */
    async processOnlinePayment(req, res, next) {
        try {
            const { 
                invoiceId, 
                amount,
                paymentGateway,
                successUrl,
                cancelUrl
            } = req.body;

            // Validate required fields
            if (!invoiceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice ID is required'
                });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            if (!paymentGateway) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment gateway is required'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            // Verify invoice
            const invoice = await billingService.getInvoiceById(invoiceId, patient.id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            // Initiate online payment
            const paymentSession = await billingService.initiateOnlinePayment({
                invoice_id: invoiceId,
                patient_id: patient.id,
                amount,
                payment_gateway: paymentGateway,
                success_url: successUrl,
                cancel_url: cancelUrl,
                customer_details: {
                    name: `${patient.first_name} ${patient.last_name}`,
                    email: patient.email,
                    phone: patient.phone
                }
            });

            logger.info('Online payment initiated', {
                userId: req.user.id,
                invoiceId,
                amount,
                gateway: paymentGateway
            });

            res.json({
                success: true,
                data: paymentSession,
                message: 'Payment session created'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Verify online payment (webhook callback)
     * POST /api/v1/patient/payments/online/verify
     */
    async verifyOnlinePayment(req, res, next) {
        try {
            const { 
                sessionId,
                paymentId,
                status,
                signature
            } = req.body;

            // This endpoint would typically be called by payment gateway webhook
            // Or frontend after successful payment

            const verification = await billingService.verifyOnlinePayment({
                session_id: sessionId,
                payment_id: paymentId,
                status,
                signature
            });

            logger.info('Online payment verified', {
                sessionId,
                paymentId,
                status
            });

            res.json({
                success: true,
                data: verification
            });
        } catch (error) {
            next(error);
        }
    },

    // ============================================
    // PAYMENT METHODS
    // ============================================

    /**
     * Get saved payment methods
     * GET /api/v1/patient/payments/methods
     */
    async getPaymentMethods(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const methods = await billingService.getPaymentMethods(patient.id);

            res.json({
                success: true,
                data: methods
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Add payment method
     * POST /api/v1/patient/payments/methods
     */
    async addPaymentMethod(req, res, next) {
        try {
            const { 
                type,
                cardNumber,
                cardHolderName,
                expiryMonth,
                expiryYear,
                cvv,
                bankName,
                accountNumber,
                ifscCode,
                upiId
            } = req.body;

            if (!type) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment method type is required'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const method = await billingService.addPaymentMethod({
                patient_id: patient.id,
                type,
                card_number: type === 'card' ? cardNumber : null,
                card_holder_name: type === 'card' ? cardHolderName : null,
                expiry_month: type === 'card' ? expiryMonth : null,
                expiry_year: type === 'card' ? expiryYear : null,
                bank_name: type === 'bank' ? bankName : null,
                account_number: type === 'bank' ? accountNumber : null,
                ifsc_code: type === 'bank' ? ifscCode : null,
                upi_id: type === 'upi' ? upiId : null,
                ip: req.ip,
                user_agent: req.headers['user-agent']
            });

            logger.info('Payment method added', {
                userId: req.user.id,
                methodType: type
            });

            res.status(201).json({
                success: true,
                data: method,
                message: 'Payment method added successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Delete payment method
     * DELETE /api/v1/patient/payments/methods/:id
     */
    async deletePaymentMethod(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            await billingService.deletePaymentMethod(id, patient.id);

            logger.info('Payment method deleted', {
                userId: req.user.id,
                methodId: id
            });

            res.json({
                success: true,
                message: 'Payment method deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Payment method not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Payment method not found'
                });
            }
            next(error);
        }
    },

    /**
     * Set default payment method
     * PUT /api/v1/patient/payments/methods/:id/default
     */
    async setDefaultPaymentMethod(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const method = await billingService.setDefaultPaymentMethod(id, patient.id);

            logger.info('Default payment method set', {
                userId: req.user.id,
                methodId: id
            });

            res.json({
                success: true,
                data: method,
                message: 'Default payment method updated'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Payment method not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Payment method not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // INSURANCE MANAGEMENT
    // ============================================

    /**
     * Get insurance details
     * GET /api/v1/patient/insurance
     */
    async getInsuranceDetails(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const insurance = {
                provider: patient.insurance_provider,
                policy_number: patient.insurance_policy,
                expiry_date: patient.insurance_expiry,
                is_active: patient.insurance_expiry ? new Date(patient.insurance_expiry) > new Date() : false
            };

            res.json({
                success: true,
                data: insurance
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Update insurance details
     * PUT /api/v1/patient/insurance
     */
    async updateInsurance(req, res, next) {
        try {
            const { 
                provider, 
                policyNumber, 
                expiryDate,
                groupNumber,
                relationship,
                dependentName
            } = req.body;

            if (!provider || !policyNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Provider and policy number are required'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const updates = {
                insurance_provider: provider,
                insurance_policy: policyNumber,
                insurance_expiry: expiryDate
            };

            const updated = await patientService.updatePatientProfile(
                req.user.id,
                updates,
                req.user.id
            );

            logger.info('Insurance details updated', {
                userId: req.user.id,
                provider
            });

            res.json({
                success: true,
                data: {
                    provider: updated.insurance_provider,
                    policy_number: updated.insurance_policy,
                    expiry_date: updated.insurance_expiry
                },
                message: 'Insurance details updated successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get insurance claims
     * GET /api/v1/patient/insurance/claims
     */
    async getInsuranceClaims(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const claims = await billingService.getInsuranceClaims(patient.id, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            logger.info('Insurance claims retrieved', {
                userId: req.user.id,
                count: claims.data?.length || 0
            });

            res.json({
                success: true,
                data: claims.data || claims,
                pagination: claims.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get insurance claim by ID
     * GET /api/v1/patient/insurance/claims/:id
     */
    async getInsuranceClaimById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const claim = await billingService.getInsuranceClaimById(id, patient.id);

            if (!claim) {
                return res.status(404).json({
                    success: false,
                    error: 'Insurance claim not found'
                });
            }

            res.json({
                success: true,
                data: claim
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Submit insurance claim
     * POST /api/v1/patient/insurance/claims
     */
    async submitInsuranceClaim(req, res, next) {
        try {
            const { 
                invoiceId,
                diagnosis,
                procedureCodes,
                documents
            } = req.body;

            if (!invoiceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice ID is required'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            // Verify invoice belongs to patient
            const invoice = await billingService.getInvoiceById(invoiceId, patient.id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            // Check if patient has insurance
            if (!patient.insurance_provider || !patient.insurance_policy) {
                return res.status(400).json({
                    success: false,
                    error: 'No insurance details found. Please update insurance information first.'
                });
            }

            const claim = await billingService.submitInsuranceClaim({
                patient_id: patient.id,
                invoice_id: invoiceId,
                provider: patient.insurance_provider,
                policy_number: patient.insurance_policy,
                diagnosis,
                procedure_codes: procedureCodes,
                documents,
                amount: invoice.total,
                submitted_at: new Date()
            });

            logger.info('Insurance claim submitted', {
                userId: req.user.id,
                invoiceId,
                claimId: claim.id
            });

            res.status(201).json({
                success: true,
                data: claim,
                message: 'Insurance claim submitted successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Check insurance coverage
     * GET /api/v1/patient/insurance/coverage
     */
    async checkCoverage(req, res, next) {
        try {
            const { serviceType, estimatedAmount } = req.query;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            if (!patient.insurance_provider || !patient.insurance_policy) {
                return res.json({
                    success: true,
                    data: {
                        has_insurance: false,
                        message: 'No insurance details found'
                    }
                });
            }

            const coverage = await billingService.checkInsuranceCoverage({
                patient_id: patient.id,
                provider: patient.insurance_provider,
                policy_number: patient.insurance_policy,
                service_type: serviceType,
                estimated_amount: parseFloat(estimatedAmount) || 0
            });

            res.json({
                success: true,
                data: coverage
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get insurance verification
     * GET /api/v1/patient/insurance/verification
     */
    async getInsuranceVerification(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            if (!patient.insurance_provider || !patient.insurance_policy) {
                return res.status(404).json({
                    success: false,
                    error: 'No insurance details found'
                });
            }

            const verification = await billingService.verifyInsurance(patient.id);

            res.json({
                success: true,
                data: verification
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // BILLING SUMMARY & REPORTS
    // ============================================

    /**
     * Get billing summary
     * GET /api/v1/patient/billing/summary
     */
    async getBillingSummary(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const summary = await billingService.getBillingSummary(patient.id);

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get payment receipts
     * GET /api/v1/patient/billing/receipts
     */
    async getPaymentReceipts(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const receipts = await billingService.getPaymentReceipts(patient.id, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                data: receipts.data || receipts,
                pagination: receipts.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Download payment receipt
     * GET /api/v1/patient/billing/receipts/:id/pdf
     */
    async downloadPaymentReceipt(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const pdfBuffer = await billingService.generatePaymentReceiptPDF(id, patient.id);

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment receipt not found'
                });
            }

            logger.info('Payment receipt downloaded', {
                userId: req.user.id,
                receiptId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=receipt-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    }
};

module.exports = billingController;

/**
 * ======================================================================
 * USAGE IN ROUTES:
 * ======================================================================
 * 
 * const billingController = require('./controllers/patient/billingController');
 * const authenticate = require('../middlewares/auth');
 * const validate = require('../middlewares/validator');
 * const { 
 *     validatePayment,
 *     validateInsuranceUpdate,
 *     validateClaimSubmission 
 * } = require('../validators/patientValidators');
 * 
 * // Invoice routes
 * router.get('/invoices', authenticate, billingController.getInvoices);
 * router.get('/invoices/pending', authenticate, billingController.getPendingInvoices);
 * router.get('/invoices/paid', authenticate, billingController.getPaidInvoices);
 * router.get('/invoices/overdue', authenticate, billingController.getOverdueInvoices);
 * router.get('/invoices/:id', authenticate, billingController.getInvoiceById);
 * router.get('/invoices/:id/pdf', authenticate, billingController.downloadInvoicePDF);
 * router.get('/invoices/:id/breakdown', authenticate, billingController.getInvoiceBreakdown);
 * 
 * // Payment routes
 * router.get('/payments', authenticate, billingController.getPayments);
 * router.get('/payments/:id', authenticate, billingController.getPaymentById);
 * router.post('/payments', authenticate, validate(validatePayment), billingController.makePayment);
 * router.post('/payments/online', authenticate, billingController.processOnlinePayment);
 * router.post('/payments/online/verify', billingController.verifyOnlinePayment);
 * 
 * // Payment methods
 * router.get('/payments/methods', authenticate, billingController.getPaymentMethods);
 * router.post('/payments/methods', authenticate, billingController.addPaymentMethod);
 * router.delete('/payments/methods/:id', authenticate, billingController.deletePaymentMethod);
 * router.put('/payments/methods/:id/default', authenticate, billingController.setDefaultPaymentMethod);
 * 
 * // Insurance routes
 * router.get('/insurance', authenticate, billingController.getInsuranceDetails);
 * router.put('/insurance', authenticate, validate(validateInsuranceUpdate), billingController.updateInsurance);
 * router.get('/insurance/claims', authenticate, billingController.getInsuranceClaims);
 * router.get('/insurance/claims/:id', authenticate, billingController.getInsuranceClaimById);
 * router.post('/insurance/claims', authenticate, validate(validateClaimSubmission), billingController.submitInsuranceClaim);
 * router.get('/insurance/coverage', authenticate, billingController.checkCoverage);
 * router.get('/insurance/verification', authenticate, billingController.getInsuranceVerification);
 * 
 * // Billing summary
 * router.get('/billing/summary', authenticate, billingController.getBillingSummary);
 * router.get('/billing/receipts', authenticate, billingController.getPaymentReceipts);
 * router.get('/billing/receipts/:id/pdf', authenticate, billingController.downloadPaymentReceipt);
 * 
 * ======================================================================
 */