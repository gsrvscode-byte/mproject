
const mysql = require("mysql2/promise");


// =========================================================
// MySQL Connection Pool
// =========================================================

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


// =========================================================
// Test Database
// =========================================================

async function connectDB() {

    try {

        const connection = await pool.getConnection();

        console.log("MySQL connected successfully");

        connection.release();

    } catch (error) {

        console.error(
            "MySQL connection failed:",
            error.message
        );

        process.exit(1);

    }

}


module.exports = {
    pool,
    connectDB
};
