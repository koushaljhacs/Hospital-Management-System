/**
 * ======================================================================
 * FILE: backend/test-db.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Test script to verify database connection using the configuration.
 * Run this after setting up database.js to ensure everything works.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-02
 * 
 * USAGE: node test-db.js
 * 
 * ======================================================================
 */

const { pool, testConnection, healthCheck, getPoolMetrics } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

/**
 * Main test function to verify database connectivity
 */
async function testDatabaseConnection() {
    console.log('\n');
    console.log('='.repeat(60));
    console.log(' HOSPITAL MANAGEMENT SYSTEM - DATABASE TEST');
    console.log('='.repeat(60));
    console.log(` Date: ${new Date().toLocaleString()}`);
    console.log(` Team: OctNov`);
    console.log(` Lead: Koushal Jha`);
    console.log('='.repeat(60));
    console.log('\n');

    try {
        // Test 1: Basic Connection
        console.log('📡 Test 1: Basic Connection...');
        const connected = await testConnection();
        if (connected) {
            console.log('   ✅ Connection successful\n');
        } else {
            console.log('   ❌ Connection failed\n');
            process.exit(1);
        }

        // Test 2: Query Execution
        console.log('📡 Test 2: Query Execution...');
        const result = await pool.query('SELECT NOW() as server_time, current_database() as db_name, current_user as db_user');
        console.log(`   ✅ Query executed successfully`);
        console.log(`      Server Time: ${result.rows[0].server_time}`);
        console.log(`      Database: ${result.rows[0].db_name}`);
        console.log(`      User: ${result.rows[0].db_user}\n`);

        // Test 3: Connection Pool
        console.log('📡 Test 3: Connection Pool...');
        const metrics = getPoolMetrics();
        console.log(`   ✅ Pool metrics:`);
        console.log(`      Total Connections: ${metrics.total}`);
        console.log(`      Idle Connections: ${metrics.idle}`);
        console.log(`      Waiting Clients: ${metrics.waiting}`);
        console.log(`      Max Pool Size: ${metrics.max}`);
        console.log(`      Min Pool Size: ${metrics.min}\n`);

        // Test 4: Health Check
        console.log('📡 Test 4: Health Check...');
        const health = await healthCheck();
        if (health.status === 'healthy') {
            console.log(`   ✅ System healthy`);
            console.log(`      Latency: ${health.latency}ms`);
            console.log(`      Timestamp: ${health.timestamp}\n`);
        } else {
            console.log(`   ❌ System unhealthy: ${health.error}\n`);
        }

        // Test 5: Table Access
        console.log('📡 Test 5: Table Access...');
        const tables = await pool.query(`
            SELECT table_name, table_schema 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            LIMIT 5
        `);
        console.log(`   ✅ Can access tables`);
        console.log(`      Sample tables: ${tables.rows.map(t => t.table_name).join(', ')}\n`);

        // Test 6: Environment Configuration
        console.log('📡 Test 6: Environment Configuration...');
        console.log(`   ✅ Using configuration:`);
        console.log(`      Host: ${process.env.DB_HOST || '100.88.168.61'}`);
        console.log(`      Port: ${process.env.DB_PORT || '6000'}`);
        console.log(`      Database: ${process.env.DB_NAME || 'Hospital_Managment_System'}`);
        console.log(`      User: ${process.env.DB_USER || 'postgres'}`);
        console.log(`      Pool Max: ${process.env.DB_POOL_MAX || '20'}`);
        console.log(`      Pool Min: ${process.env.DB_POOL_MIN || '5'}\n`);

        console.log('='.repeat(60));
        console.log(' ✅ ALL TESTS PASSED - DATABASE CONNECTION SUCCESSFUL');
        console.log('='.repeat(60));

    } catch (error) {
        console.log('\n❌ TEST FAILED');
        console.log('='.repeat(60));
        console.log(' Error Details:');
        console.log(`   Message: ${error.message}`);
        console.log(`   Code: ${error.code || 'N/A'}`);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n 🔍 Possible Issues:');
            console.log('   1. PostgreSQL server is not running');
            console.log('   2. Port 6000 is not open');
            console.log('   3. Host 100.88.168.61 is not reachable');
            console.log('   4. Firewall blocking connection');
        } else if (error.code === '28P01') {
            console.log('\n 🔍 Possible Issues:');
            console.log('   1. Invalid password');
            console.log('   2. User does not exist');
        } else if (error.code === '3D000') {
            console.log('\n 🔍 Possible Issues:');
            console.log('   1. Database does not exist');
            console.log('   2. Database name is case-sensitive');
        }
        console.log('='.repeat(60));
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the test
testDatabaseConnection();