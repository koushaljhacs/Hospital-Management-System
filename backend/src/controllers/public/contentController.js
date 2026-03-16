/**
 * ======================================================================
 * FILE: backend/src/controllers/public/contentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public content controller - No authentication required.
 * Endpoints: /public/contact-form, /public/faq, /public/announcements
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

const contentController = {
    /**
     * Submit contact form
     * POST /api/v1/public/contact-form
     */
    async submitContactForm(req, res, next) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const { name, email, phone, message, department } = req.body;

            const query = `
                INSERT INTO contact_queries (
                    id, name, email, phone, message, department,
                    status, created_at, ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), $7, $8)
                RETURNING id
            `;

            const id = uuidv4();
            const values = [
                id,
                name,
                email,
                phone || null,
                message,
                department || 'general',
                req.ip,
                req.headers['user-agent']
            ];

            await client.query(query, values);

            // Send notification email to admin (async, don't wait)
            this._sendAdminNotification({ name, email, phone, message, department });

            await db.commitTransaction(client);

            logger.info('Public contact form submitted', {
                queryId: id,
                name,
                email,
                department: department || 'general'
            });

            res.status(201).json({
                success: true,
                message: 'Your query has been submitted. We will get back to you soon.'
            });
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error in public contact form', { error: error.message });
            next(error);
        } finally {
            client.release();
        }
    },

    /**
     * Get FAQs
     * GET /api/v1/public/faq
     */
    async getFaqs(req, res, next) {
        try {
            const { category } = req.query;

            let query = `
                SELECT 
                    id, question, answer, category,
                    display_order, is_featured
                FROM faqs
                WHERE is_active = true
            `;
            const values = [];

            if (category) {
                query += ` AND category = $1`;
                values.push(category);
            }

            query += ` ORDER BY display_order ASC, category ASC`;

            const result = await db.query(query, values);

            // Group by category for better display
            const grouped = result.rows.reduce((acc, faq) => {
                if (!acc[faq.category]) {
                    acc[faq.category] = [];
                }
                acc[faq.category].push(faq);
                return acc;
            }, {});

            // Get featured FAQs
            const featured = result.rows.filter(f => f.is_featured);

            logger.info('Public FAQs accessed', {
                total: result.rows.length,
                categories: Object.keys(grouped).length
            });

            res.json({
                success: true,
                data: grouped,
                summary: {
                    total: result.rows.length,
                    categories: Object.keys(grouped),
                    featured_count: featured.length,
                    featured: featured.slice(0, 5)
                }
            });
        } catch (error) {
            logger.error('Error in public FAQs', { error: error.message });
            next(error);
        }
    },

    /**
     * Get announcements
     * GET /api/v1/public/announcements
     */
    async getAnnouncements(req, res, next) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    id, title, content, type,
                    priority, valid_from, valid_to,
                    created_at, updated_at
                FROM announcements
                WHERE is_active = true 
                    AND (valid_from IS NULL OR valid_from <= NOW())
                    AND (valid_to IS NULL OR valid_to >= NOW())
                ORDER BY priority DESC, created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM announcements
                WHERE is_active = true 
                    AND (valid_from IS NULL OR valid_from <= NOW())
                    AND (valid_to IS NULL OR valid_to >= NOW())
            `;
            const countResult = await db.query(countQuery);

            // Separate by type for frontend
            const byType = {
                news: result.rows.filter(a => a.type === 'news'),
                event: result.rows.filter(a => a.type === 'event'),
                alert: result.rows.filter(a => a.type === 'alert'),
                general: result.rows.filter(a => a.type === 'general')
            };

            logger.info('Public announcements accessed', {
                total: result.rows.length
            });

            res.json({
                success: true,
                data: result.rows,
                by_type: byType,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
                }
            });
        } catch (error) {
            logger.error('Error in public announcements', { error: error.message });
            next(error);
        }
    },

    /**
     * Private method to send admin notification email
     */
    async _sendAdminNotification(data) {
        try {
            // This will be implemented when email service is ready
            // For now, just log it
            logger.info('Admin notification would be sent', { data });
            
            // TODO: Integrate with email service
            // await emailService.sendAdminContactNotification(data);
        } catch (error) {
            logger.error('Error sending admin notification', { error: error.message });
        }
    }
};

module.exports = contentController;