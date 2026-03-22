/**
 * ======================================================================
 * FILE: backend/src/controllers/employee/profileController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee profile controller - Handles profile management.
 * Total Endpoints: 3
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const profileService = require('../../services/employee/profileService');
const logger = require('../../utils/logger');

const profileController = {
    // ============================================
    // PROFILE OPERATIONS
    // ============================================

    /**
     * Get my profile
     * GET /api/v1/employee/profile
     */
    async getMyProfile(req, res, next) {
        try {
            const profile = await profileService.getEmployeeProfile(req.user.id);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee profile not found'
                });
            }

            logger.info('Employee viewed profile', {
                employeeId: req.user.id,
                employeeCode: profile.employee_code
            });

            res.json({
                success: true,
                data: profile
            });
        } catch (error) {
            logger.error('Error getting employee profile', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update profile
     * PUT /api/v1/employee/profile
     */
    async updateProfile(req, res, next) {
        try {
            const {
                phone,
                email,
                address,
                emergency_contact_name,
                emergency_contact_phone,
                emergency_contact_relation
            } = req.body;

            const profile = await profileService.getEmployeeProfile(req.user.id);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee profile not found'
                });
            }

            // Check if email is being changed and if it's already taken
            if (email && email !== profile.email) {
                const emailExists = await profileService.checkEmailExists(email, req.user.id);
                if (emailExists) {
                    return res.status(409).json({
                        success: false,
                        error: 'Email already in use by another user'
                    });
                }
            }

            // Check if phone is being changed and if it's already taken
            if (phone && phone !== profile.phone) {
                const phoneExists = await profileService.checkPhoneExists(phone, req.user.id);
                if (phoneExists) {
                    return res.status(409).json({
                        success: false,
                        error: 'Phone number already in use by another user'
                    });
                }
            }

            const updated = await profileService.updateProfile(
                req.user.id,
                {
                    phone,
                    email,
                    address,
                    emergency_contact_name,
                    emergency_contact_phone,
                    emergency_contact_relation,
                    updated_at: new Date(),
                    updated_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Employee updated profile', {
                employeeId: req.user.id,
                updates: Object.keys(req.body)
            });

            res.json({
                success: true,
                data: updated,
                message: 'Profile updated successfully'
            });
        } catch (error) {
            logger.error('Error updating employee profile', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Upload profile photo
     * POST /api/v1/employee/profile/photo
     */
    async uploadProfilePhoto(req, res, next) {
        try {
            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Photo file is required'
                });
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid file type. Only JPEG, PNG, and GIF are allowed'
                });
            }

            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (req.file.size > maxSize) {
                return res.status(400).json({
                    success: false,
                    error: 'File size too large. Maximum size is 5MB'
                });
            }

            const photo = await profileService.uploadProfilePhoto(
                req.user.id,
                {
                    file_buffer: req.file.buffer,
                    file_name: req.file.originalname,
                    file_size: req.file.size,
                    mime_type: req.file.mimetype,
                    uploaded_at: new Date(),
                    uploaded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Employee uploaded profile photo', {
                employeeId: req.user.id,
                fileSize: req.file.size,
                mimeType: req.file.mimetype
            });

            res.status(201).json({
                success: true,
                data: photo,
                message: 'Profile photo uploaded successfully'
            });
        } catch (error) {
            logger.error('Error uploading profile photo', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = profileController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Profile Operations     | 3         | Get profile, update, upload photo
 * -----------------------|-----------|----------------------
 * TOTAL                  | 3         | Complete profile management
 * 
 * ======================================================================
 */