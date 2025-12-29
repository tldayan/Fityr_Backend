const mysql = require("mysql2/promise"); 
require("dotenv").config();

const db = mysql.createPool({ 
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "tlgmc500",
  database: process.env.DB_NAME || "fityr",
  port: process.env.DB_PORT || 5000,
});

module.exports = db;
