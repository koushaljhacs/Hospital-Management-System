/**
 * ======================================================================
 * FILE: backend/src/services/radiologist/reportService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist report service - Handles business logic for radiology reports.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-42] Reports need verification before finalization
 * - [BR-44] Comparison with previous studies required
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const PDFDocument = require('pdfkit');

const reportService = {
    /**
     * Get all reports
     */
    async getAllReports(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, order_id, radiologist_id, from_date, to_date, critical_finding } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT r.*, 
                       o.order_number,
                       o.priority,
                       o.is_emergency,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       CONCAT(rad.first_name, ' ', rad.last_name) as radiologist_name,
                       CONCAT(ver.first_name, ' ', ver.last_name) as verifier_name,
                       EXTRACT(EPOCH FROM (r.completed_at - r.created_at))/3600 as report_time_hours
                FROM radiology_reports r
                JOIN radiology_orders o ON r.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                LEFT JOIN employees rad ON r.created_by = rad.id
                LEFT JOIN employees ver ON r.verified_by = ver.id
                WHERE r.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                const statuses = Array.isArray(status) ? status : [status];
                query += ` AND r.status = ANY($${paramIndex}::text[])`;
                values.push(statuses);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND o.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (order_id) {
                query += ` AND r.order_id = $${paramIndex}`;
                values.push(order_id);
                paramIndex++;
            }

            if (radiologist_id) {
                query += ` AND r.created_by = $${paramIndex}`;
                values.push(radiologist_id);
                paramIndex++;
            }

            if (critical_finding === true) {
                query += ` AND r.critical_finding = true`;
            }

            if (from_date) {
                query += ` AND r.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND r.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY r.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'preliminary') as preliminary,
                    COUNT(*) FILTER (WHERE status = 'final') as final,
                    COUNT(*) FILTER (WHERE status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE status = 'amended') as amended,
                    COUNT(*) FILTER (WHERE critical_finding = true) as critical_count
                FROM radiology_reports
                WHERE is_deleted = false
                ${patient_id ? 'AND order_id IN (SELECT id FROM radiology_orders WHERE patient_id = $1)' : ''}
            `;
            const countValues = patient_id ? [patient_id] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAllReports', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get reports by status
     */
    async getReportsByStatus(radiologistId, statuses, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT r.*, 
                       o.order_number,
                       o.priority,
                       o.is_emergency,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       CONCAT(rad.first_name, ' ', rad.last_name) as radiologist_name
                FROM radiology_reports r
                JOIN radiology_orders o ON r.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                LEFT JOIN employees rad ON r.created_by = rad.id
                WHERE r.status = ANY($1::text[]) AND r.is_deleted = false
            `;
            const values = [statuses];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND r.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND r.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                          CASE o.priority
                              WHEN 'stat' THEN 1
                              WHEN 'urgent' THEN 2
                              ELSE 3
                          END,
                          r.created_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM radiology_reports
                WHERE status = ANY($1::text[]) AND is_deleted = false
            `;
            const count = await db.query(countQuery, [statuses]);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0]?.total || 0)
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getReportsByStatus', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get report by ID
     */
    async getReportById(radiologistId, reportId) {
        try {
            const query = `
                SELECT r.*, 
                       o.id as order_id,
                       o.order_number,
                       o.priority,
                       o.is_emergency,
                       o.clinical_history,
                       o.indication,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.phone as patient_phone,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       d.specialization as doctor_specialization,
                       CONCAT(rad.first_name, ' ', rad.last_name) as radiologist_name,
                       CONCAT(ver.first_name, ' ', ver.last_name) as verifier_name,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', i.id,
                                   'image_type', i.image_type,
                                   'image_url', i.image_url,
                                   'modality', i.modality,
                                   'body_part', i.body_part
                               )
                           )
                           FROM radiology_images i
                           WHERE i.order_id = o.id AND i.is_deleted = false
                       ) as images
                FROM radiology_reports r
                JOIN radiology_orders o ON r.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                LEFT JOIN employees rad ON r.created_by = rad.id
                LEFT JOIN employees ver ON r.verified_by = ver.id
                WHERE r.id = $1 AND r.is_deleted = false
            `;

            const result = await db.query(query, [reportId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getReportById', { error: error.message, radiologistId, reportId });
            throw error;
        }
    },

    /**
     * Get previous reports for comparison [BR-44]
     */
    async getPreviousReports(radiologistId, patientId, currentReportId) {
        try {
            const query = `
                SELECT r.id, r.findings, r.impression, r.created_at,
                       o.order_number, o.priority
                FROM radiology_reports r
                JOIN radiology_orders o ON r.order_id = o.id
                WHERE o.patient_id = $1 
                    AND r.id != $2
                    AND r.status IN ('final', 'verified')
                    AND r.is_deleted = false
                ORDER BY r.created_at DESC
                LIMIT 10
            `;

            const result = await db.query(query, [patientId, currentReportId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPreviousReports', { error: error.message, radiologistId, patientId });
            throw error;
        }
    },

    /**
     * Get order details
     */
    async getOrderDetails(radiologistId, orderId) {
        try {
            const query = `
                SELECT o.*, p.id as patient_id, p.first_name, p.last_name, d.id as doctor_id
                FROM radiology_orders o
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                WHERE o.id = $1 AND o.is_deleted = false
            `;
            const result = await db.query(query, [orderId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getOrderDetails', { error: error.message, radiologistId, orderId });
            throw error;
        }
    },

    /**
     * Check if patient has previous studies [BR-44]
     */
    async hasPreviousStudies(radiologistId, patientId) {
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM radiology_orders o
                JOIN radiology_reports r ON o.id = r.order_id
                WHERE o.patient_id = $1 
                    AND r.status IN ('final', 'verified')
                    AND r.is_deleted = false
            `, [patientId]);
            return parseInt(result.rows[0]?.count || 0) > 0;
        } catch (error) {
            logger.error('Error in hasPreviousStudies', { error: error.message, radiologistId, patientId });
            throw error;
        }
    },

    /**
     * Create report
     */
    async createReport(radiologistId, reportData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if report already exists for this order
            const existingCheck = await client.query(`
                SELECT id FROM radiology_reports 
                WHERE order_id = $1 AND is_deleted = false
            `, [reportData.order_id]);

            if (existingCheck.rows.length > 0) {
                throw new Error('Report already exists for this order');
            }

            // Generate report number
            const reportNumber = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const query = `
                INSERT INTO radiology_reports (
                    id, report_number, order_id, findings, impression,
                    technique, comparison, recommendations,
                    critical_finding, critical_finding_communicated_to,
                    critical_finding_notes, status, created_by, created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
                ) RETURNING *
            `;

            const values = [
                reportNumber,
                reportData.order_id,
                reportData.findings,
                reportData.impression,
                reportData.technique,
                reportData.comparison,
                reportData.recommendations,
                reportData.critical_finding,
                reportData.critical_finding_communicated_to,
                reportData.critical_finding_notes,
                reportData.status,
                reportData.created_by,
                reportData.created_at
            ];

            const result = await client.query(query, values);

            // Update order status
            await client.query(`
                UPDATE radiology_orders 
                SET status = CASE 
                    WHEN $1 = 'preliminary' THEN 'in_progress'
                    ELSE 'in_progress'
                END,
                updated_at = NOW()
                WHERE id = $2
            `, [reportData.status, reportData.order_id]);

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
     * Update report
     */
    async updateReport(radiologistId, reportId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'findings', 'impression', 'technique', 'comparison',
                'recommendations', 'critical_finding', 'critical_finding_communicated_to',
                'critical_finding_notes', 'status'
            ];

            for (const [key, value] of Object.entries(updateData)) {
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
            values.push(reportId);

            const query = `
                UPDATE radiology_reports 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Report not found');
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
     * Delete report
     */
    async deleteReport(radiologistId, reportId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_reports 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    deletion_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status IN ('pending', 'preliminary')
                RETURNING id
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                deleteData.reason,
                reportId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Report not found or cannot be deleted');
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
     * Submit report for review
     */
    async submitReport(radiologistId, reportId, submitData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_reports 
                SET status = 'final',
                    submitted_at = $1,
                    submitted_by = $2,
                    submission_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status IN ('pending', 'preliminary')
                RETURNING *
            `;

            const values = [
                submitData.submitted_at,
                submitData.submitted_by,
                submitData.notes,
                reportId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Report not found or cannot be submitted');
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
     * Verify report [BR-42]
     */
    async verifyReport(radiologistId, reportId, verifyData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_reports 
                SET status = $1,
                    verified_by = $2,
                    verified_at = $3,
                    verification_notes = $4,
                    updated_at = NOW()
                WHERE id = $5 
                    AND status IN ('final', 'preliminary')
                    AND created_by != $2
                RETURNING *
            `;

            const status = verifyData.is_verified ? 'verified' : 'amended';

            const values = [
                status,
                verifyData.verified_by,
                verifyData.verified_at,
                verifyData.notes,
                reportId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Report not found or cannot be verified');
            }

            // If verified, update order status
            if (verifyData.is_verified) {
                await client.query(`
                    UPDATE radiology_orders 
                    SET status = 'completed',
                        completed_at = $1,
                        updated_at = NOW()
                    WHERE id = (SELECT order_id FROM radiology_reports WHERE id = $2)
                `, [verifyData.verified_at, reportId]);
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
     * Get version history
     */
    async getVersionHistory(radiologistId, reportId) {
        try {
            const query = `
                SELECT v.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
                FROM radiology_report_versions v
                LEFT JOIN users u ON v.changed_by = u.id
                WHERE v.report_id = $1
                ORDER BY v.changed_at DESC
                LIMIT 20
            `;

            const result = await db.query(query, [reportId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getVersionHistory', { error: error.message, radiologistId, reportId });
            throw error;
        }
    },

    /**
     * Generate PDF report
     */
    async generatePdfReport(radiologistId, reportId, format = 'pdf') {
        try {
            const report = await this.getReportById(radiologistId, reportId);
            
            if (!report) {
                throw new Error('Report not found');
            }

            // Create PDF document
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {});

            // Header
            doc.fontSize(20).font('Helvetica-Bold').text('RADIOLOGY REPORT', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(10).font('Helvetica').text(`Report Number: ${report.report_number}`, { align: 'right' });
            doc.text(`Date: ${new Date(report.created_at).toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            // Patient Information
            doc.fontSize(12).font('Helvetica-Bold').text('PATIENT INFORMATION');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Name: ${report.patient_first_name} ${report.patient_last_name}`);
            doc.text(`DOB: ${new Date(report.patient_dob).toLocaleDateString()}`);
            doc.text(`Gender: ${report.patient_gender}`);
            doc.text(`MRN: ${report.patient_id}`);
            doc.moveDown();

            // Order Information
            doc.fontSize(12).font('Helvetica-Bold').text('ORDER INFORMATION');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Order Number: ${report.order_number}`);
            doc.text(`Referring Doctor: Dr. ${report.doctor_first_name} ${report.doctor_last_name}`);
            doc.text(`Priority: ${report.priority?.toUpperCase() || 'ROUTINE'}`);
            doc.moveDown();

            // Clinical Information
            if (report.clinical_history) {
                doc.fontSize(12).font('Helvetica-Bold').text('CLINICAL HISTORY');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(report.clinical_history);
                doc.moveDown();
            }

            if (report.indication) {
                doc.fontSize(12).font('Helvetica-Bold').text('INDICATION');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(report.indication);
                doc.moveDown();
            }

            if (report.technique) {
                doc.fontSize(12).font('Helvetica-Bold').text('TECHNIQUE');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(report.technique);
                doc.moveDown();
            }

            if (report.comparison) {
                doc.fontSize(12).font('Helvetica-Bold').text('COMPARISON');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(report.comparison);
                doc.moveDown();
            }

            // Findings
            doc.fontSize(12).font('Helvetica-Bold').text('FINDINGS');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(report.findings || 'No findings recorded');
            doc.moveDown();

            // Impression
            doc.fontSize(12).font('Helvetica-Bold').text('IMPRESSION');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(report.impression || 'No impression recorded');
            doc.moveDown();

            // Recommendations
            if (report.recommendations) {
                doc.fontSize(12).font('Helvetica-Bold').text('RECOMMENDATIONS');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(report.recommendations);
                doc.moveDown();
            }

            // Critical Findings
            if (report.critical_finding) {
                doc.fontSize(10).font('Helvetica-Bold').fillColor('red');
                doc.text('CRITICAL FINDING');
                doc.fillColor('black');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Communicated to: ${report.critical_finding_communicated_to || 'Not documented'}`);
                doc.text(`Notes: ${report.critical_finding_notes || 'None'}`);
                doc.moveDown();
            }

            // Report Status
            doc.fontSize(10).font('Helvetica');
            doc.text(`Report Status: ${report.status?.toUpperCase() || 'PENDING'}`);
            doc.text(`Radiologist: Dr. ${report.radiologist_name || 'Not assigned'}`);
            
            if (report.verified_at) {
                doc.text(`Verified By: Dr. ${report.verifier_name || 'Unknown'}`);
                doc.text(`Verified At: ${new Date(report.verified_at).toLocaleString()}`);
            }

            doc.moveDown();
            doc.fontSize(8).font('Helvetica-Oblique');
            doc.text('This report is electronically generated and does not require a signature.', { align: 'center' });

            doc.end();

            return Buffer.concat(chunks);
        } catch (error) {
            logger.error('Error in generatePdfReport', { error: error.message, radiologistId, reportId });
            throw error;
        }
    }
};

module.exports = reportService;