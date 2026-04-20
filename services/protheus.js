const sql = require('mssql');

const dbConfig = {
    user: process.env.PROTHEUS_USER || '',
    password: process.env.PROTHEUS_PASSWORD || '',
    server: process.env.PROTHEUS_SERVER || '',
    database: process.env.PROTHEUS_DATABASE || 'protheus',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    connectionTimeout: 15000,
    requestTimeout: 60000
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect().catch(err => {
    console.error('Conexão inicial com Protheus falhou:', err.message);
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
        console.error('Erro em Protheus connectAndQuery:', error.message);
        throw error;
    }
}

module.exports = {
    connectAndQuery,
    dbConfig
};
