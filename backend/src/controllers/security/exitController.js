/**
 * ======================================================================
 * FILE: backend/src/controllers/security/exitController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard exit controller - Handles exit management.
 * Total Endpoints: 2
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-51] Exit must be recorded for all entries
 * 
 * ======================================================================
 */

const exitService = require('../../services/security/exitService');
const logger = require('../../utils/logger');

const exitController = {
    // ============================================
    // EXIT OPERATIONS
    // ============================================

    /**
     * Record exit
     * POST /api/v1/security/exits
     * 
     * BUSINESS RULE: [BR-51] Exit must be recorded for all entries
     */
    async recordExit(req, res, next) {
        try {
            const { entry_id, notes, exit_time } = req.body;

            if (!entry_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Entry ID is required'
                });
            }

            // Get entry details
            const entry = await exitService.getEntryById(req.user.id, entry_id);
            
            if (!entry) {
                return res.status(404).json({
                    success: false,
                    error: 'Entry record not found'
                });
            }

            if (entry.exit_time) {
                return res.status(400).json({
                    success: false,
                    error: 'Exit already recorded for this entry'
                });
            }

            const exitRecord = await exitService.recordExit(
                req.user.id,
                {
                    entry_id,
                    notes,
                    exit_time: exit_time || new Date(),
                    recorded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            // Calculate duration
            const entryTime = new Date(entry.entry_time);
            const exitTimeRecorded = new Date(exitRecord.exit_time);
            const durationMinutes = (exitTimeRecorded - entryTime) / (1000 * 60);

            logger.info('Security guard recorded exit', {
                guardId: req.user.id,
                entryId: entry_id,
                personName: entry.person_name,
                entryType: entry.entry_type,
                durationMinutes: Math.floor(durationMinutes)
            });

            res.status(201).json({
                success: true,
                data: exitRecord,
                message: 'Exit recorded successfully',
                duration_minutes: Math.floor(durationMinutes),
                duration_hours: (durationMinutes / 60).toFixed(1)
            });
        } catch (error) {
            if (error.message === 'Entry not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Entry record not found'
                });
            }
            logger.error('Error recording exit', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's exits
     * GET /api/v1/security/exits/today
     */
    async getTodayExits(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const exits = await exitService.getTodayExits(
                req.user.id,
                options
            );

            logger.info('Security guard viewed today\'s exits', {
                guardId: req.user.id,
                count: exits.data?.length || 0
            });

            // Calculate summary
            const byType = {
                employee: exits.data?.filter(e => e.entry_type === 'employee').length || 0,
                patient: exits.data?.filter(e => e.entry_type === 'patient').length || 0,
                visitor: exits.data?.filter(e => e.entry_type === 'visitor').length || 0,
                vendor: exits.data?.filter(e => e.entry_type === 'vendor').length || 0,
                emergency: exits.data?.filter(e => e.entry_type === 'emergency').length || 0
            };

            // Calculate average duration
            const totalDuration = exits.data?.reduce((sum, e) => {
                if (e.duration_minutes) {
                    return sum + e.duration_minutes;
                }
                return sum;
            }, 0) || 0;

            const avgDuration = exits.data?.length > 0 
                ? Math.round(totalDuration / exits.data.length) 
                : 0;

            res.json({
                success: true,
                data: exits.data,
                pagination: exits.pagination,
                summary: {
                    total: exits.summary?.total || 0,
                    by_type: byType,
                    avg_duration_minutes: avgDuration,
                    total_duration_hours: Math.round(totalDuration / 60)
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s exits', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = exitController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Exit Operations        | 1         | Record exit
 * Exit Lists             | 1         | Today's exits
 * -----------------------|-----------|----------------------
 * TOTAL                  | 2         | Complete exit management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-51] Exit recording with entry validation
 * 
 * ======================================================================
 */