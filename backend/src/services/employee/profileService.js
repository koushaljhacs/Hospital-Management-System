/**
 * ======================================================================
 * FILE: backend/src/services/employee/profileService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee profile service - Handles business logic for profile management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const profileService = {
    /**
     * Get employee profile
     */
    async getEmployeeProfile(employeeId) {
        try {
            const query = `
                SELECT e.*, 
                       u.email,
                       u.username,
                       u.status as user_status,
                       d.id as department_id,
                       d.name as department_name,
                       r.id as role_id,
                       r.name as role_name,
                       s.id as shift_type_id,
                       s.name as shift_type_name,
                       s.start_time,
                       s.end_time
                FROM employees e
                JOIN users u ON e.user_id = u.id
                LEFT JOIN departments d ON e.department_id = d.id
                LEFT JOIN roles r ON e.role_id = r.id
                LEFT JOIN shift_types s ON e.default_shift_id = s.id
                WHERE e.user_id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [employeeId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getEmployeeProfile', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Check if email exists
     */
    async checkEmailExists(email, excludeEmployeeId = null) {
        try {
            let query = `
                SELECT u.id FROM users u
                JOIN employees e ON u.id = e.user_id
                WHERE u.email = $1 AND u.is_deleted = false
            `;
            const values = [email];

            if (excludeEmployeeId) {
                query += ` AND e.user_id != $2`;
                values.push(excludeEmployeeId);
            }

            const result = await db.query(query, values);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error in checkEmailExists', { error: error.message, email });
            throw error;
        }
    },

    /**
     * Check if phone exists
     */
    async checkPhoneExists(phone, excludeEmployeeId = null) {
        try {
            let query = `
                SELECT id FROM employees
                WHERE phone = $1 AND is_deleted = false
            `;
            const values = [phone];

            if (excludeEmployeeId) {
                query += ` AND user_id != $2`;
                values.push(excludeEmployeeId);
            }

            const result = await db.query(query, values);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error in checkPhoneExists', { error: error.message, phone });
            throw error;
        }
    },

    /**
     * Update employee profile
     */
    async updateProfile(employeeId, profileData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update users table if email changed
            if (profileData.email) {
                await client.query(`
                    UPDATE users 
                    SET email = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [profileData.email, employeeId]);
            }

            // Update employees table
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['phone', 'address', 'emergency_contact_name', 
                                   'emergency_contact_phone', 'emergency_contact_relation'];

            for (const [key, value] of Object.entries(profileData)) {
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
            setClause.push(`updated_by = $${paramIndex}`);
            values.push(profileData.updated_by);
            paramIndex++;
            values.push(employeeId);

            const query = `
                UPDATE employees 
                SET ${setClause.join(', ')}
                WHERE user_id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            // Log profile update
            await client.query(`
                INSERT INTO profile_update_logs (
                    id, employee_id, updated_fields, updated_by, ip_address, 
                    user_agent, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                )
            `, [
                employeeId,
                Object.keys(profileData).filter(k => allowedFields.includes(k)).join(', '),
                profileData.updated_by,
                profileData.ip_address,
                profileData.user_agent
            ]);

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
     * Upload profile photo
     */
    async uploadProfilePhoto(employeeId, photoData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get existing photo to delete
            const existingPhoto = await client.query(`
                SELECT photo_path FROM employees WHERE user_id = $1
            `, [employeeId]);

            // Save file to storage
            const storagePath = await this._saveProfilePhoto(photoData);

            // Update employee record
            const query = `
                UPDATE employees 
                SET photo_path = $1,
                    photo_url = $2,
                    photo_updated_at = $3,
                    updated_at = NOW()
                WHERE user_id = $4
                RETURNING photo_path, photo_url
            `;

            const photoUrl = `/api/v1/employee/profile/photo/${Date.now()}`;

            const values = [
                storagePath,
                photoUrl,
                photoData.uploaded_at,
                employeeId
            ];

            const result = await client.query(query, values);

            // Delete old photo file
            if (existingPhoto.rows[0]?.photo_path) {
                try {
                    await fs.unlink(existingPhoto.rows[0].photo_path);
                } catch (err) {
                    logger.warn('Failed to delete old profile photo', {
                        path: existingPhoto.rows[0].photo_path,
                        error: err.message
                    });
                }
            }

            // Log photo upload
            await client.query(`
                INSERT INTO profile_photo_logs (
                    id, employee_id, photo_url, uploaded_by, ip_address, 
                    user_agent, uploaded_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                )
            `, [
                employeeId,
                photoUrl,
                photoData.uploaded_by,
                photoData.ip_address,
                photoData.user_agent
            ]);

            await db.commitTransaction(client);

            return {
                photo_url: photoUrl,
                uploaded_at: photoData.uploaded_at
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Save profile photo to storage
     * @private
     */
    async _saveProfilePhoto(photoData) {
        try {
            const uploadDir = path.join(__dirname, '../../../uploads/profile-photos');
            await fs.mkdir(uploadDir, { recursive: true });

            const fileExtension = photoData.file_name.split('.').pop();
            const fileName = `${Date.now()}_${photoData.uploaded_by}.${fileExtension}`;
            const filePath = path.join(uploadDir, fileName);

            await fs.writeFile(filePath, photoData.file_buffer);

            return filePath;
        } catch (error) {
            logger.error('Error saving profile photo', { error: error.message });
            throw error;
        }
    },

    /**
     * Get employee statistics
     */
    async getEmployeeStatistics(employeeId) {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM attendance 
                     WHERE employee_id = $1 AND status = 'present' 
                     AND DATE(check_in_time) >= DATE_TRUNC('month', CURRENT_DATE)) as present_days,
                    (SELECT COUNT(*) FROM attendance 
                     WHERE employee_id = $1 AND status = 'late' 
                     AND DATE(check_in_time) >= DATE_TRUNC('month', CURRENT_DATE)) as late_days,
                    (SELECT COUNT(*) FROM leave_requests 
                     WHERE employee_id = $1 AND status = 'approved' 
                     AND start_date >= DATE_TRUNC('month', CURRENT_DATE)) as leave_days,
                    (SELECT COUNT(*) FROM employee_documents 
                     WHERE employee_id = $1 AND status = 'pending' 
                     AND is_deleted = false) as pending_documents,
                    (SELECT COUNT(*) FROM employee_notifications 
                     WHERE employee_id = $1 AND is_read = false 
                     AND is_deleted = false) as unread_notifications,
                    (SELECT COUNT(*) FROM employee_shifts 
                     WHERE employee_id = $1 AND date > CURRENT_DATE 
                     AND status = 'scheduled') as upcoming_shifts
            `;

            const result = await db.query(query, [employeeId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getEmployeeStatistics', { error: error.message, employeeId });
            throw error;
        }
    }
};

module.exports = profileService;