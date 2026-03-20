/**
 * ======================================================================
 * FILE: backend/src/services/receptionist/registrationService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist registration service - Handles patient registration business logic.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-01] Patient email must be unique
 * - [BR-02] Patient phone must be unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Min age 0, Max age 150
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const bcrypt = require('bcrypt');

const registrationService = {
    /**
     * Search patients
     */
    async searchPatients(receptionistId, searchTerm, options = {}) {
        try {
            const { page = 1, limit = 20, phone, email } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.gender, p.blood_group, p.phone, p.email,
                    p.address, p.city, p.registration_date,
                    p.emergency_contact_name, p.emergency_contact_phone,
                    u.email as user_email, u.status
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE p.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (searchTerm) {
                query += ` AND (
                    p.first_name ILIKE $${paramIndex} OR 
                    p.last_name ILIKE $${paramIndex} OR 
                    CONCAT(p.first_name, ' ', p.last_name) ILIKE $${paramIndex}
                )`;
                values.push(`%${searchTerm}%`);
                paramIndex++;
            }

            if (phone) {
                query += ` AND p.phone ILIKE $${paramIndex}`;
                values.push(`%${phone}%`);
                paramIndex++;
            }

            if (email) {
                query += ` AND p.email ILIKE $${paramIndex}`;
                values.push(`%${email}%`);
                paramIndex++;
            }

            query += ` ORDER BY p.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM patients p
                WHERE p.is_deleted = false
                ${searchTerm ? 'AND (p.first_name ILIKE $1 OR p.last_name ILIKE $1)' : ''}
            `;
            const countValues = searchTerm ? [`%${searchTerm}%`] : [];
            const count = await db.query(countQuery, countValues);

            // Get exact matches count
            let exactMatches = 0;
            if (phone || email) {
                const exactQuery = `
                    SELECT COUNT(*) as exact
                    FROM patients
                    WHERE is_deleted = false
                        ${phone ? 'AND phone = $1' : ''}
                        ${email ? 'AND email = $2' : ''}
                `;
                const exactValues = [];
                if (phone) exactValues.push(phone);
                if (email) exactValues.push(email);
                const exact = await db.query(exactQuery, exactValues);
                exactMatches = parseInt(exact.rows[0].exact);
            }

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0].total),
                    exact_matches: exactMatches
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in searchPatients', { error: error.message, receptionistId, searchTerm });
            throw error;
        }
    },

    /**
     * Get recent patients
     */
    async getRecentPatients(receptionistId, limit = 20) {
        try {
            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.phone,
                    p.registration_date,
                    CONCAT(u.first_name, ' ', u.last_name) as registered_by
                FROM patients p
                JOIN users u ON p.created_by = u.id
                WHERE p.is_deleted = false
                ORDER BY p.created_at DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRecentPatients', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get patient by ID
     */
    async getPatientById(receptionistId, patientId) {
        try {
            const query = `
                SELECT 
                    p.*, 
                    u.email as user_email,
                    u.username,
                    u.status as user_status,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ec.id,
                                'name', ec.name,
                                'phone', ec.phone,
                                'relation', ec.relation,
                                'address', ec.address,
                                'email', ec.email,
                                'priority', ec.priority
                            ) ORDER BY ec.priority
                        )
                        FROM emergency_contacts ec
                        WHERE ec.patient_id = p.id
                    ) as emergency_contacts,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', d.id,
                                'document_type', d.document_type,
                                'document_name', d.document_name,
                                'uploaded_at', d.uploaded_at
                            ) ORDER BY d.uploaded_at DESC
                        )
                        FROM patient_documents d
                        WHERE d.patient_id = p.id
                    ) as documents
                FROM patients p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientById', { error: error.message, receptionistId, patientId });
            throw error;
        }
    },

    /**
     * Check if email exists [BR-01]
     */
    async checkEmailExists(email, excludePatientId = null) {
        try {
            let query = `SELECT id FROM patients WHERE email = $1 AND is_deleted = false`;
            const values = [email];

            if (excludePatientId) {
                query += ` AND id != $2`;
                values.push(excludePatientId);
            }

            const result = await db.query(query, values);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error in checkEmailExists', { error: error.message, email });
            throw error;
        }
    },

    /**
     * Check if phone exists [BR-02]
     */
    async checkPhoneExists(phone, excludePatientId = null) {
        try {
            let query = `SELECT id FROM patients WHERE phone = $1 AND is_deleted = false`;
            const values = [phone];

            if (excludePatientId) {
                query += ` AND id != $2`;
                values.push(excludePatientId);
            }

            const result = await db.query(query, values);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error in checkPhoneExists', { error: error.message, phone });
            throw error;
        }
    },

    /**
     * Register new patient
     */
    async registerPatient(receptionistId, patientData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // [BR-01] Check email uniqueness
            if (patientData.email) {
                const emailExists = await this.checkEmailExists(patientData.email);
                if (emailExists) {
                    throw new Error('Email already exists');
                }
            }

            // [BR-02] Check phone uniqueness
            if (patientData.phone) {
                const phoneExists = await this.checkPhoneExists(patientData.phone);
                if (phoneExists) {
                    throw new Error('Phone number already exists');
                }
            }

            // Create user account
            const userQuery = `
                INSERT INTO users (
                    id, username, email, password_hash,
                    role, status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, 'patient', 'active', NOW(), NOW()
                ) RETURNING id
            `;

            // Generate username from name
            const username = `${patientData.first_name.toLowerCase()}.${patientData.last_name.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
            
            // Temporary password (should be changed on first login)
            const tempPassword = await bcrypt.hash('Welcome@123', 10);

            const user = await client.query(userQuery, [
                username,
                patientData.email || `${username}@temp.com`,
                tempPassword
            ]);

            // Create patient record
            const patientQuery = `
                INSERT INTO patients (
                    id, user_id, first_name, last_name, date_of_birth,
                    gender, blood_group, marital_status, occupation,
                    nationality, preferred_language, phone, alternate_phone,
                    email, address, city, state, postal_code,
                    registration_date, referred_by, allergies, medical_conditions,
                    insurance_provider, insurance_policy, insurance_expiry,
                    consent_form_signed, consent_form_date,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25, $26,
                    $27, NOW(), NOW()
                ) RETURNING *
            `;

            const patientValues = [
                user.rows[0].id,
                patientData.first_name,
                patientData.last_name,
                patientData.date_of_birth,
                patientData.gender,
                patientData.blood_group || null,
                patientData.marital_status || null,
                patientData.occupation || null,
                patientData.nationality || 'Indian',
                patientData.preferred_language || 'en',
                patientData.phone,
                patientData.alternate_phone || null,
                patientData.email || null,
                patientData.address || null,
                patientData.city || null,
                patientData.state || null,
                patientData.postal_code || null,
                patientData.registration_date,
                patientData.referred_by || null,
                patientData.allergies || null,
                patientData.medical_conditions || null,
                patientData.insurance_provider || null,
                patientData.insurance_policy || null,
                patientData.insurance_expiry || null,
                patientData.consent_form_signed || true,
                patientData.consent_form_date || new Date(),
                receptionistId
            ];

            const patient = await client.query(patientQuery, patientValues);

            // [BR-03] Add emergency contact if provided
            if (patientData.emergency_contact_name && patientData.emergency_contact_phone) {
                await client.query(`
                    INSERT INTO emergency_contacts (
                        id, patient_id, name, phone, relation,
                        address, email, priority, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, 1, NOW()
                    )
                `, [
                    patient.rows[0].id,
                    patientData.emergency_contact_name,
                    patientData.emergency_contact_phone,
                    patientData.emergency_contact_relation || null,
                    patientData.emergency_contact_address || null,
                    patientData.emergency_contact_email || null
                ]);
            }

            await db.commitTransaction(client);

            return patient.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update patient
     */
    async updatePatient(receptionistId, patientId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // [BR-01] Check email uniqueness if updating
            if (updates.email) {
                const emailExists = await this.checkEmailExists(updates.email, patientId);
                if (emailExists) {
                    throw new Error('Email already exists');
                }
            }

            // [BR-02] Check phone uniqueness if updating
            if (updates.phone) {
                const phoneExists = await this.checkPhoneExists(updates.phone, patientId);
                if (phoneExists) {
                    throw new Error('Phone number already exists');
                }
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'first_name', 'last_name', 'date_of_birth', 'gender',
                'blood_group', 'marital_status', 'occupation',
                'nationality', 'preferred_language', 'phone', 'alternate_phone',
                'email', 'address', 'city', 'state', 'postal_code',
                'allergies', 'medical_conditions',
                'insurance_provider', 'insurance_policy', 'insurance_expiry'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(patientId);

            const query = `
                UPDATE patients 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Patient not found');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Deactivate patient (soft delete)
     */
    async deactivatePatient(receptionistId, patientId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE patients 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [receptionistId, reason, patientId]);

            if (result.rows.length === 0) {
                throw new Error('Patient not found');
            }

            // Also deactivate user account
            await client.query(`
                UPDATE users 
                SET status = 'inactive',
                    updated_at = NOW()
                WHERE id = (SELECT user_id FROM patients WHERE id = $1)
            `, [patientId]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Add emergency contact
     */
    async addEmergencyContact(receptionistId, patientId, contactData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if patient exists
            const patientCheck = await client.query(
                'SELECT id FROM patients WHERE id = $1 AND is_deleted = false',
                [patientId]
            );

            if (patientCheck.rows.length === 0) {
                throw new Error('Patient not found');
            }

            const query = `
                INSERT INTO emergency_contacts (
                    id, patient_id, name, phone, relation,
                    address, email, priority, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                ) RETURNING *
            `;

            const values = [
                patientId,
                contactData.name,
                contactData.phone,
                contactData.relation,
                contactData.address || null,
                contactData.email || null,
                contactData.priority || 1
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update emergency contact
     */
    async updateEmergencyContact(receptionistId, patientId, contactId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['name', 'phone', 'relation', 'address', 'email', 'priority'];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(contactId);
            values.push(patientId);

            const query = `
                UPDATE emergency_contacts 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND patient_id = $${paramIndex + 1}
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Contact not found');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete emergency contact
     */
    async deleteEmergencyContact(receptionistId, patientId, contactId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM emergency_contacts
                WHERE id = $1 AND patient_id = $2
                RETURNING id
            `;

            const result = await client.query(query, [contactId, patientId]);

            if (result.rows.length === 0) {
                throw new Error('Contact not found');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Upload patient document
     */
    async uploadPatientDocument(receptionistId, patientId, documentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO patient_documents (
                    id, patient_id, document_type, document_name,
                    document_url, expiry_date, notes, uploaded_by,
                    uploaded_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
                ) RETURNING *
            `;

            const values = [
                patientId,
                documentData.document_type,
                documentData.document_name,
                documentData.document_url,
                documentData.expiry_date || null,
                documentData.notes || null,
                documentData.uploaded_by,
                documentData.uploaded_at
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get patient documents
     */
    async getPatientDocuments(receptionistId, patientId) {
        try {
            const query = `
                SELECT pd.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as uploaded_by_name
                FROM patient_documents pd
                LEFT JOIN employees e ON pd.uploaded_by = e.id
                WHERE pd.patient_id = $1
                ORDER BY pd.uploaded_at DESC
            `;

            const result = await db.query(query, [patientId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPatientDocuments', { error: error.message, receptionistId, patientId });
            throw error;
        }
    },

    /**
     * Delete patient document
     */
    async deletePatientDocument(receptionistId, patientId, documentId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM patient_documents
                WHERE id = $1 AND patient_id = $2
                RETURNING id
            `;

            const result = await client.query(query, [documentId, patientId]);

            if (result.rows.length === 0) {
                throw new Error('Document not found');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Add patient note
     */
    async addPatientNote(receptionistId, patientId, noteData) {
        try {
            const query = `
                INSERT INTO patient_notes (
                    id, patient_id, note, type, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5
                ) RETURNING *
            `;

            const values = [
                patientId,
                noteData.note,
                noteData.type,
                noteData.created_by,
                noteData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addPatientNote', { error: error.message, receptionistId, patientId });
            throw error;
        }
    },

    /**
     * Get patient notes
     */
    async getPatientNotes(receptionistId, patientId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM patient_notes n
                LEFT JOIN employees e ON n.created_by = e.id
                WHERE n.patient_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [patientId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM patient_notes
                WHERE patient_id = $1
            `;
            const count = await db.query(countQuery, [patientId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getPatientNotes', { error: error.message, receptionistId, patientId });
            throw error;
        }
    },

    /**
     * Get patient statistics
     */
    async getPatientStats(receptionistId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_patients,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d,
                    COUNT(*) FILTER (WHERE gender = 'male') as male,
                    COUNT(*) FILTER (WHERE gender = 'female') as female,
                    COUNT(*) FILTER (WHERE blood_group IS NOT NULL) as blood_group_known,
                    COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured,
                    MIN(created_at) as first_registration,
                    MAX(created_at) as last_registration
                FROM patients
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientStats', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's registrations
     */
    async getTodaysRegistrations(receptionistId) {
        try {
            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.phone,
                    p.registration_date, p.referred_by,
                    CONCAT(e.first_name, ' ', e.last_name) as registered_by
                FROM patients p
                LEFT JOIN employees e ON p.created_by = e.id
                WHERE DATE(p.created_at) = CURRENT_DATE
                    AND p.is_deleted = false
                ORDER BY p.created_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysRegistrations', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Merge duplicate patient records
     */
    async mergePatients(receptionistId, primaryId, duplicateIds) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get primary patient data
            const primaryQuery = await client.query(
                'SELECT * FROM patients WHERE id = $1',
                [primaryId]
            );

            if (primaryQuery.rows.length === 0) {
                throw new Error('Primary patient not found');
            }

            const primary = primaryQuery.rows[0];

            // Update all references from duplicate patients to primary
            const tables = [
                'appointments', 'prescriptions', 'invoices',
                'test_results', 'radiology_images', 'vital_signs',
                'patient_notes', 'patient_documents', 'emergency_contacts'
            ];

            for (const table of tables) {
                await client.query(`
                    UPDATE ${table}
                    SET patient_id = $1
                    WHERE patient_id = ANY($2::uuid[])
                `, [primaryId, duplicateIds]);
            }

            // Mark duplicates as deleted
            await client.query(`
                UPDATE patients 
                SET is_deleted = true,
                    merged_to = $1,
                    deleted_at = NOW(),
                    deleted_by = $2
                WHERE id = ANY($3::uuid[])
            `, [primaryId, receptionistId, duplicateIds]);

            // Create merge record
            await client.query(`
                INSERT INTO patient_merges (
                    id, primary_patient_id, duplicate_patient_ids,
                    merged_by, merged_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, NOW(), NOW()
                )
            `, [primaryId, duplicateIds, receptionistId]);

            await db.commitTransaction(client);

            return {
                primary_id: primaryId,
                merged_count: duplicateIds.length,
                message: `Successfully merged ${duplicateIds.length} duplicate records`
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Export patients
     */
    async exportPatients(receptionistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.gender, p.blood_group, p.phone, p.email,
                    p.address, p.city, p.state, p.postal_code,
                    p.registration_date, p.referred_by,
                    p.insurance_provider, p.insurance_policy,
                    p.emergency_contact_name, p.emergency_contact_phone,
                    p.allergies, p.medical_conditions,
                    COUNT(DISTINCT a.id) as total_appointments,
                    COUNT(DISTINCT i.id) as total_invoices
                FROM patients p
                LEFT JOIN appointments a ON p.id = a.patient_id
                LEFT JOIN invoices i ON p.id = i.patient_id
                WHERE p.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND p.created_at >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND p.created_at <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            query += ` GROUP BY p.id
                      ORDER BY p.created_at DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportPatients', { error: error.message, receptionistId });
            throw error;
        }
    }
};

module.exports = registrationService;