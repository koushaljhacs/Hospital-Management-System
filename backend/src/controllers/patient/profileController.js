/**
 * ======================================================================
 * FILE: backend/src/controllers/patient/profileController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient profile controller handling personal information management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /patient/profile              - Get own profile
 * PUT    /patient/profile               - Update profile
 * PATCH  /patient/profile               - Partial update
 * GET    /patient/profile/photo         - Get profile photo
 * POST   /patient/profile/photo         - Upload photo
 * DELETE /patient/profile/photo         - Delete photo
 * 
 * ======================================================================
 */

const profileService = require('../../services/patient/profileService');
const logger = require('../../utils/logger');

/**
 * Patient Profile Controller
 */
const profileController = {
    /**
     * Get patient profile
     * GET /api/v1/patient/profile
     */
    async getProfile(req, res, next) {
        try {
            const profile = await profileService.getProfile(req.user.id);

            logger.info('Patient profile retrieved', { 
                userId: req.user.id,
                patientId: profile.id
            });

            res.json({
                success: true,
                data: profile
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
     * Update patient profile
     * PUT /api/v1/patient/profile
     */
    async updateProfile(req, res, next) {
        try {
            const updates = {
                ...req.body,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            const updatedProfile = await profileService.updateProfile(
                req.user.id, 
                updates, 
                req.user.id
            );

            logger.info('Patient profile updated', { 
                userId: req.user.id,
                updates: Object.keys(req.body)
            });

            res.json({
                success: true,
                data: updatedProfile,
                message: 'Profile updated successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message.includes('Phone number already registered')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Partial update profile
     * PATCH /api/v1/patient/profile
     */
    async partialUpdateProfile(req, res, next) {
        try {
            // Only allow specific fields for partial update
            const allowedFields = [
                'phone', 'alternate_phone', 'address', 
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relation', 'blood_group'
            ];

            const updates = {};
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            });

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid fields to update'
                });
            }

            updates.ip = req.ip;
            updates.userAgent = req.headers['user-agent'];

            const updatedProfile = await profileService.updateProfile(
                req.user.id,
                updates,
                req.user.id
            );

            logger.info('Patient profile partially updated', { 
                userId: req.user.id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updatedProfile,
                message: 'Profile updated successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get profile photo
     * GET /api/v1/patient/profile/photo
     */
    async getProfilePhoto(req, res, next) {
        try {
            const profile = await profileService.getProfile(req.user.id);

            if (!profile.profile_photo) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile photo not found'
                });
            }

            // Redirect to photo URL or return base64
            res.json({
                success: true,
                data: {
                    photo_url: profile.profile_photo
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
     * Upload profile photo
     * POST /api/v1/patient/profile/photo
     */
    async uploadProfilePhoto(req, res, next) {
        try {
            // In production, you'd handle file upload here
            // For now, assume photo URL is sent in body
            const { photo_url } = req.body;

            if (!photo_url) {
                return res.status(400).json({
                    success: false,
                    error: 'Photo URL is required'
                });
            }

            const result = await profileService.uploadPhoto(
                req.user.id,
                photo_url
            );

            logger.info('Profile photo uploaded', { 
                userId: req.user.id
            });

            res.json({
                success: true,
                data: result,
                message: 'Profile photo uploaded successfully'
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
     * Delete profile photo
     * DELETE /api/v1/patient/profile/photo
     */
    async deleteProfilePhoto(req, res, next) {
        try {
            await profileService.deletePhoto(req.user.id);

            logger.info('Profile photo deleted', { 
                userId: req.user.id
            });

            res.json({
                success: true,
                message: 'Profile photo deleted successfully'
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
     * Get emergency contacts
     * GET /api/v1/patient/emergency-contacts
     */
    async getEmergencyContacts(req, res, next) {
        try {
            const profile = await profileService.getProfile(req.user.id);

            const contacts = [{
                name: profile.emergency_contact_name,
                phone: profile.emergency_contact_phone,
                relation: profile.emergency_contact_relation
            }];

            // In future, this could return multiple contacts

            res.json({
                success: true,
                data: contacts
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Add emergency contact
     * POST /api/v1/patient/emergency-contacts
     */
    async addEmergencyContact(req, res, next) {
        try {
            const { name, phone, relation } = req.body;

            if (!name || !phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Name and phone are required'
                });
            }

            const updates = {
                emergency_contact_name: name,
                emergency_contact_phone: phone,
                emergency_contact_relation: relation || null
            };

            const updatedProfile = await profileService.updateProfile(
                req.user.id,
                updates,
                req.user.id
            );

            logger.info('Emergency contact added', { 
                userId: req.user.id
            });

            res.json({
                success: true,
                data: {
                    name: updatedProfile.emergency_contact_name,
                    phone: updatedProfile.emergency_contact_phone,
                    relation: updatedProfile.emergency_contact_relation
                },
                message: 'Emergency contact added successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update emergency contact
     * PUT /api/v1/patient/emergency-contacts/:id
     */
    async updateEmergencyContact(req, res, next) {
        try {
            // For now, only one contact exists
            const { name, phone, relation } = req.body;

            const updates = {};
            if (name) updates.emergency_contact_name = name;
            if (phone) updates.emergency_contact_phone = phone;
            if (relation) updates.emergency_contact_relation = relation;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No fields to update'
                });
            }

            const updatedProfile = await profileService.updateProfile(
                req.user.id,
                updates,
                req.user.id
            );

            logger.info('Emergency contact updated', { 
                userId: req.user.id
            });

            res.json({
                success: true,
                data: {
                    name: updatedProfile.emergency_contact_name,
                    phone: updatedProfile.emergency_contact_phone,
                    relation: updatedProfile.emergency_contact_relation
                },
                message: 'Emergency contact updated successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete emergency contact
     * DELETE /api/v1/patient/emergency-contacts/:id
     */
    async deleteEmergencyContact(req, res, next) {
        try {
            const updates = {
                emergency_contact_name: null,
                emergency_contact_phone: null,
                emergency_contact_relation: null
            };

            await profileService.updateProfile(
                req.user.id,
                updates,
                req.user.id
            );

            logger.info('Emergency contact deleted', { 
                userId: req.user.id
            });

            res.json({
                success: true,
                message: 'Emergency contact deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = profileController;

/**
 * ======================================================================
 * USAGE IN ROUTES:
 * ======================================================================
 * 
 * const profileController = require('./controllers/patient/profileController');
 * 
 * // Profile routes
 * router.get('/profile', authenticate, profileController.getProfile);
 * router.put('/profile', authenticate, profileController.updateProfile);
 * router.patch('/profile', authenticate, profileController.partialUpdateProfile);
 * router.get('/profile/photo', authenticate, profileController.getProfilePhoto);
 * router.post('/profile/photo', authenticate, profileController.uploadProfilePhoto);
 * router.delete('/profile/photo', authenticate, profileController.deleteProfilePhoto);
 * 
 * // Emergency contacts
 * router.get('/emergency-contacts', authenticate, profileController.getEmergencyContacts);
 * router.post('/emergency-contacts', authenticate, profileController.addEmergencyContact);
 * router.put('/emergency-contacts/:id', authenticate, profileController.updateEmergencyContact);
 * router.delete('/emergency-contacts/:id', authenticate, profileController.deleteEmergencyContact);
 * 
 * ======================================================================
 */