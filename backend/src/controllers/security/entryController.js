/**
 * ======================================================================
 * FILE: backend/src/controllers/security/entryController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard entry controller - Handles entry management.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-49] All entries must be logged with ID verification
 * - [BR-51] Exit must be recorded for all entries
 * 
 * ======================================================================
 */

const entryService = require('../../services/security/entryService');
const logger = require('../../utils/logger');

const entryController = {
    // ============================================
    // ENTRY LISTS
    // ============================================

    /**
     * Get all entries
     * GET /api/v1/security/entries
     */
    async getAllEntries(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                entry_type,
                status,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                entry_type,
                status,
                from_date,
                to_date
            };

            const entries = await entryService.getAllEntries(
                req.user.id,
                options
            );

            logger.info('Security guard retrieved entries', {
                guardId: req.user.id,
                count: entries.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: entries.data,
                pagination: entries.pagination,
                summary: entries.summary
            });
        } catch (error) {
            logger.error('Error getting all entries', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's entries
     * GET /api/v1/security/entries/today
     */
    async getTodayEntries(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const entries = await entryService.getTodayEntries(
                req.user.id,
                options
            );

            logger.info('Security guard viewed today\'s entries', {
                guardId: req.user.id,
                count: entries.data?.length || 0
            });

            // Calculate summary
            const byType = {
                employee: entries.data?.filter(e => e.entry_type === 'employee').length || 0,
                patient: entries.data?.filter(e => e.entry_type === 'patient').length || 0,
                visitor: entries.data?.filter(e => e.entry_type === 'visitor').length || 0,
                vendor: entries.data?.filter(e => e.entry_type === 'vendor').length || 0,
                emergency: entries.data?.filter(e => e.entry_type === 'emergency').length || 0
            };

            const activeCount = entries.data?.filter(e => e.exit_time === null).length || 0;

            res.json({
                success: true,
                data: entries.data,
                pagination: entries.pagination,
                summary: {
                    total: entries.summary?.total || 0,
                    by_type: byType,
                    active: activeCount,
                    completed: entries.data?.length - activeCount
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s entries', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get entry by ID
     * GET /api/v1/security/entries/:id
     */
    async getEntryById(req, res, next) {
        try {
            const { id } = req.params;

            const entry = await entryService.getEntryById(
                req.user.id,
                id
            );

            if (!entry) {
                return res.status(404).json({
                    success: false,
                    error: 'Entry record not found'
                });
            }

            logger.info('Security guard viewed entry details', {
                guardId: req.user.id,
                entryId: id,
                entryType: entry.entry_type,
                personName: entry.person_name
            });

            // Calculate duration if exited
            if (entry.exit_time) {
                const entryTime = new Date(entry.entry_time);
                const exitTime = new Date(entry.exit_time);
                const durationMinutes = (exitTime - entryTime) / (1000 * 60);
                entry.duration_minutes = Math.floor(durationMinutes);
                entry.duration_hours = (durationMinutes / 60).toFixed(1);
            }

            res.json({
                success: true,
                data: entry
            });
        } catch (error) {
            if (error.message === 'Entry not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Entry record not found'
                });
            }
            logger.error('Error getting entry by ID', {
                error: error.message,
                guardId: req.user.id,
                entryId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get active entries
     * GET /api/v1/security/entries/active
     */
    async getActiveEntries(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const entries = await entryService.getActiveEntries(
                req.user.id,
                options
            );

            logger.info('Security guard viewed active entries', {
                guardId: req.user.id,
                count: entries.data?.length || 0
            });

            // Calculate time since entry for each active entry
            const now = new Date();
            const entriesWithDuration = entries.data?.map(entry => ({
                ...entry,
                time_since_entry_minutes: Math.floor((now - new Date(entry.entry_time)) / (1000 * 60)),
                time_since_entry_hours: ((now - new Date(entry.entry_time)) / (1000 * 60 * 60)).toFixed(1)
            }));

            res.json({
                success: true,
                data: entriesWithDuration,
                pagination: entries.pagination,
                summary: {
                    total: entries.summary?.total || 0,
                    by_type: {
                        employee: entries.data?.filter(e => e.entry_type === 'employee').length || 0,
                        patient: entries.data?.filter(e => e.entry_type === 'patient').length || 0,
                        visitor: entries.data?.filter(e => e.entry_type === 'visitor').length || 0,
                        vendor: entries.data?.filter(e => e.entry_type === 'vendor').length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting active entries', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // ENTRY OPERATIONS
    // ============================================

    /**
     * Record entry
     * POST /api/v1/security/entries
     * 
     * BUSINESS RULE: [BR-49] All entries must be logged with ID verification
     */
    async recordEntry(req, res, next) {
        try {
            const {
                person_name,
                entry_type,
                id_type,
                id_number,
                purpose,
                department_to_visit,
                person_to_meet,
                vehicle_number,
                notes
            } = req.body;

            // Validate required fields [BR-49]
            if (!person_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Person name is required'
                });
            }

            if (!entry_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Entry type is required'
                });
            }

            if (!id_type || !id_number) {
                return res.status(400).json({
                    success: false,
                    error: 'ID verification is required'
                });
            }

            const entry = await entryService.recordEntry(
                req.user.id,
                {
                    person_name,
                    entry_type,
                    id_type,
                    id_number,
                    purpose,
                    department_to_visit,
                    person_to_meet,
                    vehicle_number,
                    notes,
                    entry_time: new Date(),
                    recorded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Security guard recorded entry', {
                guardId: req.user.id,
                entryId: entry.id,
                personName: person_name,
                entryType: entry_type,
                idType: id_type
            });

            res.status(201).json({
                success: true,
                data: entry,
                message: 'Entry recorded successfully'
            });
        } catch (error) {
            logger.error('Error recording entry', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Mark exit for entry
     * PUT /api/v1/security/entries/:id/exit
     * 
     * BUSINESS RULE: [BR-51] Exit must be recorded for all entries
     */
    async markExit(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, exit_time } = req.body;

            const entry = await entryService.getEntryById(req.user.id, id);
            
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

            const exitRecord = await entryService.markExit(
                req.user.id,
                id,
                {
                    notes,
                    exit_time: exit_time || new Date(),
                    recorded_by: req.user.id
                }
            );

            // Calculate duration
            const entryTime = new Date(entry.entry_time);
            const exitTimeRecorded = new Date(exitRecord.exit_time);
            const durationMinutes = (exitTimeRecorded - entryTime) / (1000 * 60);

            logger.info('Security guard recorded exit', {
                guardId: req.user.id,
                entryId: id,
                personName: entry.person_name,
                durationMinutes: Math.floor(durationMinutes)
            });

            res.json({
                success: true,
                data: exitRecord,
                message: 'Exit recorded successfully',
                duration_minutes: Math.floor(durationMinutes)
            });
        } catch (error) {
            if (error.message === 'Entry not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Entry record not found'
                });
            }
            logger.error('Error marking exit', {
                error: error.message,
                guardId: req.user.id,
                entryId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = entryController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Entry Lists            | 3         | All, today, active, by ID
 * Entry Operations       | 2         | Record entry, mark exit
 * -----------------------|-----------|----------------------
 * TOTAL                  | 5         | Complete entry management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-49] ID verification validation
 * - [BR-51] Exit recording requirement
 * 
 * ======================================================================
 */