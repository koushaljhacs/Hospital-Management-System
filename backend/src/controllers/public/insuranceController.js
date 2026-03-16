/**
 * ======================================================================
 * FILE: backend/src/controllers/public/insuranceController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public insurance controller - No authentication required.
 * Endpoints: /public/insurance/providers, /public/insurance/providers/:id
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const insuranceController = {
    /**
     * List insurance providers
     * GET /api/v1/public/insurance/providers
     */
    async listProviders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    id, name, code, logo_url,
                    type, website, phone, email,
                    coverage_percentage, description,
                    network_type, is_cashless, is_reimbursement
                FROM insurance_providers
                WHERE status = 'active' AND is_deleted = false
                ORDER BY name ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM insurance_providers
                WHERE status = 'active' AND is_deleted = false
            `;
            const countResult = await db.query(countQuery);

            logger.info('Public list insurance providers accessed', {
                count: result.rows.length
            });

            res.json({
                success: true,
                data: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
                }
            });
        } catch (error) {
            logger.error('Error in public list insurance providers', { error: error.message });
            next(error);
        }
    },

    /**
     * Get insurance provider details by ID
     * GET /api/v1/public/insurance/providers/:id
     */
    async getProviderDetails(req, res, next) {
        try {
            const { id } = req.params;

            const query = `
                SELECT 
                    id, name, code, logo_url,
                    type, website, phone, email, address,
                    coverage_percentage, coverage_details,
                    exclusions, pre_approval_required,
                    pre_approval_days, claim_deadline_days,
                    max_claim_amount, annual_maximum, lifetime_maximum,
                    deductible_amount, copay_percentage,
                    network_type, is_cashless, is_reimbursement,
                    support_phone, support_email, emergency_phone,
                    claims_phone, claims_email, portal_url,
                    network_providers, cashless_hospitals
                FROM insurance_providers
                WHERE id = $1 AND status = 'active' AND is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Insurance provider not found'
                });
            }

            // Get popular network hospitals (first 10 for display)
            const provider = result.rows[0];
            let networkHospitals = [];
            
            if (provider.cashless_hospitals) {
                const hospitalIds = provider.cashless_hospitals.slice(0, 10);
                if (hospitalIds.length > 0) {
                    const hospitalsQuery = `
                        SELECT id, name, address, city, phone
                        FROM hospitals
                        WHERE id = ANY($1::uuid[])
                    `;
                    const hospitals = await db.query(hospitalsQuery, [hospitalIds]);
                    networkHospitals = hospitals.rows;
                }
            }

            logger.info('Public insurance provider details accessed', { providerId: id });

            res.json({
                success: true,
                data: {
                    ...provider,
                    network_hospitals: networkHospitals
                }
            });
        } catch (error) {
            logger.error('Error in public insurance provider details', { 
                error: error.message, 
                providerId: req.params.id 
            });
            next(error);
        }
    }
};

module.exports = insuranceController;