const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'datastorage',
    password: process.env.DB_PASSWORD || 'admin',
    port: 5432,
});

// Increased to 10 retries for slower boot times!
const initDB = async (retries = 10) => {
    while (retries > 0) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS files (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    physical_name VARCHAR(255), 
                    folder_path TEXT DEFAULT '',
                    is_directory BOOLEAN DEFAULT FALSE,
                    size BIGINT DEFAULT 0,
                    in_trash BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log("✅ Database Connected & Tables Verified");
            return;
        } catch (err) {
            console.log(`⏳ Database not ready yet. Retrying... (${retries} attempts left)`);
            retries -= 1;
            await new Promise(res => setTimeout(res, 2000)); 
        }
    }
    console.error("❌ Database Connection Failed after multiple attempts.");
};

module.exports = { pool, initDB };