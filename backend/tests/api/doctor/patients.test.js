
const request = require('supertest');
const app = require('../../../src/app');

describe('Doctor API - Patients', () => {
    let adminToken;
    let doctorToken;
    let doctorId;

    beforeAll(async () => {
        // Login as admin to create a doctor user
        const adminLoginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'admin@hospital.com',
                password: 'Admin@123'
            });
        adminToken = adminLoginRes.body.data.tokens.accessToken;

        // Create a doctor user
        const doctorEmail = `test.doctor.${Date.now()}@hospital.com`;
        const createDoctorRes = await request(app)
            .post('/api/v1/admin/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                email: doctorEmail,
                username: `test.doctor.${Date.now()}`,
                password: 'Test@123456',
                role: 'doctor',
                first_name: 'Test',
                last_name: 'Doctor'
            });
        
        expect(createDoctorRes.status).toBe(201);
        doctorId = createDoctorRes.body.data.id;

        // Login as the created doctor
        const doctorLoginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: doctorEmail,
                password: 'Test@123456'
            });
        
        expect(doctorLoginRes.status).toBe(200);
        doctorToken = doctorLoginRes.body.data.tokens.accessToken;
    });

    describe('GET /api/v1/doctor/patients', () => {
        it('should return 401 without a token', async () => {
            const res = await request(app).get('/api/v1/doctor/patients');
            expect(res.status).toBe(401);
        });

        it('should return a list of patients for the authenticated doctor', async () => {
            const res = await request(app)
                .get('/api/v1/doctor/patients')
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.pagination).toBeDefined();
        });
        
        it('should not allow an admin to access this route', async () => {
            const res = await request(app)
                .get('/api/v1/doctor/patients')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(403);
        });
    });
});
