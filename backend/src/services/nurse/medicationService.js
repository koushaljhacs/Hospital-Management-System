/**
 * ======================================================================
 * FILE: backend/src/services/nurse/medicationService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse medication service - Handles business logic for medication administration.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag and witness
 * - [BR-18] Cannot dispense expired medicine
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const medicationService = {
    /**
     * Get medication schedules
     */
    async getMedications(nurseId, options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                patient_id,
                status,
                from_date,
                to_date,
                medication_name 
            } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT m.*, 
                       p.first_name, p.last_name, p.date_of_birth,
                       p.blood_group, p.allergies,
                       b.room_number, b.bed_number,
                       med.name as medication_name,
                       med.generic_name, med.category,
                       med.is_controlled, med.is_narcotic,
                       med.strength, med.strength_unit,
                       med.route as default_route
                FROM medication_schedules m
                JOIN patients p ON m.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                JOIN medications med ON m.medication_id = med.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (patient_id) {
                query += ` AND m.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (status) {
                query += ` AND m.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (medication_name) {
                query += ` AND med.name ILIKE $${paramIndex}`;
                values.push(`%${medication_name}%`);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND m.scheduled_time >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND m.scheduled_time <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY m.scheduled_time ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                    COUNT(*) FILTER (WHERE status = 'administered') as administered,
                    COUNT(*) FILTER (WHERE status = 'missed') as missed,
                    COUNT(*) FILTER (WHERE status = 'skipped') as skipped
                FROM medication_schedules
                WHERE 1=1 ${patient_id ? 'AND patient_id = $1' : ''}
            `;
            const summaryValues = patient_id ? [patient_id] : [];
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
            logger.error('Error in getMedications', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get today's medications
     */
    async getTodayMedications(nurseId, options = {}) {
        try {
            const { page = 1, limit = 50, patient_id, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT m.*, 
                       p.first_name, p.last_name,
                       b.room_number, b.bed_number,
                       med.name as medication_name,
                       med.is_controlled, med.is_narcotic,
                       EXTRACT(EPOCH FROM (m.scheduled_time - NOW()))/60 as minutes_until_due
                FROM medication_schedules m
                JOIN patients p ON m.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                JOIN medications med ON m.medication_id = med.id
                WHERE DATE(m.scheduled_time) = CURRENT_DATE
            `;
            const values = [];
            let paramIndex = 1;

            if (patient_id) {
                query += ` AND m.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (status) {
                query += ` AND m.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY m.scheduled_time ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Group by time slot
            const medications = result.rows.map(med => {
                const hour = new Date(med.scheduled_time).getHours();
                let timeSlot = 'other';
                if (hour >= 5 && hour < 9) timeSlot = 'morning';
                else if (hour >= 9 && hour < 12) timeSlot = 'late_morning';
                else if (hour >= 12 && hour < 17) timeSlot = 'afternoon';
                else if (hour >= 17 && hour < 21) timeSlot = 'evening';
                else if (hour >= 21 || hour < 5) timeSlot = 'night';
                
                return { ...med, time_slot: timeSlot };
            });

            return {
                data: medications,
                pagination: {
                    page,
                    limit,
                    total: medications.length
                }
            };
        } catch (error) {
            logger.error('Error in getTodayMedications', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get due medications
     */
    async getDueMedications(nurseId, options = {}) {
        try {
            const { page = 1, limit = 50, patient_id, grace_period = 30 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT m.*, 
                       p.first_name, p.last_name,
                       b.room_number, b.bed_number,
                       med.name as medication_name,
                       med.is_controlled, med.is_narcotic,
                       EXTRACT(EPOCH FROM (m.scheduled_time - NOW()))/60 as minutes_until_due
                FROM medication_schedules m
                JOIN patients p ON m.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                JOIN medications med ON m.medication_id = med.id
                WHERE m.status = 'scheduled'
                    AND m.scheduled_time <= NOW() + INTERVAL '${grace_period} minutes'
                    AND m.scheduled_time >= NOW() - INTERVAL '60 minutes'
                    ${patient_id ? 'AND m.patient_id = $1' : ''}
                ORDER BY m.scheduled_time ASC
                LIMIT $${patient_id ? 2 : 1} OFFSET $${patient_id ? 3 : 2}
            `;

            const values = patient_id ? [patient_id, limit, offset] : [limit, offset];
            const result = await db.query(query, values);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: result.rows.length
                }
            };
        } catch (error) {
            logger.error('Error in getDueMedications', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get medication by ID
     */
    async getMedicationById(nurseId, medicationId) {
        try {
            const query = `
                SELECT m.*, 
                       p.first_name, p.last_name, p.date_of_birth,
                       p.blood_group, p.allergies, p.medical_conditions,
                       b.room_number, b.bed_number,
                       med.name as medication_name,
                       med.generic_name, med.category,
                       med.is_controlled, med.is_narcotic,
                       med.strength, med.strength_unit,
                       med.route as default_route,
                       med.contraindications, med.side_effects,
                       inv.expiry_date, inv.batch_number,
                       inv.quantity as available_quantity
                FROM medication_schedules m
                JOIN patients p ON m.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                JOIN medications med ON m.medication_id = med.id
                LEFT JOIN inventory inv ON med.id = inv.medication_id
                    AND inv.expiry_date > CURRENT_DATE
                WHERE m.id = $1
            `;

            const result = await db.query(query, [medicationId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getMedicationById', { error: error.message, nurseId, medicationId });
            throw error;
        }
    },

    /**
     * Administer medication
     */
    async administerMedication(nurseId, medicationId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get medication details
            const medQuery = `
                SELECT m.*, med.is_controlled, inv.quantity
                FROM medication_schedules m
                JOIN medications med ON m.medication_id = med.id
                LEFT JOIN inventory inv ON med.id = inv.medication_id
                WHERE m.id = $1
            `;
            const med = await client.query(medQuery, [medicationId]);
            
            if (med.rows.length === 0) {
                throw new Error('Medication schedule not found');
            }

            // [BR-18] Check expiry
            if (med.rows[0].expiry_date && new Date(med.rows[0].expiry_date) < new Date()) {
                throw new Error('Medication expired');
            }

            // [BR-14] Check quantity
            if (data.remaining_quantity !== undefined && data.remaining_quantity < 0) {
                throw new Error('Remaining quantity cannot be negative');
            }

            // Update medication schedule
            const updateQuery = `
                UPDATE medication_schedules
                SET status = 'administered',
                    administered_at = $1,
                    administered_by = $2,
                    route = COALESCE($3, route),
                    administration_notes = $4,
                    witness_id = $5,
                    reactions = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `;

            const updateValues = [
                data.administered_at,
                nurseId,
                data.route,
                data.notes,
                data.witness_id,
                data.reactions ? JSON.stringify(data.reactions) : null,
                medicationId
            ];

            const result = await client.query(updateQuery, updateValues);

            // Update inventory if quantity tracking
            if (data.remaining_quantity !== undefined && med.rows[0].medication_id) {
                await client.query(`
                    UPDATE inventory
                    SET quantity = $1,
                        last_updated = NOW()
                    WHERE medication_id = $2
                `, [data.remaining_quantity, med.rows[0].medication_id]);
            }

            // Log administration
            await client.query(`
                INSERT INTO medication_administration_log (
                    id, medication_schedule_id, administered_by,
                    administered_at, witness_id, route, notes,
                    reactions, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                )
            `, [
                medicationId,
                nurseId,
                data.administered_at,
                data.witness_id,
                data.route,
                data.notes,
                data.reactions ? JSON.stringify(data.reactions) : null
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
     * Skip medication
     */
    async skipMedication(nurseId, medicationId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE medication_schedules
                SET status = 'skipped',
                    skipped_at = $1,
                    skipped_by = $2,
                    skip_reason = $3,
                    skip_notes = $4,
                    physician_notified = $5,
                    alternative_action = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `;

            const values = [
                data.skipped_at,
                nurseId,
                data.reason,
                data.notes,
                data.physician_notified,
                data.alternative_action,
                medicationId
            ];

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
     * Get medication history
     */
    async getMedicationHistory(nurseId, options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20,
                patient_id,
                from_date,
                to_date,
                medication_name,
                administered_by 
            } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT l.*, 
                       m.scheduled_time,
                       p.first_name, p.last_name,
                       med.name as medication_name,
                       e.first_name as administered_by_first_name,
                       e.last_name as administered_by_last_name
                FROM medication_administration_log l
                JOIN medication_schedules m ON l.medication_schedule_id = m.id
                JOIN patients p ON m.patient_id = p.id
                JOIN medications med ON m.medication_id = med.id
                LEFT JOIN employees e ON l.administered_by = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (patient_id) {
                query += ` AND m.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (administered_by) {
                query += ` AND l.administered_by = $${paramIndex}`;
                values.push(administered_by);
                paramIndex++;
            }

            if (medication_name) {
                query += ` AND med.name ILIKE $${paramIndex}`;
                values.push(`%${medication_name}%`);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND l.administered_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND l.administered_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY l.administered_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM medication_administration_log l
                JOIN medication_schedules m ON l.medication_schedule_id = m.id
                WHERE 1=1 ${patient_id ? 'AND m.patient_id = $1' : ''}
            `;
            const countValues = patient_id ? [patient_id] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getMedicationHistory', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get patient medication timeline
     */
    async getPatientMedicationTimeline(nurseId, patientId, days = 7) {
        try {
            const query = `
                SELECT 
                    DATE(m.scheduled_time) as date,
                    COUNT(*) as total_scheduled,
                    COUNT(*) FILTER (WHERE m.status = 'administered') as administered,
                    COUNT(*) FILTER (WHERE m.status = 'missed') as missed,
                    COUNT(*) FILTER (WHERE m.status = 'skipped') as skipped,
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'time', m.scheduled_time,
                            'medication', med.name,
                            'dosage', m.dosage,
                            'status', m.status,
                            'administered_at', m.administered_at,
                            'administered_by', (
                                SELECT CONCAT(e.first_name, ' ', e.last_name)
                                FROM employees e
                                WHERE e.id = m.administered_by
                            )
                        ) ORDER BY m.scheduled_time
                    ) as details
                FROM medication_schedules m
                JOIN medications med ON m.medication_id = med.id
                WHERE m.patient_id = $1
                    AND m.scheduled_time > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(m.scheduled_time)
                ORDER BY date DESC
            `;

            const result = await db.query(query, [patientId]);

            // Calculate adherence rate
            let total = 0;
            let administered = 0;
            result.rows.forEach(row => {
                total += parseInt(row.total_scheduled);
                administered += parseInt(row.administered);
            });

            const adherenceRate = total > 0 ? (administered / total * 100).toFixed(1) : 0;

            return {
                timeline: result.rows,
                adherence_rate: adherenceRate,
                total_scheduled: total,
                total_administered: administered,
                total_missed: result.rows.reduce((acc, r) => acc + parseInt(r.missed), 0),
                total_skipped: result.rows.reduce((acc, r) => acc + parseInt(r.skipped), 0)
            };
        } catch (error) {
            logger.error('Error in getPatientMedicationTimeline', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Verify medication (5 Rights check)
     */
    async verifyMedication(nurseId, medicationId, verificationData) {
        try {
            const medication = await this.getMedicationById(nurseId, medicationId);
            
            if (!medication) {
                throw new Error('Medication schedule not found');
            }

            const errors = [];
            
            // Right Patient
            if (medication.patient_id !== verificationData.patient_id) {
                errors.push('Wrong patient');
            }
            
            // Right Medication
            if (medication.medication_name !== verificationData.medication_name) {
                errors.push('Wrong medication');
            }
            
            // Right Dose
            if (medication.dosage !== verificationData.dosage) {
                errors.push('Wrong dosage');
            }
            
            // Right Route
            if (medication.route !== verificationData.route) {
                errors.push('Wrong route');
            }
            
            // Right Time
            const scheduledTime = new Date(medication.scheduled_time);
            const verificationTime = new Date(verificationData.time);
            const timeDiff = Math.abs(scheduledTime - verificationTime) / (1000 * 60);
            
            if (timeDiff > 30) { // 30 minutes grace period
                errors.push('Wrong time');
            }

            return {
                verified: errors.length === 0,
                errors,
                medication
            };
        } catch (error) {
            logger.error('Error in verifyMedication', { error: error.message, nurseId, medicationId });
            throw error;
        }
    },

    /**
     * Get medication verification info
     */
    async getMedicationVerificationInfo(nurseId, medicationId) {
        try {
            const medication = await this.getMedicationById(nurseId, medicationId);
            
            if (!medication) {
                return null;
            }

            return {
                id: medication.id,
                patient: {
                    id: medication.patient_id,
                    name: `${medication.first_name} ${medication.last_name}`,
                    dob: medication.date_of_birth,
                    blood_group: medication.blood_group,
                    allergies: medication.allergies
                },
                medication: {
                    name: medication.medication_name,
                    generic_name: medication.generic_name,
                    dosage: medication.dosage,
                    route: medication.route,
                    is_controlled: medication.is_controlled,
                    contraindications: medication.contraindications,
                    side_effects: medication.side_effects
                },
                schedule: {
                    scheduled_time: medication.scheduled_time,
                    status: medication.status,
                    notes: medication.notes
                },
                inventory: {
                    available_quantity: medication.available_quantity,
                    expiry_date: medication.expiry_date,
                    batch_number: medication.batch_number
                }
            };
        } catch (error) {
            logger.error('Error in getMedicationVerificationInfo', { error: error.message, nurseId, medicationId });
            throw error;
        }
    },

    /**
     * Get medication stats
     */
    async getMedicationStats(nurseId, options = {}) {
        try {
            const { period = 'week', patient_id } = options;

            let dateFilter = '';
            if (period === 'day') {
                dateFilter = "AND created_at > NOW() - INTERVAL '1 day'";
            } else if (period === 'week') {
                dateFilter = "AND created_at > NOW() - INTERVAL '7 days'";
            } else if (period === 'month') {
                dateFilter = "AND created_at > NOW() - INTERVAL '30 days'";
            }

            let patientFilter = '';
            const values = [];
            let paramIndex = 1;

            if (patient_id) {
                patientFilter = `AND patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_scheduled,
                    COUNT(*) FILTER (WHERE status = 'administered') as total_administered,
                    COUNT(*) FILTER (WHERE status = 'missed') as total_missed,
                    COUNT(*) FILTER (WHERE status = 'skipped') as total_skipped,
                    COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_time < NOW()) as overdue,
                    AVG(EXTRACT(EPOCH FROM (administered_at - scheduled_time))/60)::numeric(10,2) as avg_admin_time,
                    COUNT(DISTINCT patient_id) as unique_patients
                FROM medication_schedules
                WHERE 1=1
                    ${patientFilter}
                    ${dateFilter}
            `;

            const result = await db.query(query, values);

            // Get top medications
            const topMedsQuery = `
                SELECT 
                    med.name,
                    COUNT(*) as count
                FROM medication_schedules m
                JOIN medications med ON m.medication_id = med.id
                WHERE 1=1
                    ${patientFilter}
                    ${dateFilter}
                GROUP BY med.name
                ORDER BY count DESC
                LIMIT 5
            `;
            const topMeds = await db.query(topMedsQuery, values);

            return {
                ...result.rows[0],
                top_medications: topMeds.rows
            };
        } catch (error) {
            logger.error('Error in getMedicationStats', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get medication adherence
     */
    async getMedicationAdherence(nurseId, patientId, days = 30) {
        try {
            const query = `
                SELECT 
                    DATE(scheduled_time) as date,
                    COUNT(*) as scheduled,
                    COUNT(*) FILTER (WHERE status = 'administered') as administered,
                    COUNT(*) FILTER (WHERE status = 'missed') as missed,
                    COUNT(*) FILTER (WHERE status = 'skipped') as skipped
                FROM medication_schedules
                WHERE patient_id = $1
                    AND scheduled_time > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(scheduled_time)
                ORDER BY date DESC
            `;

            const result = await db.query(query, [patientId]);

            let totalScheduled = 0;
            let totalAdministered = 0;

            result.rows.forEach(row => {
                totalScheduled += parseInt(row.scheduled);
                totalAdministered += parseInt(row.administered);
            });

            const adherenceRate = totalScheduled > 0 
                ? (totalAdministered / totalScheduled * 100).toFixed(1) 
                : 0;

            return {
                daily: result.rows,
                summary: {
                    total_scheduled,
                    total_administered,
                    total_missed: result.rows.reduce((acc, r) => acc + parseInt(r.missed), 0),
                    total_skipped: result.rows.reduce((acc, r) => acc + parseInt(r.skipped), 0),
                    adherence_rate: adherenceRate
                }
            };
        } catch (error) {
            logger.error('Error in getMedicationAdherence', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get medication alerts
     */
    async getMedicationAlerts(nurseId, options = {}) {
        try {
            const { patient_id, medication_id } = options;

            let query = `
                SELECT 
                    'allergy' as type,
                    p.id as patient_id,
                    p.first_name, p.last_name,
                    a.allergen,
                    a.severity,
                    a.reaction
                FROM patients p
                JOIN patient_allergies a ON p.id = a.patient_id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (patient_id) {
                query += ` AND p.id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (medication_id) {
                // Check for drug interactions
                query += `
                    UNION ALL
                    SELECT 
                        'interaction' as type,
                        p.id as patient_id,
                        p.first_name, p.last_name,
                        di.medication1 || ' + ' || di.medication2 as allergen,
                        di.severity,
                        di.description as reaction
                    FROM patients p
                    JOIN medication_schedules m1 ON p.id = m1.patient_id
                    JOIN medication_schedules m2 ON p.id = m2.patient_id
                    JOIN drug_interactions di ON 
                        (di.medication1 = m1.medication_id AND di.medication2 = m2.medication_id) OR
                        (di.medication2 = m1.medication_id AND di.medication1 = m2.medication_id)
                    WHERE m1.id != m2.id
                        AND m1.status = 'scheduled'
                        AND m2.status = 'scheduled'
                `;
            }

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error in getMedicationAlerts', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Check drug interactions
     */
    async checkDrugInteractions(nurseId, medicationIds, patientId) {
        try {
            const query = `
                SELECT 
                    di.*,
                    m1.name as med1_name,
                    m2.name as med2_name
                FROM drug_interactions di
                JOIN medications m1 ON di.medication1 = m1.id
                JOIN medications m2 ON di.medication2 = m2.id
                WHERE (di.medication1 = ANY($1::uuid[]) AND di.medication2 = ANY($1::uuid[]))
                    OR (di.medication2 = ANY($1::uuid[]) AND di.medication1 = ANY($1::uuid[]))
            `;

            const result = await db.query(query, [medicationIds]);

            // If patient_id provided, check against current medications
            if (patientId) {
                const currentMedsQuery = `
                    SELECT DISTINCT medication_id
                    FROM medication_schedules
                    WHERE patient_id = $1
                        AND status = 'scheduled'
                `;
                const currentMeds = await db.query(currentMedsQuery, [patientId]);
                const currentIds = currentMeds.rows.map(m => m.medication_id);

                // Check interactions with current medications
                const interactionQuery = `
                    SELECT 
                        di.*,
                        m1.name as med1_name,
                        m2.name as med2_name
                    FROM drug_interactions di
                    JOIN medications m1 ON di.medication1 = m1.id
                    JOIN medications m2 ON di.medication2 = m2.id
                    WHERE (di.medication1 = ANY($1::uuid[]) AND di.medication2 = ANY($2::uuid[]))
                        OR (di.medication2 = ANY($1::uuid[]) AND di.medication1 = ANY($2::uuid[]))
                `;
                const interactions = await db.query(interactionQuery, [medicationIds, currentIds]);
                result.rows.push(...interactions.rows);
            }

            return result.rows;
        } catch (error) {
            logger.error('Error in checkDrugInteractions', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get PRN requests
     */
    async getPrnRequests(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, status = 'pending' } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT r.*, 
                       p.first_name, p.last_name,
                       b.room_number, b.bed_number,
                       med.name as medication_name
                FROM prn_requests r
                JOIN patients p ON r.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                JOIN medications med ON r.medication_id = med.id
                WHERE r.status = $1
                ORDER BY r.requested_at ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);
            return { data: result.rows };
        } catch (error) {
            logger.error('Error in getPrnRequests', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Administer PRN medication
     */
    async administerPrnMedication(nurseId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Create PRN administration record
            const query = `
                INSERT INTO prn_administration (
                    id, patient_id, medication_id, dosage, route,
                    reason, administered_by, administered_at,
                    witness_id, effectiveness, notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
                ) RETURNING *
            `;

            const values = [
                data.patient_id,
                data.medication_id,
                data.dosage,
                data.route,
                data.reason,
                nurseId,
                data.administered_at,
                data.witness_id,
                data.effectiveness,
                data.notes
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = medicationService;