/**
 * ======================================================================
 * FILE: backend/src/controllers/public/appointmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public appointment controller - No authentication required.
 * Endpoints: /public/appointments/check-availability, /public/appointments/slots, /public/appointments/booking
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-07] Cannot book appointment in past
 * - [BR-08] Max 30 appointments per doctor per day
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

const appointmentController = {
    /**
     * Check slot availability
     * POST /api/v1/public/appointments/check-availability
     */
    async checkAvailability(req, res, next) {
        try {
            const { doctor_id, date, specialization } = req.body;

            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: 'Date is required'
                });
            }

            // [BR-07] Check if date is in past
            const checkDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (checkDate < today) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot check availability for past dates'
                });
            }

            let availableDoctors = [];

            if (doctor_id) {
                // Check specific doctor
                const doctorQuery = `
                    SELECT 
                        e.id, e.first_name, e.last_name, e.specialization,
                        ds.day, ds.start_time, ds.end_time, ds.max_patients
                    FROM employees e
                    JOIN doctor_schedules ds ON e.id = ds.doctor_id
                    WHERE e.id = $1 
                        AND e.designation = 'Doctor'
                        AND e.is_active = true
                        AND ds.day = EXTRACT(DOW FROM DATE $2)
                        AND ds.is_active = true
                `;
                const doctor = await db.query(doctorQuery, [doctor_id, date]);

                if (doctor.rows.length === 0) {
                    return res.json({
                        success: true,
                        data: {
                            is_available: false,
                            message: 'Doctor not available on this date',
                            available_slots: []
                        }
                    });
                }

                // Check booked appointments for this doctor on this date
                const bookedQuery = `
                    SELECT COUNT(*) as booked
                    FROM appointments
                    WHERE doctor_id = $1 
                        AND appointment_date = $2
                        AND status NOT IN ('cancelled')
                `;
                const booked = await db.query(bookedQuery, [doctor_id, date]);

                const maxPatients = doctor.rows[0].max_patients || 30;
                const bookedCount = parseInt(booked.rows[0].booked);
                const isAvailable = bookedCount < maxPatients;

                availableDoctors = [{
                    ...doctor.rows[0],
                    booked_count: bookedCount,
                    max_patients: maxPatients,
                    is_available: isAvailable,
                    available_slots_count: maxPatients - bookedCount
                }];
            } 
            else if (specialization) {
                // Find doctors by specialization
                const doctorsQuery = `
                    SELECT 
                        e.id, e.first_name, e.last_name, e.specialization,
                        ds.day, ds.start_time, ds.end_time, ds.max_patients
                    FROM employees e
                    JOIN doctor_schedules ds ON e.id = ds.doctor_id
                    WHERE e.specialization ILIKE $1
                        AND e.designation = 'Doctor'
                        AND e.is_active = true
                        AND ds.day = EXTRACT(DOW FROM DATE $2)
                        AND ds.is_active = true
                `;
                const doctors = await db.query(doctorsQuery, [`%${specialization}%`, date]);

                // Check availability for each doctor
                for (const doctor of doctors.rows) {
                    const bookedQuery = `
                        SELECT COUNT(*) as booked
                        FROM appointments
                        WHERE doctor_id = $1 
                            AND appointment_date = $2
                            AND status NOT IN ('cancelled')
                    `;
                    const booked = await db.query(bookedQuery, [doctor.id, date]);
                    
                    const maxPatients = doctor.max_patients || 30;
                    const bookedCount = parseInt(booked.rows[0].booked);
                    
                    doctor.booked_count = bookedCount;
                    doctor.max_patients = maxPatients;
                    doctor.is_available = bookedCount < maxPatients;
                    doctor.available_slots_count = maxPatients - bookedCount;
                }

                availableDoctors = doctors.rows;
            }
            else {
                return res.status(400).json({
                    success: false,
                    error: 'Either doctor_id or specialization is required'
                });
            }

            logger.info('Public check availability accessed', {
                date,
                doctor_id,
                specialization,
                available_count: availableDoctors.filter(d => d.is_available).length
            });

            res.json({
                success: true,
                data: {
                    date,
                    doctors: availableDoctors,
                    summary: {
                        total_doctors: availableDoctors.length,
                        available_doctors: availableDoctors.filter(d => d.is_available).length,
                        total_slots: availableDoctors.reduce((acc, d) => acc + d.available_slots_count, 0)
                    }
                }
            });
        } catch (error) {
            logger.error('Error in public check availability', { error: error.message });
            next(error);
        }
    },

    /**
     * Get available slots
     * GET /api/v1/public/appointments/slots
     */
    async getAvailableSlots(req, res, next) {
        try {
            const { doctor_id, date } = req.query;

            if (!doctor_id || !date) {
                return res.status(400).json({
                    success: false,
                    error: 'doctor_id and date are required'
                });
            }

            // [BR-07] Check if date is in past
            const checkDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (checkDate < today) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot get slots for past dates'
                });
            }

            // Get doctor's schedule for this day
            const scheduleQuery = `
                SELECT start_time, end_time, slot_duration, max_patients
                FROM doctor_schedules
                WHERE doctor_id = $1 
                    AND day = EXTRACT(DOW FROM DATE $2)
                    AND is_active = true
            `;
            const schedule = await db.query(scheduleQuery, [doctor_id, date]);

            if (schedule.rows.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        doctor_id,
                        date,
                        slots: [],
                        message: 'Doctor not available on this date'
                    }
                });
            }

            // Get already booked appointments
            const bookedQuery = `
                SELECT appointment_time
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND status NOT IN ('cancelled')
            `;
            const booked = await db.query(bookedQuery, [doctor_id, date]);
            const bookedTimes = new Set(booked.rows.map(b => b.appointment_time));

            // Generate available time slots
            const { start_time, end_time, slot_duration = 30, max_patients = 30 } = schedule.rows[0];
            
            const slots = [];
            let currentTime = new Date(`2000-01-01T${start_time}`);
            const endTime = new Date(`2000-01-01T${end_time}`);

            while (currentTime < endTime) {
                const timeString = currentTime.toTimeString().slice(0, 5);
                
                if (!bookedTimes.has(timeString)) {
                    slots.push({
                        time: timeString,
                        is_available: true
                    });
                }
                
                currentTime.setMinutes(currentTime.getMinutes() + slot_duration);
            }

            // Check if max patients reached
            const bookedCount = booked.rows.length;
            const isFullyBooked = bookedCount >= max_patients;

            logger.info('Public get available slots accessed', {
                doctor_id,
                date,
                available_slots: slots.length,
                booked_count: bookedCount
            });

            res.json({
                success: true,
                data: {
                    doctor_id,
                    date,
                    slots,
                    summary: {
                        total_slots: slots.length,
                        booked_count: bookedCount,
                        available_count: slots.length,
                        max_patients,
                        is_fully_booked: isFullyBooked
                    }
                }
            });
        } catch (error) {
            logger.error('Error in public get available slots', { error: error.message });
            next(error);
        }
    },

    /**
     * Book appointment (guest)
     * POST /api/v1/public/appointments/booking
     */
    async bookGuestAppointment(req, res, next) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const {
                doctor_id,
                appointment_date,
                appointment_time,
                patient_name,
                patient_email,
                patient_phone,
                reason,
                type = 'regular_checkup'
            } = req.body;

            // Validate required fields
            if (!doctor_id || !appointment_date || !appointment_time || !patient_name || !patient_phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            // [BR-07] Check if date is in past
            const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
            if (appointmentDateTime < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot book appointment in the past'
                });
            }

            // [BR-08] Check if doctor has reached max appointments for this day
            const countQuery = `
                SELECT COUNT(*) as booked
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND status NOT IN ('cancelled')
            `;
            const countResult = await client.query(countQuery, [doctor_id, appointment_date]);
            
            const scheduleQuery = `
                SELECT max_patients FROM doctor_schedules
                WHERE doctor_id = $1 AND day = EXTRACT(DOW FROM DATE $2)
            `;
            const scheduleResult = await client.query(scheduleQuery, [doctor_id, appointment_date]);
            
            const maxPatients = scheduleResult.rows[0]?.max_patients || 30;
            const bookedCount = parseInt(countResult.rows[0].booked);

            if (bookedCount >= maxPatients) {
                return res.status(409).json({
                    success: false,
                    error: 'Doctor is fully booked for this date'
                });
            }

            // Check if this slot is already booked
            const slotQuery = `
                SELECT id FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND appointment_time = $3
                    AND status NOT IN ('cancelled')
            `;
            const slotResult = await client.query(slotQuery, [doctor_id, appointment_date, appointment_time]);
            
            if (slotResult.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'This time slot is already booked'
                });
            }

            // Generate a temporary patient ID for guest
            const tempPatientId = uuidv4();

            // Create appointment
            const insertQuery = `
                INSERT INTO appointments (
                    id, patient_id, doctor_id, appointment_date, appointment_time,
                    type, reason, status, is_guest, guest_name, guest_email, guest_phone,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', true, $8, $9, $10, NOW(), NOW())
                RETURNING id, appointment_date, appointment_time, status
            `;

            const appointmentId = uuidv4();
            const values = [
                appointmentId,
                tempPatientId,
                doctor_id,
                appointment_date,
                appointment_time,
                type,
                reason || 'Guest booking',
                patient_name,
                patient_email || null,
                patient_phone
            ];

            const result = await client.query(insertQuery, values);

            await db.commitTransaction(client);

            logger.info('Public guest appointment booked', {
                appointmentId: result.rows[0].id,
                doctor_id,
                date: appointment_date,
                time: appointment_time,
                patient_name
            });

            res.status(201).json({
                success: true,
                data: {
                    ...result.rows[0],
                    message: 'Appointment booked successfully. Please save your appointment ID for future reference.'
                }
            });
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error in public guest appointment booking', { error: error.message });
            next(error);
        } finally {
            client.release();
        }
    }
};

module.exports = appointmentController;