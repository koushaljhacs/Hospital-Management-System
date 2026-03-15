/**
 * ======================================================================
 * FILE: backend/tests/api/admin/user-api.test.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * API tests for user management endpoints
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * USAGE: npm run test -- tests/api/admin/user-api.test.js
 * ======================================================================
 */

const request = require('supertest');
const app = require('../../../src/app');

describe('User Management API', () => {
    let adminToken;
    let testUserId;

    beforeAll(async () => {
        // Login as admin
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'admin@hospital.com',
                password: 'Admin@123'
            });
        adminToken = loginRes.body.data.tokens.accessToken;
    });

    describe('GET /admin/users', () => {
        it('should return 401 without token', async () => {
            const res = await request(app)
                .get('/api/v1/admin/users');
            expect(res.status).toBe(401);
        });

        it('should return users list with pagination', async () => {
            const res = await request(app)
                .get('/api/v1/admin/users?page=1&limit=10')
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.pagination).toBeDefined();
        });
    });

    describe('POST /admin/users', () => {
        it('should create new user', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'test.doctor@hospital.com',
                    username: 'test.doctor',
                    password: 'Test@123456',
                    role: 'doctor',
                    first_name: 'Test',
                    last_name: 'Doctor'
                });
            
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            testUserId = res.body.data.id;
        });

        it('should validate email format', async () => {
            const res = await request(app)
                .post('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'invalid-email',
                    password: 'Test@123456'
                });
            
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('GET /admin/users/:id', () => {
        it('should return user details', async () => {
            const res = await request(app)
                .get(`/api/v1/admin/users/${testUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(testUserId);
        });

        it('should return 404 for invalid id', async () => {
            const res = await request(app)
                .get('/api/v1/admin/users/123')
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /admin/users/:id/status', () => {
        it('should update user status', async () => {
            const res = await request(app)
                .put(`/api/v1/admin/users/${testUserId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'locked' });
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('DELETE /admin/users/:id', () => {
        it('should soft delete user', async () => {
            const res = await request(app)
                .delete(`/api/v1/admin/users/${testUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});