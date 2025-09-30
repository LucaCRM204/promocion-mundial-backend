const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                dni VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                telefono VARCHAR(50),
                plan VARCHAR(255),
                direccion VARCHAR(255),
                localidad VARCHAR(100),
                cp VARCHAR(20),
                mes_cuota_2 VARCHAR(50) DEFAULT 'Octubre',
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'cliente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cuotas (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                numero INTEGER NOT NULL,
                estado VARCHAR(50) DEFAULT 'pendiente',
                archivo TEXT,
                nombre_archivo VARCHAR(255),
                fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_validacion TIMESTAMP,
                validado_por VARCHAR(255),
                rechazado_por VARCHAR(255),
                motivo_rechazo TEXT,
                CONSTRAINT unique_user_cuota UNIQUE(usuario_id, numero)
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_dni ON users(dni);
            CREATE INDEX IF NOT EXISTS idx_cuotas_usuario ON cuotas(usuario_id);
        `);
        
        console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
        throw error;
    }
}

module.exports = { pool, initializeDatabase };