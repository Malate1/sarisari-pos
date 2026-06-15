// backend/db.js

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
	host: "mysql-33a8d8f5-malatemichael22-8bf7.e.aivencloud.com",
	user: "avnadmin",
	password: "AVNS_VBteJC4_Dbdp8_quqra",
	database: "defaultdb",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

module.exports = pool;
