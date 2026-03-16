/**
 * ======================================================================
 * FILE: backend/src/routes/v1/publicRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public routes - No authentication required.
 * Total Endpoints: 18 (as per API blueprint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// Import controllers
const doctorController = require('../../controllers/public/doctorController');
const departmentController = require('../../controllers/public/departmentController');
const serviceController = require('../../controllers/public/serviceController');
const appointmentController = require('../../controllers/public/appointmentController');
const insuranceController = require('../../controllers/public/insuranceController');
const contentController = require('../../controllers/public/contentController');

// Import validators
const {
    validateDoctorSearch,
    validateAppointmentCheck,
    validateContactForm,
    validatePagination
} = require('../../validators/publicValidators');

// Import rate limiter (public endpoints ke liye alag rate limit)
const { publicLimiter: public } = require('../../middlewares/rateLimiter');

// ============================================
// DOCTOR PUBLIC ROUTES
// ============================================

/**
 * List all doctors (paginated)
 * GET /api/v1/public/doctors
 */
router.get('/doctors', 
    public,
    validateDoctorSearch,
    doctorController.listDoctors
);

/**
 * Get doctor details
 * GET /api/v1/public/doctors/:id
 */
router.get('/doctors/:id', 
    public,
    doctorController.getDoctorDetails
);

/**
 * Get doctor schedule
 * GET /api/v1/public/doctors/:id/schedule
 */
router.get('/doctors/:id/schedule', 
    public,
    doctorController.getDoctorSchedule
);

// ============================================
// DEPARTMENT PUBLIC ROUTES
// ============================================

/**
 * List all departments
 * GET /api/v1/public/departments
 */
router.get('/departments', 
    public,
    departmentController.listDepartments
);

/**
 * Get department details
 * GET /api/v1/public/departments/:id
 */
router.get('/departments/:id', 
    public,
    departmentController.getDepartmentDetails
);

/**
 * Get department doctors
 * GET /api/v1/public/departments/:id/doctors
 */
router.get('/departments/:id/doctors', 
    public,
    departmentController.getDepartmentDoctors
);

// ============================================
// FACILITIES & SERVICES ROUTES
// ============================================

/**
 * List hospital facilities
 * GET /api/v1/public/facilities
 */
router.get('/facilities', 
    public,
    serviceController.listFacilities
);

/**
 * List all services
 * GET /api/v1/public/services
 */
router.get('/services', 
    public,
    serviceController.listServices
);

/**
 * Get service details
 * GET /api/v1/public/services/:id
 */
router.get('/services/:id', 
    public,
    serviceController.getServiceDetails
);

/**
 * Get service prices
 * GET /api/v1/public/services/pricing
 */
router.get('/services/pricing', 
    public,
    serviceController.getServicePricing
);

// ============================================
// APPOINTMENT PUBLIC ROUTES
// ============================================

/**
 * Check slot availability
 * POST /api/v1/public/appointments/check-availability
 */
router.post('/appointments/check-availability', 
    public,
    validateAppointmentCheck,
    appointmentController.checkAvailability
);

/**
 * Get available slots
 * GET /api/v1/public/appointments/slots
 */
router.get('/appointments/slots', 
    public,
    appointmentController.getAvailableSlots
);

/**
 * Book appointment (guest)
 * POST /api/v1/public/appointments/booking
 */
router.post('/appointments/booking', 
    public,
    appointmentController.bookGuestAppointment
);

// ============================================
// INSURANCE PUBLIC ROUTES
// ============================================

/**
 * List insurance providers
 * GET /api/v1/public/insurance/providers
 */
router.get('/insurance/providers', 
    public,
    insuranceController.listProviders
);

/**
 * Get provider details
 * GET /api/v1/public/insurance/providers/:id
 */
router.get('/insurance/providers/:id', 
    public,
    insuranceController.getProviderDetails
);

// ============================================
// CONTENT ROUTES
// ============================================

/**
 * Submit contact form
 * POST /api/v1/public/contact-form
 */
router.post('/contact-form', 
    public,
    validateContactForm,
    contentController.submitContactForm
);

/**
 * Get FAQs
 * GET /api/v1/public/faq
 */
router.get('/faq', 
    public,
    contentController.getFaqs
);

/**
 * Get announcements
 * GET /api/v1/public/announcements
 */
router.get('/announcements', 
    public,
    contentController.getAnnouncements
);

// ============================================
// HEALTH CHECK FOR PUBLIC MODULE
// ============================================

/**
 * Health check for public module
 * GET /api/v1/public
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Public module is healthy',
        timestamp: new Date().toISOString()
    });
});

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Public module is healthy',
        timestamp: new Date().toISOString(),
        endpoints: {
            total: 18,
            doctors: 3,
            departments: 3,
            services: 4,
            appointments: 3,
            insurance: 2,
            content: 3
        }
    });
});

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category        | Count | Base Path
 * ----------------|-------|-------------------
 * Doctors         | 3     | /doctors
 * Departments     | 3     | /departments
 * Services        | 4     | /facilities, /services
 * Appointments    | 3     | /appointments
 * Insurance       | 2     | /insurance/providers
 * Content         | 3     | /contact-form, /faq, /announcements
 * ----------------|-------|-------------------
 * TOTAL           | 18    | Complete Public Module
 * 
 * ======================================================================
 */