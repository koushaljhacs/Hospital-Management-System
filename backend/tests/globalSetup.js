
const dotenv = require('dotenv');
const path = require('path');
const db = require('../src/config/database');

module.exports = async () => {
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
    await db.connectWithRetry();
};
