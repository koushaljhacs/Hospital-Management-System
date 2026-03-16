
const dotenv = require('dotenv');
const path = require('path');
const db = require('../src/config/database');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

beforeAll(async () => {
    await db.connectWithRetry();
});

afterAll(async () => {
    await db.shutdown();
});
