/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/insuranceClaimController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing insurance claim controller - Handles insurance claim management.
 * Total Endpoints: 7
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-33] Insurance claim requires pre-authorization
 * 
 * ======================================================================
 */

const insuranceClaimService = require('../../services/billing/insuranceClaimService');
const logger = require('../../utils/logger');

const insuranceClaimController = {
    // ============================================
    // CLAIM LISTS
    // ============================================

    /**
     * Get all insurance claims
     * GET /api/v1/billing/insurance-claims
     */
    async getAllClaims(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                insurance_provider_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                insurance_provider_id,
                from_date,
                to_date
            };

            const claims = await insuranceClaimService.getAllClaims(
                req.user.id,
                options
            );

            logger.info('Billing staff retrieved insurance claims', {
                staffId: req.user.id,
                count: claims.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Calculate summary
            const summary = {
                total: claims.summary?.total || 0,
                total_amount: claims.summary?.total_amount || 0,
                approved_amount: claims.summary?.approved_amount || 0,
                paid_amount: claims.summary?.paid_amount || 0,
                pending_amount: claims.summary?.pending_amount || 0,
                rejected_amount: claims.summary?.rejected_amount || 0,
                by_status: {
                    draft: claims.data?.filter(c => c.status === 'draft').length || 0,
                    submitted: claims.data?.filter(c => c.status === 'submitted').length || 0,
                    processing: claims.data?.filter(c => c.status === 'processing').length || 0,
                    approved: claims.data?.filter(c => c.status === 'approved').length || 0,
                    rejected: claims.data?.filter(c => c.status === 'rejected').length || 0,
                    paid: claims.data?.filter(c => c.status === 'paid').length || 0
                }
            };

            res.json({
                success: true,
                data: claims.data,
                pagination: claims.pagination,
                summary
            });
        } catch (error) {
            logger.error('Error getting all claims', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get draft claims
     * GET /api/v1/billing/insurance-claims/draft
     */
    async getDraftClaims(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const claims = await insuranceClaimService.getClaimsByStatus(
                req.user.id,
                'draft',
                options
            );

            logger.info('Billing staff viewed draft claims', {
                staffId: req.user.id,
                count: claims.data?.length || 0
            });

            res.json({
                success: true,
                data: claims.data,
                pagination: claims.pagination,
                summary: {
                    total: claims.summary?.total || 0,
                    total_amount: claims.data?.reduce((sum, c) => sum + parseFloat(c.claim_amount), 0) || 0
                }
            });
        } catch (error) {
            logger.error('Error getting draft claims', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get submitted claims
     * GET /api/v1/billing/insurance-claims/submitted
     */
    async getSubmittedClaims(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const claims = await insuranceClaimService.getClaimsByStatus(
                req.user.id,
                ['submitted', 'processing'],
                options
            );

            logger.info('Billing staff viewed submitted claims', {
                staffId: req.user.id,
                count: claims.data?.length || 0
            });

            res.json({
                success: true,
                data: claims.data,
                pagination: claims.pagination,
                summary: {
                    total: claims.summary?.total || 0,
                    total_amount: claims.data?.reduce((sum, c) => sum + parseFloat(c.claim_amount), 0) || 0,
                    avg_processing_days: claims.summary?.avg_processing_days || 0
                }
            });
        } catch (error) {
            logger.error('Error getting submitted claims', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get approved claims
     * GET /api/v1/billing/insurance-claims/approved
     */
    async getApprovedClaims(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const claims = await insuranceClaimService.getClaimsByStatus(
                req.user.id,
                ['approved', 'paid'],
                options
            );

            logger.info('Billing staff viewed approved claims', {
                staffId: req.user.id,
                count: claims.data?.length || 0
            });

            res.json({
                success: true,
                data: claims.data,
                pagination: claims.pagination,
                summary: {
                    total: claims.summary?.total || 0,
                    total_amount: claims.data?.reduce((sum, c) => sum + parseFloat(c.claim_amount), 0) || 0,
                    paid_amount: claims.data?.filter(c => c.status === 'paid')
                        .reduce((sum, c) => sum + parseFloat(c.paid_amount || 0), 0) || 0
                }
            });
        } catch (error) {
            logger.error('Error getting approved claims', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get rejected claims
     * GET /api/v1/billing/insurance-claims/rejected
     */
    async getRejectedClaims(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const claims = await insuranceClaimService.getClaimsByStatus(
                req.user.id,
                'rejected',
                options
            );

            logger.info('Billing staff viewed rejected claims', {
                staffId: req.user.id,
                count: claims.data?.length || 0
            });

            res.json({
                success: true,
                data: claims.data,
                pagination: claims.pagination,
                summary: {
                    total: claims.summary?.total || 0,
                    total_amount: claims.data?.reduce((sum, c) => sum + parseFloat(c.claim_amount), 0) || 0,
                    rejection_reasons: claims.data?.reduce((acc, c) => {
                        const reason = c.rejection_reason || 'Unknown';
                        acc[reason] = (acc[reason] || 0) + 1;
                        return acc;
                    }, {})
                }
            });
        } catch (error) {
            logger.error('Error getting rejected claims', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get claim by ID
     * GET /api/v1/billing/insurance-claims/:id
     */
    async getClaimById(req, res, next) {
        try {
            const { id } = req.params;

            const claim = await insuranceClaimService.getClaimById(
                req.user.id,
                id
            );

            if (!claim) {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }

            logger.info('Billing staff viewed claim details', {
                staffId: req.user.id,
                claimId: id,
                patientId: claim.patient_id,
                providerId: claim.insurance_provider_id,
                amount: claim.claim_amount,
                status: claim.status
            });

            // Get claim history
            const history = await insuranceClaimService.getClaimHistory(
                req.user.id,
                id
            );
            claim.history = history;

            // Get related invoice details
            if (claim.invoice_id) {
                const invoice = await insuranceClaimService.getRelatedInvoice(
                    req.user.id,
                    claim.invoice_id
                );
                claim.invoice = invoice;
            }

            // Get insurance provider details
            const provider = await insuranceClaimService.getInsuranceProvider(
                req.user.id,
                claim.insurance_provider_id
            );
            claim.insurance_provider = provider;

            res.json({
                success: true,
                data: claim
            });
        } catch (error) {
            if (error.message === 'Claim not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }
            logger.error('Error getting claim by ID', {
                error: error.message,
                staffId: req.user.id,
                claimId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CLAIM OPERATIONS
    // ============================================

    /**
     * Create insurance claim
     * POST /api/v1/billing/insurance-claims
     * 
     * BUSINESS RULE: [BR-33] Insurance claim requires pre-authorization
     */
    async createClaim(req, res, next) {
        try {
            const {
                patient_id,
                invoice_id,
                insurance_provider_id,
                policy_number,
                claim_amount,
                pre_authorization_number,
                notes,
                documents
            } = req.body;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!insurance_provider_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Insurance provider ID is required'
                });
            }

            if (!policy_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Policy number is required'
                });
            }

            if (!claim_amount || claim_amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid claim amount is required'
                });
            }

            // [BR-33] Check if pre-authorization is required and provided
            const provider = await insuranceClaimService.getInsuranceProvider(
                req.user.id,
                insurance_provider_id
            );

            if (provider && provider.requires_pre_authorization && !pre_authorization_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Pre-authorization number is required for this insurance provider'
                });
            }

            // Validate patient has active insurance
            const patientInsurance = await insuranceClaimService.validatePatientInsurance(
                req.user.id,
                patient_id,
                insurance_provider_id
            );

            if (!patientInsurance) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient does not have active insurance with this provider'
                });
            }

            // Validate claim amount against coverage limits
            const coverageCheck = await insuranceClaimService.validateCoverageLimit(
                req.user.id,
                patient_id,
                insurance_provider_id,
                claim_amount
            );

            if (coverageCheck && !coverageCheck.is_covered) {
                return res.status(400).json({
                    success: false,
                    error: `Claim amount exceeds coverage limit. Maximum: ${coverageCheck.max_coverage}`
                });
            }

            const claim = await insuranceClaimService.createClaim(
                req.user.id,
                {
                    patient_id,
                    invoice_id,
                    insurance_provider_id,
                    policy_number,
                    claim_amount,
                    pre_authorization_number,
                    notes,
                    documents,
                    created_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing staff created insurance claim', {
                staffId: req.user.id,
                claimId: claim.id,
                patientId: patient_id,
                providerId: insurance_provider_id,
                amount: claim_amount
            });

            res.status(201).json({
                success: true,
                data: claim,
                message: 'Insurance claim created successfully'
            });
        } catch (error) {
            logger.error('Error creating insurance claim', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update insurance claim
     * PUT /api/v1/billing/insurance-claims/:id
     */
    async updateClaim(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const claim = await insuranceClaimService.getClaimById(req.user.id, id);
            
            if (!claim) {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }

            // Only draft claims can be updated
            if (claim.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot update claim with status: ${claim.status}`
                });
            }

            // If updating claim amount, validate coverage again
            if (updates.claim_amount && updates.claim_amount !== claim.claim_amount) {
                const coverageCheck = await insuranceClaimService.validateCoverageLimit(
                    req.user.id,
                    claim.patient_id,
                    claim.insurance_provider_id,
                    updates.claim_amount
                );

                if (coverageCheck && !coverageCheck.is_covered) {
                    return res.status(400).json({
                        success: false,
                        error: `Claim amount exceeds coverage limit. Maximum: ${coverageCheck.max_coverage}`
                    });
                }
            }

            const updated = await insuranceClaimService.updateClaim(
                req.user.id,
                id,
                {
                    ...updates,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Billing staff updated insurance claim', {
                staffId: req.user.id,
                claimId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updated,
                message: 'Claim updated successfully'
            });
        } catch (error) {
            if (error.message === 'Claim not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }
            logger.error('Error updating insurance claim', {
                error: error.message,
                staffId: req.user.id,
                claimId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Submit insurance claim
     * PUT /api/v1/billing/insurance-claims/:id/submit
     */
    async submitClaim(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const claim = await insuranceClaimService.getClaimById(req.user.id, id);
            
            if (!claim) {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }

            if (claim.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot submit claim with status: ${claim.status}`
                });
            }

            const submitted = await insuranceClaimService.submitClaim(
                req.user.id,
                id,
                {
                    notes,
                    submitted_at: new Date(),
                    submitted_by: req.user.id
                }
            );

            logger.info('Billing staff submitted insurance claim', {
                staffId: req.user.id,
                claimId: id,
                amount: claim.claim_amount
            });

            res.json({
                success: true,
                data: submitted,
                message: 'Claim submitted to insurance provider'
            });
        } catch (error) {
            if (error.message === 'Claim not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }
            logger.error('Error submitting insurance claim', {
                error: error.message,
                staffId: req.user.id,
                claimId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Track claim status
     * PUT /api/v1/billing/insurance-claims/:id/track
     */
    async trackClaim(req, res, next) {
        try {
            const { id } = req.params;
            const { status, notes, amount_approved } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const validStatuses = ['processing', 'approved', 'rejected', 'paid'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status value'
                });
            }

            const claim = await insuranceClaimService.getClaimById(req.user.id, id);
            
            if (!claim) {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }

            if (claim.status === 'draft') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot track claim that has not been submitted'
                });
            }

            const tracked = await insuranceClaimService.trackClaim(
                req.user.id,
                id,
                {
                    status,
                    notes,
                    amount_approved,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Billing staff updated claim status', {
                staffId: req.user.id,
                claimId: id,
                oldStatus: claim.status,
                newStatus: status
            });

            res.json({
                success: true,
                data: tracked,
                message: `Claim status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'Claim not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Claim not found'
                });
            }
            logger.error('Error tracking insurance claim', {
                error: error.message,
                staffId: req.user.id,
                claimId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = insuranceClaimController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Claim Lists            | 5         | All, draft, submitted, approved, rejected, by ID
 * Claim Operations       | 3         | Create, update, submit
 * Claim Tracking         | 1         | Track status
 * -----------------------|-----------|----------------------
 * TOTAL                  | 9         | Complete insurance claim management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-33] Pre-authorization validation
 * 
 * ======================================================================
 */