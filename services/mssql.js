const sql = require('mssql');

const dbConfig = {
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    server: process.env.DB_SERVER || '',
    database: process.env.DB_DATABASE || '',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect().catch(err => {
    console.error("Conexão inicial com o banco de dados falhou:", err);
});

async function connectAndQuery(query, params = {}) {
    try {
        await poolConnect;

        const request = pool.request();

        for (const key in params) {
            request.input(key, params[key]);
        }

        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro em connectAndQuery:', error);
        throw error;
    }
}

module.exports = {
    connectAndQuery,
    dbConfig
};