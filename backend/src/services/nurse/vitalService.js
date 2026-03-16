/**
 * ======================================================================
 * FILE: backend/src/services/nurse/vitalService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse vital signs service - Handles business logic for vital signs.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const vitalService = {
    /**
     * Get all vitals
     */
    async getAllVitals(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, ward, patient_id, from_date, to_date, critical_only = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT v.*, 
                       p.first_name, p.last_name, p.phone,
                       b.ward, b.room_number, b.bed_number
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (ward) {
                query += ` AND b.ward = $${paramIndex}`;
                values.push(ward);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND v.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND v.recorded_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND v.recorded_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (critical_only) {
                query += ` AND v.is_critical = true`;
            }

            query += ` ORDER BY v.recorded_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_critical = true) as critical_count,
                    COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal_count
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE 1=1 ${ward ? 'AND b.ward = $1' : ''}
            `;
            const summaryValues = ward ? [ward] : [];
            const summary = await db.query(summaryQuery, summaryValues);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(summary.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllVitals', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get recent vitals
     */
    async getRecentVitals(nurseId, options = {}) {
        try {
            const { ward, limit = 50 } = options;

            const query = `
                SELECT DISTINCT ON (v.patient_id) 
                    v.*, 
                    p.first_name, p.last_name,
                    b.room_number, b.bed_number,
                    EXTRACT(EPOCH FROM (NOW() - v.recorded_at))/60 as minutes_ago
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE b.ward = $1
                ORDER BY v.patient_id, v.recorded_at DESC
                LIMIT $2
            `;

            const result = await db.query(query, [ward, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRecentVitals', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get vital by ID
     */
    async getVitalById(nurseId, vitalId) {
        try {
            const query = `
                SELECT v.*, 
                       p.first_name, p.last_name,
                       b.ward, b.room_number, b.bed_number
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE v.id = $1
            `;

            const result = await db.query(query, [vitalId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getVitalById', { error: error.message, nurseId, vitalId });
            throw error;
        }
    },

    /**
     * Record vitals
     */
    async recordVitals(nurseId, vitalData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check for critical values [BR-36]
            const criticalAlerts = [];
            
            if (vitalData.blood_pressure_systolic) {
                if (vitalData.blood_pressure_systolic > 180 || vitalData.blood_pressure_systolic < 90) {
                    criticalAlerts.push('hypertension_critical');
                }
            }
            
            if (vitalData.heart_rate) {
                if (vitalData.heart_rate > 140 || vitalData.heart_rate < 40) {
                    criticalAlerts.push('heart_rate_critical');
                }
            }
            
            if (vitalData.temperature) {
                if (vitalData.temperature > 39 || vitalData.temperature < 36) {
                    criticalAlerts.push('temperature_critical');
                }
            }
            
            if (vitalData.oxygen_saturation) {
                if (vitalData.oxygen_saturation < 90) {
                    criticalAlerts.push('o2_saturation_critical');
                }
            }

            const isCritical = criticalAlerts.length > 0;

            // Calculate BMI if height and weight provided
            let bmi = vitalData.bmi;
            if (!bmi && vitalData.height && vitalData.weight) {
                const heightInM = vitalData.height / 100;
                bmi = (vitalData.weight / (heightInM * heightInM)).toFixed(1);
            }

            const query = `
                INSERT INTO vitals (
                    id, patient_id, blood_pressure_systolic, blood_pressure_diastolic,
                    heart_rate, temperature, respiratory_rate, oxygen_saturation,
                    blood_glucose, pain_scale, height, weight, bmi,
                    is_critical, critical_alerts, notes, recorded_by, recorded_at,
                    ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, NOW()
                ) RETURNING *
            `;

            const values = [
                vitalData.patient_id,
                vitalData.blood_pressure_systolic || null,
                vitalData.blood_pressure_diastolic || null,
                vitalData.heart_rate || null,
                vitalData.temperature || null,
                vitalData.respiratory_rate || null,
                vitalData.oxygen_saturation || null,
                vitalData.blood_glucose || null,
                vitalData.pain_scale || null,
                vitalData.height || null,
                vitalData.weight || null,
                bmi || null,
                isCritical,
                JSON.stringify(criticalAlerts),
                vitalData.notes || null,
                nurseId,
                vitalData.recorded_at,
                vitalData.ip_address,
                vitalData.user_agent
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return {
                ...result.rows[0],
                critical_alerts
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error in recordVitals', { error: error.message, nurseId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update vital
     */
    async updateVital(nurseId, vitalId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if vital is older than 24 hours
            const checkQuery = `
                SELECT recorded_at FROM vitals WHERE id = $1
            `;
            const check = await client.query(checkQuery, [vitalId]);
            
            if (check.rows.length === 0) {
                throw new Error('Vital record not found');
            }

            const recordedAt = new Date(check.rows[0].recorded_at);
            const hoursDiff = (new Date() - recordedAt) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                throw new Error('Cannot update vitals older than 24 hours');
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'blood_pressure_systolic', 'blood_pressure_diastolic',
                'heart_rate', 'temperature', 'respiratory_rate',
                'oxygen_saturation', 'blood_glucose', 'pain_scale',
                'notes'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            setClause.push(`updated_at = NOW()`);
            values.push(vitalId);

            const query = `
                UPDATE vitals 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);

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
     * Delete vital
     */
    async deleteVital(nurseId, vitalId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if vital is verified
            const checkQuery = `
                SELECT verified_by FROM vitals WHERE id = $1
            `;
            const check = await client.query(checkQuery, [vitalId]);
            
            if (check.rows.length === 0) {
                throw new Error('Vital record not found');
            }

            if (check.rows[0].verified_by) {
                throw new Error('Cannot delete verified vital records');
            }

            // Soft delete
            const query = `
                UPDATE vitals 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [nurseId, reason, vitalId]);

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
     * Get vitals charts data
     */
    async getVitalsCharts(nurseId, patientId, options = {}) {
        try {
            const { from_date, to_date, type = 'all' } = options;

            let query = `
                SELECT 
                    recorded_at,
                    blood_pressure_systolic,
                    blood_pressure_diastolic,
                    heart_rate,
                    temperature,
                    respiratory_rate,
                    oxygen_saturation
                FROM vitals
                WHERE patient_id = $1
            `;
            const values = [patientId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND recorded_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND recorded_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY recorded_at ASC`;

            const result = await db.query(query, values);

            // Format for charts
            const charts = {
                labels: result.rows.map(r => r.recorded_at),
                datasets: []
            };

            if (type === 'all' || type === 'bp') {
                charts.datasets.push({
                    label: 'Systolic',
                    data: result.rows.map(r => r.blood_pressure_systolic),
                    borderColor: 'red'
                });
                charts.datasets.push({
                    label: 'Diastolic',
                    data: result.rows.map(r => r.blood_pressure_diastolic),
                    borderColor: 'blue'
                });
            }

            if (type === 'all' || type === 'hr') {
                charts.datasets.push({
                    label: 'Heart Rate',
                    data: result.rows.map(r => r.heart_rate),
                    borderColor: 'green'
                });
            }

            if (type === 'all' || type === 'temp') {
                charts.datasets.push({
                    label: 'Temperature',
                    data: result.rows.map(r => r.temperature),
                    borderColor: 'orange'
                });
            }

            return charts;
        } catch (error) {
            logger.error('Error in getVitalsCharts', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get vitals trends
     */
    async getVitalsTrends(nurseId, patientId, options = {}) {
        try {
            const { days = 7, types = [] } = options;

            const query = `
                SELECT 
                    date_trunc('day', recorded_at) as day,
                    AVG(heart_rate) as avg_heart_rate,
                    AVG(temperature) as avg_temperature,
                    AVG(oxygen_saturation) as avg_oxygen,
                    AVG(blood_pressure_systolic) as avg_systolic,
                    AVG(blood_pressure_diastolic) as avg_diastolic
                FROM vitals
                WHERE patient_id = $1
                    AND recorded_at > NOW() - INTERVAL '${days} days'
                GROUP BY date_trunc('day', recorded_at)
                ORDER BY day ASC
            `;

            const result = await db.query(query, [patientId]);

            // Calculate trends
            const trends = result.rows.map(row => ({
                date: row.day,
                values: {}
            }));

            if (types.includes('heart_rate') || types.length === 0) {
                trends.forEach((t, i) => {
                    t.values.heart_rate = parseFloat(row.avg_heart_rate).toFixed(0);
                });
            }

            return trends;
        } catch (error) {
            logger.error('Error in getVitalsTrends', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get vital statistics
     */
    async getVitalStatistics(nurseId, options = {}) {
        try {
            const { ward, from_date, to_date } = options;

            let query = `
                SELECT 
                    COUNT(*) as total_readings,
                    COUNT(DISTINCT v.patient_id) as unique_patients,
                    AVG(v.heart_rate) as avg_heart_rate,
                    AVG(v.temperature) as avg_temperature,
                    AVG(v.oxygen_saturation) as avg_oxygen,
                    COUNT(*) FILTER (WHERE v.is_critical = true) as critical_readings,
                    COUNT(*) FILTER (WHERE v.is_abnormal = true) as abnormal_readings
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE b.ward = $1
            `;
            const values = [ward];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND v.recorded_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND v.recorded_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getVitalStatistics', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Export vitals report
     */
    async exportVitalsReport(nurseId, patientId, options = {}) {
        try {
            const { from_date, to_date, format = 'pdf' } = options;

            const query = `
                SELECT 
                    v.*,
                    p.first_name, p.last_name, p.date_of_birth,
                    e.first_name as nurse_first_name, e.last_name as nurse_last_name
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN employees e ON v.recorded_by = e.id
                WHERE v.patient_id = $1
                    ${from_date ? 'AND v.recorded_at >= $2' : ''}
                    ${to_date ? `AND v.recorded_at <= $${from_date ? 3 : 2}` : ''}
                ORDER BY v.recorded_at DESC
            `;

            const values = [patientId];
            if (from_date) values.push(from_date);
            if (to_date) values.push(to_date);

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual PDF/CSV generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportVitalsReport', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Send critical alerts [BR-36]
     */
    async sendCriticalAlerts(vitalId, alerts) {
        try {
            const query = `
                INSERT INTO critical_alerts (
                    id, vital_id, alert_type, severity,
                    created_at, status
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'critical', NOW(), 'pending'
                )
            `;

            for (const alert of alerts) {
                await db.query(query, [vitalId, alert]);
            }

            // TODO: Send real-time notifications
            // - WebSocket to nurse dashboard
            // - Push notification to mobile
            // - SMS to on-call doctor if critical

            logger.info('Critical alerts sent', { vitalId, alerts });
        } catch (error) {
            logger.error('Error in sendCriticalAlerts', { error: error.message, vitalId });
        }
    },

    /**
     * Get critical alerts
     */
    async getCriticalAlerts(nurseId, options = {}) {
        try {
            const { ward, acknowledged = false } = options;

            const query = `
                SELECT 
                    ca.*,
                    v.patient_id,
                    p.first_name, p.last_name,
                    b.room_number, b.bed_number,
                    v.blood_pressure_systolic, v.blood_pressure_diastolic,
                    v.heart_rate, v.temperature, v.oxygen_saturation
                FROM critical_alerts ca
                JOIN vitals v ON ca.vital_id = v.id
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE b.ward = $1
                    AND ca.acknowledged = $2
                ORDER BY ca.created_at DESC
            `;

            const result = await db.query(query, [ward, acknowledged]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCriticalAlerts', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Acknowledge critical alert
     */
    async acknowledgeCriticalAlert(nurseId, alertId, notes) {
        try {
            const query = `
                UPDATE critical_alerts
                SET acknowledged = true,
                    acknowledged_by = $1,
                    acknowledged_at = NOW(),
                    acknowledgment_notes = $2
                WHERE id = $3
                RETURNING *
            `;

            const result = await db.query(query, [nurseId, notes, alertId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeCriticalAlert', { error: error.message, nurseId, alertId });
            throw error;
        }
    }
};

module.exports = vitalService;