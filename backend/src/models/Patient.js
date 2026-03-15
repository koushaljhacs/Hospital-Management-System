/**
 * ======================================================================
 * FILE: backend/src/models/Patient.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient model for database operations.
 * Handles all patient-related database queries including medical records,
 * emergency contacts, and personal information.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * TABLE: patients
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users.id)
 * - first_name: string
 * - last_name: string
 * - date_of_birth: date
 * - gender: enum
 * - blood_group: enum
 * - marital_status: enum
 * - occupation: string
 * - nationality: string
 * - preferred_language: string
 * - phone: string (unique)
 * - alternate_phone: string
 * - email: string
 * - address: text
 * - registration_date: date
 * - referred_by: string
 * - profile_photo: text
 * - emergency_contact_name: string
 * - emergency_contact_phone: string
 * - emergency_contact_relation: string
 * - allergies: text
 * - medical_conditions: text
 * - insurance_provider: string
 * - insurance_policy: string
 * - insurance_expiry: date
 * - consent_form_signed: boolean
 * - consent_form_date: date
 * - is_deleted: boolean
 * - created_at: timestamp
 * - updated_at: timestamp
 * 
 * RELATIONSHIPS:
 * - One patient belongs to one user (user_id)
 * - One patient has many appointments
 * - One patient has many prescriptions
 * - One patient has many invoices
 * - One patient has many test results
 * - One patient has many radiology images
 * - One patient has many vital signs
 * - One patient has many consent records
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Patient model with database operations
 */
