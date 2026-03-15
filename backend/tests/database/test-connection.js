const { Pool } = require('pg');

async function testConnection() {
    // Test with port 5432
    const pool5432 = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'Hospital_Managment_System',
        user: 'postgres',
        password: 'koushal'
    });

    // Test with port 6000
    const pool6000 = new Pool({
        host: 'localhost',
        port: 6000,
        database: 'Hospital_Managment_System',
        user: 'postgres',
        password: 'koushal'
    });

    console.log('\n🔍 Testing port 5432...');
    try {
        const client = await pool5432.connect();
        const res = await client.query('SELECT version()');
        console.log('✅ Port 5432: SUCCESS');
        console.log(`   PostgreSQL: ${res.rows[0].version.split(' ')[1]}`);
        client.release();
    } catch (err) {
        console.log('❌ Port 5432: FAILED');
        console.log(`   Error: ${err.message}`);
    }

    console.log('\n🔍 Testing port 6000...');
    try {
        const client = await pool6000.connect();
        const res = await client.query('SELECT version()');
        console.log('✅ Port 6000: SUCCESS');
        console.log(`   PostgreSQL: ${res.rows[0].version.split(' ')[1]}`);
        client.release();
    } catch (err) {
        console.log('❌ Port 6000: FAILED');
        console.log(`   Error: ${err.message}`);
    }

    await pool5432.end();
    await pool6000.end();
}

testConnection();