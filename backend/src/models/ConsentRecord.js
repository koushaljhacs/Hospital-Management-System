/**
 * ======================================================================
 * FILE: backend/src/models/ConsentRecord.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Consent record model for managing patient consents.
 * Handles GDPR/ HIPAA compliance for data sharing and treatment consent.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * TABLE: consent_records
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients.id)
 * - consent_type: string (treatment/data_sharing/marketing/research)
 * - consent_version: string
 * - consent_text: text
 * - is_granted: boolean
 * - granted_at: timestamp
 * - expires_at: timestamp
 * - revoked_at: timestamp
 * - revocation_reason: text
 * - ip_address: inet
 * - user_agent: text
 * - document_url: text
 * - created_at: timestamp
 * - updated_at: timestamp
 * - created_by: UUID (foreign key to users.id)
 * - is_deleted: boolean
 * 
 * RELATIONSHIPS:
 * - One consent belongs to one patient
 * - One consent has many consent logs
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Consent types supported by the system
 */
const CONSENT_TYPES = [
    'treatment',
    'data_sharing',
    'marketing',
    'research',
    'telemedicine',
    'emergency_contact',
    'insurance_claim',
    'third_party_access'
];

/**
 * ConsentRecord model with database operations
 */
const ConsentRecord = {
    /**
     * Table name
     */
    tableName: 'consent_records',

    /**
     * Find consent by ID
     * @param {string} id - Consent UUID
     * @returns {Promise<Object>} Consent record
     */
    async findById(id) {
        try {
            const query = `
                SELECT cr.*, 
                       p.first_name, p.last_name, p.email as patient_email
                FROM consent_records cr
                JOIN patients p ON cr.patient_id = p.id
                WHERE cr.id = $1 AND cr.is_deleted = false
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Consent record found by ID', { consentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding consent record by ID', { 
                error: error.message,
                consentId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all consents for a patient
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of consents
     */
    async getByPatient(patientId, options = {}) {
        try {
            const { includeRevoked = false, type } = options;

            let query = `
                SELECT * FROM consent_records
                WHERE patient_id = $1 AND is_deleted = false
            `;
            const values = [patientId];
            let paramIndex = 2;

            if (!includeRevoked) {
                query += ` AND revoked_at IS NULL`;
            }

            if (type) {
                query += ` AND consent_type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            query += ` ORDER BY created_at DESC`;

            const result = await db.query(query, values);
            
            logger.debug('Consents retrieved for patient', { 
                patientId,
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting consents by patient', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active consents for a patient
     * @param {string} patientId - Patient UUID
     * @param {string} consentType - Consent type (optional)
     * @returns {Promise<Array>} List of active consents
     */
    async getActiveByPatient(patientId, consentType = null) {
        try {
            let query = `
                SELECT * FROM consent_records
                WHERE patient_id = $1 
                    AND is_granted = true 
                    AND revoked_at IS NULL
                    AND (expires_at IS NULL OR expires_at > NOW())
                    AND is_deleted = false
            `;
            const values = [patientId];

            if (consentType) {
                query += ` AND consent_type = $2`;
                values.push(consentType);
            }

            query += ` ORDER BY created_at DESC`;

            const result = await db.query(query, values);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting active consents', { 
                error: error.message,
                patientId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check if patient has specific consent
     * @param {string} patientId - Patient UUID
     * @param {string} consentType - Consent type
     * @returns {Promise<boolean>} True if consent exists and is active
     */
    async hasActiveConsent(patientId, consentType) {
        try {
            const result = await db.query(`
                SELECT EXISTS(
                    SELECT 1 FROM consent_records
                    WHERE patient_id = $1 
                        AND consent_type = $2
                        AND is_granted = true
                        AND revoked_at IS NULL
                        AND (expires_at IS NULL OR expires_at > NOW())
                        AND is_deleted = false
                ) as has_consent
            `, [patientId, consentType]);

            return result.rows[0].has_consent;
        } catch (error) {
            logger.error('Error checking consent', { 
                error: error.message,
                patientId,
                consentType 
            });
            return false;
        }
    },

    /**
     * Create new consent record
     * @param {Object} consentData - Consent data
     * @param {string} createdBy - User ID creating the record
     * @returns {Promise<Object>} Created consent record
     */
    async create(consentData, createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Validate consent type
            if (!CONSENT_TYPES.includes(consentData.consent_type)) {
                throw new Error(`Invalid consent type. Must be one of: ${CONSENT_TYPES.join(', ')}`);
            }

            // If granting new consent, check if there's an existing active consent
            if (consentData.is_granted) {
                const existing = await this.getActiveByPatient(
                    consentData.patient_id, 
                    consentData.consent_type
                );

                // Revoke existing active consent
                for (const consent of existing) {
                    await client.query(`
                        UPDATE consent_records 
                        SET revoked_at = NOW(),
                            updated_at = NOW()
                        WHERE id = $1
                    `, [consent.id]);

                    // Log the revocation
                    await client.query(`
                        INSERT INTO consent_logs (
                            consent_id, action, performed_by, ip_address, user_agent, changes
                        ) VALUES ($1, 'auto_revoked', $2, $3, $4, $5)
                    `, [consent.id, createdBy, consentData.ip_address, consentData.user_agent, 
                        JSON.stringify({ reason: 'New consent granted' })]);
                }
            }

            const query = `
                INSERT INTO consent_records (
                    patient_id, consent_type, consent_version, consent_text,
                    is_granted, granted_at, expires_at,
                    ip_address, user_agent, document_url,
                    created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                RETURNING *
            `;

            const values = [
                consentData.patient_id,
                consentData.consent_type,
                consentData.consent_version || '1.0',
                consentData.consent_text || null,
                consentData.is_granted || true,
                consentData.is_granted ? new Date() : null,
                consentData.expires_at || null,
                consentData.ip_address,
                consentData.user_agent,
                consentData.document_url || null,
                createdBy
            ];

            const result = await client.query(query, values);

            // Log the consent creation
            await client.query(`
                INSERT INTO consent_logs (
                    consent_id, action, performed_by, ip_address, user_agent, changes
                ) VALUES ($1, 'created', $2, $3, $4, $5)
            `, [result.rows[0].id, createdBy, consentData.ip_address, consentData.user_agent,
                JSON.stringify({ consent: result.rows[0] })]);

            await db.commitTransaction(client);

            logger.info('Consent record created', { 
                consentId: result.rows[0].id,
                patientId: consentData.patient_id,
                type: consentData.consent_type,
                granted: consentData.is_granted,
                createdBy
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating consent record', { 
                error: error.message,
                patientId: consentData.patient_id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update consent
     * @param {string} id - Consent ID
     * @param {Object} updates - Fields to update
     * @param {string} updatedBy - User ID performing update
     * @returns {Promise<Object>} Updated consent
     */
    async update(id, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get current consent for audit
            const current = await this.findById(id);
            if (!current) {
                throw new Error('Consent record not found');
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Allowed update fields
            const allowedFields = [
                'consent_version', 'consent_text', 'expires_at'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            // Add updated_at
            setClause.push(`updated_at = NOW()`);

            if (setClause.length === 1) {
                throw new Error('No valid fields to update');
            }

            // Add ID as last parameter
            values.push(id);

            const query = `
                UPDATE consent_records 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            // Log the update
            await client.query(`
                INSERT INTO consent_logs (
                    consent_id, action, performed_by, ip_address, user_agent, changes
                ) VALUES ($1, 'updated', $2, $3, $4, $5)
            `, [id, updatedBy, updates.ip_address, updates.user_agent,
                JSON.stringify({ old: current, new: result.rows[0] })]);

            await db.commitTransaction(client);

            logger.info('Consent record updated', { 
                consentId: id,
                updatedBy,
                updates: Object.keys(updates)
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating consent record', { 
                error: error.message,
                consentId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Revoke consent
     * @param {string} id - Consent ID
     * @param {string} reason - Revocation reason
     * @param {string} revokedBy - User ID revoking consent
     * @param {Object} metadata - Additional metadata
     */
    async revoke(id, reason, revokedBy, metadata = {}) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE consent_records 
                SET revoked_at = NOW(),
                    revocation_reason = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false AND revoked_at IS NULL
                RETURNING *
            `;

            const result = await client.query(query, [reason, id]);

            if (result.rows.length === 0) {
                throw new Error('Consent record not found or already revoked');
            }

            // Log the revocation
            await client.query(`
                INSERT INTO consent_logs (
                    consent_id, action, performed_by, ip_address, user_agent, changes
                ) VALUES ($1, 'revoked', $2, $3, $4, $5)
            `, [id, revokedBy, metadata.ip_address, metadata.user_agent,
                JSON.stringify({ reason, ...metadata })]);

            await db.commitTransaction(client);

            logger.info('Consent revoked', { 
                consentId: id,
                revokedBy,
                reason
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error revoking consent', { 
                error: error.message,
                consentId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get consent history/logs
     * @param {string} consentId - Consent ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of consent logs
     */
    async getHistory(consentId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT cl.*, u.username as performed_by_username
                FROM consent_logs cl
                LEFT JOIN users u ON cl.performed_by = u.id
                WHERE cl.consent_id = $1
                ORDER BY cl.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [consentId, limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting consent history', { 
                error: error.message,
                consentId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get consent statistics
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Consent statistics
     */
    async getStats(filters = {}) {
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_consents,
                    COUNT(*) FILTER (WHERE is_granted = true) as granted,
                    COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked,
                    COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30_days
            `;

            const values = [];
            let paramIndex = 1;

            if (filters.patient_id) {
                query += ` FROM consent_records WHERE patient_id = $1`;
                values.push(filters.patient_id);
            } else {
                query += ` FROM consent_records WHERE 1=1`;
            }

            const result = await db.query(query, values);
            
            // Get counts by type
            const byType = await db.query(`
                SELECT consent_type, 
                       COUNT(*) as total,
                       COUNT(*) FILTER (WHERE is_granted = true) as granted
                FROM consent_records
                ${filters.patient_id ? 'WHERE patient_id = $1' : 'WHERE 1=1'}
                GROUP BY consent_type
                ORDER BY consent_type
            `, filters.patient_id ? [filters.patient_id] : []);

            return {
                overview: result.rows[0],
                byType: byType.rows
            };
        } catch (error) {
            logger.error('Error getting consent statistics', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all consent types
     * @returns {Array} List of consent types
     */
    getTypes() {
        return CONSENT_TYPES;
    },

    /**
     * Check if consent type is valid
     * @param {string} type - Consent type to validate
     * @returns {boolean} True if valid
     */
    isValidType(type) {
        return CONSENT_TYPES.includes(type);
    },

    /**
     * Soft delete consent record
     * @param {string} id - Consent ID
     * @param {string} deletedBy - User ID performing deletion
     */
    async delete(id, deletedBy) {
        try {
            const query = `
                UPDATE consent_records 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;
            
            const result = await db.query(query, [deletedBy, id]);
            
            if (result.rows.length === 0) {
                throw new Error('Consent record not found');
            }

            logger.info('Consent record soft deleted', { 
                consentId: id,
                deletedBy 
            });
            
            return true;
        } catch (error) {
            logger.error('Error deleting consent record', { 
                error: error.message,
                consentId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = ConsentRecord;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new consent
 * const consent = await ConsentRecord.create({
 *     patient_id: patientId,
 *     consent_type: 'treatment',
 *     consent_version: '1.0',
 *     consent_text: 'I consent to medical treatment',
 *     is_granted: true,
 *     expires_at: '2027-01-01',
 *     ip_address: '192.168.1.1',
 *     user_agent: 'Mozilla/5.0...'
 * }, adminUserId);
 * 
 * // Check if patient has active consent
 * const hasConsent = await ConsentRecord.hasActiveConsent(
 *     patientId, 
 *     'data_sharing'
 * );
 * 
 * // Get all active consents for patient
 * const activeConsents = await ConsentRecord.getActiveByPatient(patientId);
 * 
 * // Revoke consent
 * await ConsentRecord.revoke(
 *     consentId,
 *     'Patient requested withdrawal',
 *     adminUserId,
 *     { ip_address: '192.168.1.1' }
 * );
 * 
 * // Get consent history
 * const history = await ConsentRecord.getHistory(consentId);
 * 
 * // Get statistics
 * const stats = await ConsentRecord.getStats({ patient_id: patientId });
 * 
 * ======================================================================
 */