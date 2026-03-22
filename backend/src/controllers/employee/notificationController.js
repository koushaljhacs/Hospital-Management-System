/**
 * ======================================================================
 * FILE: backend/src/controllers/employee/notificationController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee notification controller - Handles notification management.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const notificationService = require('../../services/employee/notificationService');
const logger = require('../../utils/logger');

const notificationController = {
    // ============================================
    // NOTIFICATION LISTS
    // ============================================

    /**
     * Get notifications
     * GET /api/v1/employee/notifications
     */
    async getNotifications(req, res, next) {
        try {
            const { page = 1, limit = 20, type, is_read } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                type,
                is_read: is_read === 'true'
            };

            const notifications = await notificationService.getNotifications(
                req.user.id,
                options
            );

            logger.info('Employee viewed notifications', {
                employeeId: req.user.id,
                count: notifications.data?.length || 0,
                unreadCount: notifications.unread_count
            });

            res.json({
                success: true,
                data: notifications.data,
                pagination: notifications.pagination,
                unread_count: notifications.unread_count,
                summary: {
                    total: notifications.summary?.total || 0,
                    by_type: {
                        shift: notifications.data?.filter(n => n.type === 'shift').length || 0,
                        leave: notifications.data?.filter(n => n.type === 'leave').length || 0,
                        attendance: notifications.data?.filter(n => n.type === 'attendance').length || 0,
                        document: notifications.data?.filter(n => n.type === 'document').length || 0,
                        system: notifications.data?.filter(n => n.type === 'system').length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting notifications', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get unread notifications
     * GET /api/v1/employee/notifications/unread
     */
    async getUnreadNotifications(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notifications = await notificationService.getUnreadNotifications(
                req.user.id,
                options
            );

            logger.info('Employee viewed unread notifications', {
                employeeId: req.user.id,
                count: notifications.data?.length || 0
            });

            res.json({
                success: true,
                data: notifications.data,
                pagination: notifications.pagination,
                unread_count: notifications.unread_count
            });
        } catch (error) {
            logger.error('Error getting unread notifications', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // NOTIFICATION OPERATIONS
    // ============================================

    /**
     * Mark notification as read
     * PUT /api/v1/employee/notifications/:id/read
     */
    async markAsRead(req, res, next) {
        try {
            const { id } = req.params;

            const notification = await notificationService.getNotificationById(
                req.user.id,
                id
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            if (notification.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            if (notification.is_read) {
                return res.status(400).json({
                    success: false,
                    error: 'Notification already marked as read'
                });
            }

            const updated = await notificationService.markAsRead(
                req.user.id,
                id,
                {
                    read_at: new Date(),
                    read_by: req.user.id
                }
            );

            logger.info('Employee marked notification as read', {
                employeeId: req.user.id,
                notificationId: id,
                type: notification.type
            });

            res.json({
                success: true,
                data: updated,
                message: 'Notification marked as read'
            });
        } catch (error) {
            if (error.message === 'Notification not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }
            logger.error('Error marking notification as read', {
                error: error.message,
                employeeId: req.user.id,
                notificationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/employee/notifications/read-all
     */
    async markAllAsRead(req, res, next) {
        try {
            const count = await notificationService.markAllAsRead(req.user.id);

            logger.info('Employee marked all notifications as read', {
                employeeId: req.user.id,
                count
            });

            res.json({
                success: true,
                message: `${count} notifications marked as read`,
                count
            });
        } catch (error) {
            logger.error('Error marking all notifications as read', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Delete notification
     * DELETE /api/v1/employee/notifications/:id
     */
    async deleteNotification(req, res, next) {
        try {
            const { id } = req.params;

            const notification = await notificationService.getNotificationById(
                req.user.id,
                id
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            if (notification.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const deleted = await notificationService.deleteNotification(
                req.user.id,
                id,
                {
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            logger.info('Employee deleted notification', {
                employeeId: req.user.id,
                notificationId: id,
                type: notification.type
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Notification deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Notification not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }
            logger.error('Error deleting notification', {
                error: error.message,
                employeeId: req.user.id,
                notificationId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = notificationController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Notification Lists     | 2         | All, unread
 * Notification Operations| 3         | Mark read, mark all read, delete
 * -----------------------|-----------|----------------------
 * TOTAL                  | 5         | Complete notification management
 * 
 * ======================================================================
 */