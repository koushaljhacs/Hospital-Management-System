/**
 * ======================================================================
 * FILE: backend/tests/config/test-env.js
 * ======================================================================
 * 
 * DESCRIPTION:
 * Test script to verify environment configuration
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * ======================================================================
 */

const path = require('path');
const dotenv = require('dotenv');

console.log('\n========================================');
console.log('🧪 TESTING ENVIRONMENT CONFIGURATION');
console.log('========================================\n');

// Load .env from correct location (backend folder)
const envPath = path.resolve(__dirname, '../../.env');
console.log('📁 Looking for .env at:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Failed to load .env file!');
    console.error('Error:', result.error.message);
    console.error('\n💡 Make sure .env file exists at: C:\\Project\\Hospital-Management-System\\backend\\.env');
    process.exit(1);
}

console.log('✅ .env file loaded successfully!\n');

try {
    // Import config
    const config = require('../../src/config/env');
    
    console.log('✅ Config loaded successfully!\n');
    
    console.log('📋 CONFIGURATION SUMMARY:');
    console.log('----------------------------------------');
    console.log('Environment:', config.server.env);
    console.log('Server Port:', config.server.port);
    console.log('API Prefix:', config.server.api.prefix);
    console.log('----------------------------------------\n');
    
    console.log('📋 DATABASE CONFIG:');
    console.log('----------------------------------------');
    console.log('Host:', config.database.host);
    console.log('Port:', config.database.port);
    console.log('Database:', config.database.name);
    console.log('User:', config.database.user);
    console.log('Pool Max:', config.database.pool.max);
    console.log('Pool Min:', config.database.pool.min);
    console.log('SSL Enabled:', config.database.ssl.enabled);
    console.log('----------------------------------------\n');
    
    console.log('📋 JWT CONFIG:');
    console.log('----------------------------------------');
    console.log('Access Expires:', config.jwt.accessExpiresIn);
    console.log('Refresh Expires:', config.jwt.refreshExpiresIn);
    console.log('Access Secret Length:', config.jwt.accessSecret.length);
    console.log('Refresh Secret Length:', config.jwt.refreshSecret.length);
    console.log('----------------------------------------\n');
    
    console.log('📋 CORS CONFIG:');
    console.log('----------------------------------------');
    console.log('Origins:', config.cors.origin);
    console.log('Credentials:', config.cors.credentials);
    console.log('----------------------------------------\n');
    
    console.log('📋 RATE LIMIT CONFIG:');
    console.log('----------------------------------------');
    console.log('Window (ms):', config.rateLimit.windowMs);
    console.log('Max Requests:', config.rateLimit.maxRequests);
    console.log('----------------------------------------\n');
    
    console.log('✅ ALL TESTS PASSED!');
    
} catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('----------------------------------------');
    console.error('Error:', error.message);
    console.error('----------------------------------------');
    process.exit(1);
}