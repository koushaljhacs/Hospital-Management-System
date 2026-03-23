/**
 * ======================================================================
 * FILE: backend/src/models/core/Patient.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient model for database operations.
 * Handles all patient-related database queries.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: patients
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users table)
 * - first_name: string
 * - last_name: string
 * - date_of_birth: date
 * - gender: enum (male, female, other, prefer_not_to_say)
 * - blood_group: enum (A+, A-, B+, B-, AB+, AB-, O+, O-, unknown)
 * - marital_status: enum (single, married, divorced, widowed, other)
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
 * - insurance_provider_id: uuid
 * - insurance_policy: string
 * - insurance_expiry: date
 * - consent_form_signed: boolean
 * - consent_form_date: date
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * - created_at: timestamp
 * - updated_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Patient = {
    /**
     * Table name
     */
    tableName: 'patients',

    /**
     * Find patient by ID
     * @param {string} id - Patient UUID
     * @returns {Promise<Object|null>} Patient object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    p.id, p.user_id, p.first_name, p.last_name,
                    p.date_of_birth, p.gender, p.blood_group,
                    p.marital_status, p.occupation, p.nationality,
                    p.preferred_language, p.phone, p.alternate_phone,
                    p.email, p.address, p.registration_date,
                    p.referred_by, p.profile_photo,
                    p.emergency_contact_name, p.emergency_contact_phone,
                    p.emergency_contact_relation, p.allergies,
                    p.medical_conditions, p.insurance_provider_id,
                    p.insurance_policy, p.insurance_expiry,
                    p.consent_form_signed, p.consent_form_date,
                    p.created_at, p.updated_at,
                    u.username, u.email as user_email, u.role, u.status
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
     * @returns {Promise<Object|null>} Patient object or null
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    id, user_id, first_name, last_name,
                    date_of_birth, gender, blood_group,
                    marital_status, occupation, nationality,
                    preferred_language, phone, alternate_phone,
                    email, address, registration_date,
                    referred_by, profile_photo,
                    emergency_contact_name, emergency_contact_phone,
                    emergency_contact_relation, allergies,
                    medical_conditions, insurance_provider_id,
                    insurance_policy, insurance_expiry,
                    consent_form_signed, consent_form_date,
                    created_at, updated_at
                FROM patients
                WHERE user_id = $1 AND is_deleted = false
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
     * Find patient by phone number
     * @param {string} phone - Phone number
     * @returns {Promise<Object|null>} Patient object or null
     */
    async findByPhone(phone) {
        try {
            const query = `
                SELECT 
                    id, user_id, first_name, last_name,
                    phone, email, date_of_birth,
                    gender, address, created_at
                FROM patients
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
     * Find patient by email
     * @param {string} email - Email address
     * @returns {Promise<Object|null>} Patient object or null
     */
    async findByEmail(email) {
        try {
            const query = `
                SELECT 
                    id, user_id, first_name, last_name,
                    phone, email, date_of_birth,
                    gender, address, created_at
                FROM patients
                WHERE email = $1 AND is_deleted = false
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
     * Search patients by name
     * @param {string} searchTerm - Search term (first name or last name)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of patients
     */
    async searchByName(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    p.id, p.user_id, p.first_name, p.last_name,
                    p.phone, p.email, p.date_of_birth,
                    p.gender, p.address, p.registration_date,
                    u.status as user_status
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE (p.first_name ILIKE $1 OR p.last_name ILIKE $1)
                    AND p.is_deleted = false
                    AND u.is_deleted = false
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

            logger.debug('Patient search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching patients by name', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new patient
     * @param {Object} patientData - Patient data
     * @param {string} patientData.user_id - User ID (foreign key)
     * @param {string} patientData.first_name - First name
     * @param {string} patientData.last_name - Last name
     * @param {string} [patientData.date_of_birth] - Date of birth
     * @param {string} [patientData.gender] - Gender
     * @param {string} [patientData.blood_group] - Blood group
     * @param {string} [patientData.marital_status] - Marital status
     * @param {string} [patientData.occupation] - Occupation
     * @param {string} [patientData.nationality] - Nationality
     * @param {string} [patientData.preferred_language] - Preferred language
     * @param {string} [patientData.phone] - Phone number
     * @param {string} [patientData.alternate_phone] - Alternate phone
     * @param {string} [patientData.email] - Email
     * @param {string} [patientData.address] - Address
     * @param {string} [patientData.referred_by] - Referred by
     * @param {string} [patientData.profile_photo] - Profile photo URL
     * @param {string} patientData.emergency_contact_name - Emergency contact name
     * @param {string} patientData.emergency_contact_phone - Emergency contact phone
     * @param {string} [patientData.emergency_contact_relation] - Emergency contact relation
     * @param {string} [patientData.allergies] - Allergies
     * @param {string} [patientData.medical_conditions] - Medical conditions
     * @param {string} [patientData.insurance_provider_id] - Insurance provider ID
     * @param {string} [patientData.insurance_policy] - Insurance policy number
     * @param {string} [patientData.insurance_expiry] - Insurance expiry date
     * @param {boolean} [patientData.consent_form_signed] - Consent form signed
     * @param {string} [patientData.consent_form_date] - Consent form date
     * @returns {Promise<Object>} Created patient
     */
    async create(patientData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (patientData.phone) {
                const existingPhone = await this.findByPhone(patientData.phone);
                if (existingPhone) {
                    throw new Error('Phone number already registered');
                }
            }

            if (patientData.email) {
                const existingEmail = await this.findByEmail(patientData.email);
                if (existingEmail) {
                    throw new Error('Email already registered');
                }
            }

            const query = `
                INSERT INTO patients (
                    id, user_id, first_name, last_name,
                    date_of_birth, gender, blood_group,
                    marital_status, occupation, nationality,
                    preferred_language, phone, alternate_phone,
                    email, address, registration_date,
                    referred_by, profile_photo,
                    emergency_contact_name, emergency_contact_phone,
                    emergency_contact_relation, allergies,
                    medical_conditions, insurance_provider_id,
                    insurance_policy, insurance_expiry,
                    consent_form_signed, consent_form_date,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13, $14,
                    COALESCE($15, CURRENT_DATE), $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25,
                    COALESCE($26, false), $27, NOW(), NOW()
                )
                RETURNING 
                    id, user_id, first_name, last_name,
                    date_of_birth, gender, phone, email,
                    registration_date, created_at
            `;

            const values = [
                patientData.user_id,
                patientData.first_name,
                patientData.last_name,
                patientData.date_of_birth || null,
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
                patientData.registration_date || null,
                patientData.referred_by || null,
                patientData.profile_photo || null,
                patientData.emergency_contact_name,
                patientData.emergency_contact_phone,
                patientData.emergency_contact_relation || null,
                patientData.allergies || null,
                patientData.medical_conditions || null,
                patientData.insurance_provider_id || null,
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
                fullName: `${patientData.first_name} ${patientData.last_name}`
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
     * @returns {Promise<Object>} Updated patient
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'first_name', 'last_name', 'date_of_birth', 'gender',
                'blood_group', 'marital_status', 'occupation', 'nationality',
                'preferred_language', 'phone', 'alternate_phone',
                'email', 'address', 'referred_by', 'profile_photo',
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relation', 'allergies', 'medical_conditions',
                'insurance_provider_id', 'insurance_policy', 'insurance_expiry',
                'consent_form_signed', 'consent_form_date'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            if (updates.phone) {
                const existingPhone = await this.findByPhone(updates.phone);
                if (existingPhone && existingPhone.id !== id) {
                    throw new Error('Phone number already registered to another patient');
                }
            }

            if (updates.email) {
                const existingEmail = await this.findByEmail(updates.email);
                if (existingEmail && existingEmail.id !== id) {
                    throw new Error('Email already registered to another patient');
                }
            }

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(id);

            const query = `
                UPDATE patients 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, user_id, first_name, last_name,
                    date_of_birth, gender, phone, email,
                    address, registration_date, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Patient not found');
            }

            await db.commitTransaction(client);

            logger.info('Patient updated successfully', {
                patientId: id,
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
     * Get all patients with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.gender] - Gender filter
     * @param {string} [filters.blood_group] - Blood group filter
     * @param {string} [filters.status] - User status filter
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of patients
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['p.is_deleted = false', 'u.is_deleted = false'];

            if (filters.gender) {
                conditions.push(`p.gender = $${paramIndex++}`);
                values.push(filters.gender);
            }
            if (filters.blood_group) {
                conditions.push(`p.blood_group = $${paramIndex++}`);
                values.push(filters.blood_group);
            }
            if (filters.status) {
                conditions.push(`u.status = $${paramIndex++}`);
                values.push(filters.status);
            }
            if (filters.from_date) {
                conditions.push(`p.registration_date >= $${paramIndex++}`);
                values.push(filters.from_date);
            }
            if (filters.to_date) {
                conditions.push(`p.registration_date <= $${paramIndex++}`);
                values.push(filters.to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    p.id, p.user_id, p.first_name, p.last_name,
                    p.phone, p.email, p.date_of_birth,
                    p.gender, p.blood_group, p.address,
                    p.registration_date, p.profile_photo,
                    p.emergency_contact_name, p.emergency_contact_phone,
                    u.status, u.email_verified, u.phone_verified,
                    p.created_at
                FROM patients p
                JOIN users u ON p.user_id = u.id
                ${whereClause}
                ORDER BY p.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all patients', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all patients', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get patients by doctor ID (assigned patients)
     * @param {string} doctorId - Doctor ID (employee UUID)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of patients
     */
    async getByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT DISTINCT
                    p.id, p.user_id, p.first_name, p.last_name,
                    p.phone, p.email, p.date_of_birth,
                    p.gender, p.address, p.profile_photo,
                    MAX(a.appointment_date) as last_visit,
                    COUNT(a.id) as total_visits
                FROM patients p
                JOIN appointments a ON p.id = a.patient_id
                WHERE a.doctor_id = $1
                    AND p.is_deleted = false
                    AND a.is_deleted = false
                GROUP BY p.id, p.user_id, p.first_name, p.last_name,
                    p.phone, p.email, p.date_of_birth,
                    p.gender, p.address, p.profile_photo
                ORDER BY last_visit DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [doctorId, limit, offset]);

            logger.debug('Patients found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting patients by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get patients by ward/nurse assignment
     * @param {string} ward - Ward name
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of patients
     */
    async getByWard(ward, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    p.id, p.user_id, p.first_name, p.last_name,
                    p.phone, p.date_of_birth, p.gender,
                    b.id as bed_id, b.bed_number, b.room_number,
                    b.assigned_at as admission_date
                FROM patients p
                JOIN beds b ON p.id = b.current_patient_id
                WHERE b.ward = $1
                    AND b.status = 'occupied'
                    AND p.is_deleted = false
                    AND b.is_deleted = false
                ORDER BY b.assigned_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [ward, limit, offset]);

            logger.debug('Patients found by ward', {
                ward,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting patients by ward', {
                error: error.message,
                ward
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get patient count by gender
     * @returns {Promise<Object>} Count by gender
     */
    async getCountByGender() {
        try {
            const query = `
                SELECT 
                    gender,
                    COUNT(*) as count
                FROM patients
                WHERE is_deleted = false
                GROUP BY gender
            `;

            const result = await db.query(query);

            const counts = {
                male: 0,
                female: 0,
                other: 0,
                prefer_not_to_say: 0
            };

            for (const row of result.rows) {
                if (row.gender && counts.hasOwnProperty(row.gender)) {
                    counts[row.gender] = parseInt(row.count);
                }
            }

            logger.debug('Patient count by gender retrieved');

            return counts;
        } catch (error) {
            logger.error('Error getting patient count by gender', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get patient count by blood group
     * @returns {Promise<Object>} Count by blood group
     */
    async getCountByBloodGroup() {
        try {
            const query = `
                SELECT 
                    blood_group,
                    COUNT(*) as count
                FROM patients
                WHERE is_deleted = false AND blood_group IS NOT NULL
                GROUP BY blood_group
                ORDER BY blood_group
            `;

            const result = await db.query(query);

            const counts = {};

            for (const row of result.rows) {
                counts[row.blood_group] = parseInt(row.count);
            }

            logger.debug('Patient count by blood group retrieved');

            return counts;
        } catch (error) {
            logger.error('Error getting patient count by blood group', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total patients
     * @param {Object} filters - Filter conditions
     * @returns {Promise<number>} Total count
     */
    async count(filters = {}) {
        try {
            let query = `
                SELECT COUNT(*) as total 
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE p.is_deleted = false AND u.is_deleted = false
            `;
            const values = [];
            const conditions = [];

            if (filters.gender) {
                conditions.push(`p.gender = $${values.length + 1}`);
                values.push(filters.gender);
            }
            if (filters.blood_group) {
                conditions.push(`p.blood_group = $${values.length + 1}`);
                values.push(filters.blood_group);
            }
            if (filters.status) {
                conditions.push(`u.status = $${values.length + 1}`);
                values.push(filters.status);
            }

            if (conditions.length > 0) {
                query += ' AND ' + conditions.join(' AND ');
            }

            const result = await db.query(query, values);

            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting patients', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete patient
     * @param {string} id - Patient ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE patients 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id, user_id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Patient not found');
            }

            const userQuery = `
                UPDATE users 
                SET status = 'inactive',
                    updated_at = NOW()
                WHERE id = $1
            `;
            await client.query(userQuery, [result.rows[0].user_id]);

            await db.commitTransaction(client);

            logger.info('Patient soft deleted', {
                patientId: id,
                userId: result.rows[0].user_id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting patient', {
                error: error.message,
                patientId: id
            });
            throw error;
        } finally {
            client.release();
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
 *     user_id: 'user-uuid-here',
 *     first_name: 'John',
 *     last_name: 'Doe',
 *     date_of_birth: '1980-01-01',
 *     gender: 'male',
 *     blood_group: 'O+',
 *     phone: '+919876543210',
 *     email: 'john.doe@example.com',
 *     emergency_contact_name: 'Jane Doe',
 *     emergency_contact_phone: '+919876543211',
 *     address: '123 Main Street, City'
 * });
 * 
 * // Find patient by ID
 * const patient = await Patient.findById(patientId);
 * 
 * // Find patient by user ID
 * const patient = await Patient.findByUserId(userId);
 * 
 * // Search patients by name
 * const results = await Patient.searchByName('John', { limit: 10 });
 * 
 * // Get all patients with filters
 * const patients = await Patient.getAll(
 *     { gender: 'male', status: 'active' },
 *     { limit: 20, offset: 0 }
 * );
 * 
 * // Get patients assigned to doctor
 * const doctorPatients = await Patient.getByDoctorId(doctorId);
 * 
 * // Get patients in a ward
 * const wardPatients = await Patient.getByWard('ICU');
 * 
 * // Update patient
 * const updated = await Patient.update(patientId, {
 *     phone: '+919876543210',
 *     address: '456 New Address, City'
 * });
 * 
 * // Get statistics
 * const genderStats = await Patient.getCountByGender();
 * const bloodGroupStats = await Patient.getCountByBloodGroup();
 * 
 * // Count patients
 * const total = await Patient.count({ gender: 'female' });
 * 
 * // Soft delete patient
 * await Patient.delete(patientId, adminUserId);
 * 
 * ======================================================================
 */