const Patient = {
    /**
     * Table name
     */
    tableName: 'patients',

    /**
     * Find patient by ID
     * @param {string} id - Patient UUID
     * @returns {Promise<Object>} Patient object
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    p.*,
                    u.email as user_email,
                    u.username,
                    u.status as user_status
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = $1 AND p.is_deleted = false
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Patient found by ID', { patientId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding patient by ID', { 
                error: error.message,
                patientId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find patient by user ID
     * @param {string} userId - User UUID
     * @returns {Promise<Object>} Patient object
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    p.*,
                    u.email as user_email,
                    u.username,
                    u.status as user_status
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = $1 AND p.is_deleted = false
            `;
            
            const result = await db.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Patient found by user ID', { userId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding patient by user ID', { 
                error: error.message,
                userId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find patient by email
     * @param {string} email - Email address
     * @returns {Promise<Object>} Patient object
     */
    async findByEmail(email) {
        try {
            const query = `
                SELECT 
                    p.*,
                    u.email as user_email,
                    u.username,
                    u.status as user_status
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE u.email = $1 AND p.is_deleted = false
            `;
            
            const result = await db.query(query, [email]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Patient found by email', { email });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding patient by email', { 
                error: error.message,
                email 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find patient by phone
     * @param {string} phone - Phone number
     * @returns {Promise<Object>} Patient object
     */
    async findByPhone(phone) {
        try {
            const query = `
                SELECT * FROM patients 
                WHERE phone = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [phone]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Patient found by phone', { phone });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding patient by phone', { 
                error: error.message,
                phone 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new patient
     * @param {Object} patientData - Patient data
     * @param {string} createdBy - User ID creating the patient
     * @returns {Promise<Object>} Created patient
     */
    async create(patientData, createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if phone already exists
            if (patientData.phone) {
                const existing = await this.findByPhone(patientData.phone);
                if (existing) {
                    throw new Error('Phone number already registered');
                }
            }

            const query = `
                INSERT INTO patients (
                    user_id, first_name, last_name, date_of_birth,
                    gender, blood_group, marital_status, occupation,
                    nationality, preferred_language, phone, alternate_phone,
                    email, address, registration_date, referred_by,
                    profile_photo, emergency_contact_name, emergency_contact_phone,
                    emergency_contact_relation, allergies, medical_conditions,
                    insurance_provider, insurance_policy, insurance_expiry,
                    consent_form_signed, consent_form_date,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                          $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
                          $23, $24, $25, $26, $27, NOW(), NOW())
                RETURNING *
            `;

            const values = [
                patientData.user_id,
                patientData.first_name,
                patientData.last_name,
                patientData.date_of_birth,
                patientData.gender || null,
                patientData.blood_group || null,
                patientData.marital_status || null,
                patientData.occupation || null,
                patientData.nationality || 'Indian',
                patientData.preferred_language || 'english',
                patientData.phone || null,
                patientData.alternate_phone || null,
                patientData.email || null,
                patientData.address || null,
                patientData.registration_date || new Date(),
                patientData.referred_by || null,
                patientData.profile_photo || null,
                patientData.emergency_contact_name,
                patientData.emergency_contact_phone,
                patientData.emergency_contact_relation || null,
                patientData.allergies || null,
                patientData.medical_conditions || null,
                patientData.insurance_provider || null,
                patientData.insurance_policy || null,
                patientData.insurance_expiry || null,
                patientData.consent_form_signed || false,
                patientData.consent_form_date || null
            ];

            const result = await client.query(query, values);
            
            await db.commitTransaction(client);

            logger.info('Patient created successfully', { 
                patientId: result.rows[0].id,
                userId: patientData.user_id,
                createdBy
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating patient', { 
                error: error.message,
                userId: patientData.user_id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update patient
     * @param {string} id - Patient ID
     * @param {Object} updates - Fields to update
     * @param {string} updatedBy - User ID performing update
     * @returns {Promise<Object>} Updated patient
     */
    async update(id, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Allowed update fields
            const allowedFields = [
                'first_name', 'last_name', 'date_of_birth',
                'gender', 'blood_group', 'marital_status', 'occupation',
                'nationality', 'preferred_language', 'alternate_phone',
                'email', 'address', 'profile_photo',
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relation', 'allergies', 'medical_conditions',
                'insurance_provider', 'insurance_policy', 'insurance_expiry'
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

            logger.info('Patient updated successfully', { 
                patientId: id,
                updatedBy,
                updates: Object.keys(updates)
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating patient', { 
                error: error.message,
                patientId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get patient with full medical history
     * @param {string} id - Patient ID
     * @returns {Promise<Object>} Patient with medical history
     */
    async getMedicalHistory(id) {
        try {
            const patient = await this.findById(id);
            if (!patient) {
                return null;
            }

            // Get appointments
            const appointments = await db.query(`
                SELECT id, appointment_date, appointment_time, status, type, reason
                FROM appointments
                WHERE patient_id = $1 AND is_deleted = false
                ORDER BY appointment_date DESC, appointment_time DESC
                LIMIT 50
            `, [id]);

            // Get prescriptions
            const prescriptions = await db.query(`
                SELECT p.*, array_agg(m.*) as medicines
                FROM prescriptions p
                LEFT JOIN medicines m ON p.id = m.prescription_id
                WHERE p.patient_id = $1
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT 50
            `, [id]);

            // Get lab results
            const labResults = await db.query(`
                SELECT tr.*, lt.test_name, lt.category, lt.unit
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                WHERE tr.patient_id = $1
                ORDER BY tr.tested_at DESC
                LIMIT 50
            `, [id]);

            // Get radiology images
            const radiology = await db.query(`
                SELECT * FROM radiology_images
                WHERE patient_id = $1
                ORDER BY uploaded_at DESC
                LIMIT 50
            `, [id]);

            // Get vital signs
            const vitals = await db.query(`
                SELECT * FROM vital_signs
                WHERE patient_id = $1
                ORDER BY recorded_at DESC
                LIMIT 50
            `, [id]);

            // Get invoices
            const invoices = await db.query(`
                SELECT id, invoice_number, issue_date, due_date, total, paid_amount, status
                FROM invoices
                WHERE patient_id = $1 AND is_deleted = false
                ORDER BY issue_date DESC
                LIMIT 50
            `, [id]);

            return {
                ...patient,
                medical_history: {
                    appointments: appointments.rows,
                    prescriptions: prescriptions.rows,
                    lab_results: labResults.rows,
                    radiology: radiology.rows,
                    vitals: vitals.rows,
                    invoices: invoices.rows
                },
                summary: {
                    total_appointments: appointments.rows.length,
                    total_prescriptions: prescriptions.rows.length,
                    total_lab_results: labResults.rows.length,
                    total_radiology: radiology.rows.length,
                    total_vitals: vitals.rows.length,
                    total_invoices: invoices.rows.length
                }
            };
        } catch (error) {
            logger.error('Error getting medical history', { 
                error: error.message,
                patientId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search patients
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of patients
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.phone, p.email, p.gender, p.blood_group,
                    u.email as user_email, u.username
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE (
                    p.first_name ILIKE $1 OR 
                    p.last_name ILIKE $1 OR 
                    p.phone ILIKE $1 OR 
                    p.email ILIKE $1 OR
                    u.email ILIKE $1
                ) AND p.is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN p.first_name ILIKE $2 THEN 1
                        WHEN p.last_name ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    p.created_at DESC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);
            
            logger.debug('Patients search completed', { 
                searchTerm,
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error searching patients', { 
                error: error.message,
                searchTerm 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get patients by doctor
     * @param {string} doctorId - Doctor ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of patients
     */
    async getByDoctor(doctorId, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT DISTINCT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.phone, p.email, p.gender, p.blood_group,
                    MAX(a.appointment_date) as last_visit
                FROM patients p
                JOIN appointments a ON p.id = a.patient_id
                WHERE a.doctor_id = $1 AND p.is_deleted = false
                GROUP BY p.id
                ORDER BY last_visit DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [doctorId, limit, offset]);
            
            logger.debug('Patients by doctor retrieved', { 
                doctorId,
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting patients by doctor', { 
                error: error.message,
                doctorId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get patient statistics
     * @returns {Promise<Object>} Patient statistics
     */
    async getStats() {
        try {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total_patients,
                    COUNT(*) FILTER (WHERE date_of_birth > NOW() - INTERVAL '18 years') as minors,
                    COUNT(*) FILTER (WHERE date_of_birth < NOW() - INTERVAL '60 years') as seniors,
                    COUNT(*) FILTER (WHERE gender = 'male') as male,
                    COUNT(*) FILTER (WHERE gender = 'female') as female,
                    COUNT(*) FILTER (WHERE blood_group IS NOT NULL) as blood_group_known,
                    COUNT(*) FILTER (WHERE emergency_contact_name IS NOT NULL) as has_emergency_contact,
                    COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured,
                    MIN(created_at) as oldest_patient,
                    MAX(created_at) as newest_patient
                FROM patients
                WHERE is_deleted = false
            `);

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting patient statistics', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete patient
     * @param {string} id - Patient ID
     * @param {string} deletedBy - User ID performing deletion
     */
    async delete(id, deletedBy) {
        try {
            const query = `
                UPDATE patients 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;
            
            const result = await db.query(query, [deletedBy, id]);
            
            if (result.rows.length === 0) {
                throw new Error('Patient not found');
            }

            logger.info('Patient soft deleted', { 
                patientId: id,
                deletedBy 
            });
            
            return true;
        } catch (error) {
            logger.error('Error deleting patient', { 
                error: error.message,
                patientId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = Patient;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new patient
 * const patient = await Patient.create({
 *     user_id: userId,
 *     first_name: 'John',
 *     last_name: 'Doe',
 *     date_of_birth: '1990-01-01',
 *     phone: '+91-9876543210',
 *     emergency_contact_name: 'Jane Doe',
 *     emergency_contact_phone: '+91-9876543211'
 * }, adminUserId);
 * 
 * // Get patient by ID
 * const patient = await Patient.findById(patientId);
 * 
 * // Get patient by user ID
 * const patient = await Patient.findByUserId(userId);
 * 
 * // Get medical history
 * const history = await Patient.getMedicalHistory(patientId);
 * 
 * // Search patients
 * const results = await Patient.search('John');
 * 
 * // Get patients by doctor
 * const patients = await Patient.getByDoctor(doctorId);
 * 
 * // Update patient
 * const updated = await Patient.update(patientId, {
 *     phone: '+91-9876543212',
 *     emergency_contact_name: 'Jane Smith'
 * }, adminUserId);
 * 
 * ======================================================================
 */