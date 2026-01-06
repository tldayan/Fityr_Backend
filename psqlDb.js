const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  /* host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "Fityr",
  port: process.env.DB_PORT || 5001, // PostgreSQL default port */
  connectionString: process.env.SUPABASE_PSQL
});

module.exports = pool;
