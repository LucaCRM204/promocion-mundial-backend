const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { pool, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'promocion-mundial-2026-secret-key-ultra-segura';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root to www
app.use((req, res, next) => {
    const host = req.get('host');
    if (host === 'promomundial.com.ar') {
        return res.redirect(301, `https://www.promomundial.com.ar${req.url}`);
    }
    next();
});

// Admins predefinidos (en memoria, no en BD)
const adminUsers = [
    {
        id: 'admin-validator',
        email: 'validator@mundial2026.com',
        password: bcrypt.hashSync('validator2026', 10),
        nombre: 'María',
        apellido: 'González',
        role: 'validator'
    },
    {
        id: 'admin-responsable',
        email: 'responsable@mundial2026.com',
        password: bcrypt.hashSync('responsable2026', 10),
        nombre: 'Ana',
        apellido: 'García',
        role: 'responsable'
    },
    {
        id: 'admin-owner',
        email: 'owner@mundial2026.com',
        password: bcrypt.hashSync('owner2026', 10),
        nombre: 'Roberto',
        apellido: 'López',
        role: 'owner'
    }
];

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token no proporcionado' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// ============================================
// RUTAS HTML
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cliente.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/cliente', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cliente.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString()
    });
});

// ============================================
// AUTENTICACIÓN
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, password, mesCuota2 } = req.body;
        
        if (!nombre || !apellido || !dni || !email || !password) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            `INSERT INTO users (nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2, password, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2 as "mesCuota2", role, created_at`,
            [nombre, apellido, dni, email, telefono || '', plan || 'No especificado', 
             direccion || '', localidad || '', cp || '', mesCuota2 || 'Octubre', hashedPassword, 'cliente']
        );
        
        const newUser = result.rows[0];
        const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ token, user: newUser });
        
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Email o DNI ya existe' });
        }
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña son requeridos' });
        }

        let user = null;

        // Buscar en admins
        if (role && role !== 'cliente') {
            user = adminUsers.find(u => u.email === email && u.role === role);
        } else {
            // Buscar en BD
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            user = result.rows[0];
        }
        
        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        
        const { password: _, ...userResponse } = user;
        
        res.json({ token, user: userResponse });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        let user;
        
        if (req.user.role !== 'cliente') {
            user = adminUsers.find(u => u.id === req.user.id);
        } else {
            const result = await pool.query(
                'SELECT id, nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2 as "mesCuota2", role, created_at FROM users WHERE id = $1',
                [req.user.id]
            );
            user = result.rows[0];
        }
        
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { nombre, apellido, telefono, plan, direccion, localidad, cp, password } = req.body;
        
        let query = 'UPDATE users SET ';
        let values = [];
        let valueIndex = 1;
        
        if (nombre) {
            query += `nombre = $${valueIndex}, `;
            values.push(nombre);
            valueIndex++;
        }
        if (apellido) {
            query += `apellido = $${valueIndex}, `;
            values.push(apellido);
            valueIndex++;
        }
        if (telefono) {
            query += `telefono = $${valueIndex}, `;
            values.push(telefono);
            valueIndex++;
        }
        if (plan) {
            query += `plan = $${valueIndex}, `;
            values.push(plan);
            valueIndex++;
        }
        if (direccion) {
            query += `direccion = $${valueIndex}, `;
            values.push(direccion);
            valueIndex++;
        }
        if (localidad) {
            query += `localidad = $${valueIndex}, `;
            values.push(localidad);
            valueIndex++;
        }
        if (cp) {
            query += `cp = $${valueIndex}, `;
            values.push(cp);
            valueIndex++;
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += `password = $${valueIndex}, `;
            values.push(hashedPassword);
            valueIndex++;
        }
        
        query = query.slice(0, -2);
        query += ` WHERE id = $${valueIndex} RETURNING id, nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2 as "mesCuota2", role, created_at`;
        values.push(req.user.id);
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// CUOTAS (CLIENTE)
// ============================================

app.get('/api/cuotas/mis-cuotas', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cuotas WHERE usuario_id = $1 ORDER BY numero', [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo cuotas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/cuotas/subir', authenticateToken, async (req, res) => {
    try {
        const { numero, comprobante, nombreArchivo } = req.body;
        
        if (!comprobante || !numero) {
            return res.status(400).json({ message: 'Número de cuota y archivo requeridos' });
        }

        // Verificar si existe
        const existing = await pool.query(
            'SELECT * FROM cuotas WHERE usuario_id = $1 AND numero = $2',
            [req.user.id, parseInt(numero)]
        );

        if (existing.rows.length > 0) {
            const cuota = existing.rows[0];
            
            if (cuota.estado === 'pendiente') {
                return res.status(400).json({ message: 'Ya existe un comprobante pendiente' });
            }

            if (cuota.estado === 'rechazado') {
                // Actualizar cuota rechazada
                const result = await pool.query(
                    `UPDATE cuotas SET estado = 'pendiente', archivo = $1, nombre_archivo = $2, fecha_subida = NOW(), motivo_rechazo = NULL
                     WHERE id = $3 RETURNING *`,
                    [comprobante, nombreArchivo || 'comprobante.pdf', cuota.id]
                );
                
                return res.json({ message: 'Comprobante actualizado', cuota: result.rows[0] });
            }
        }

        // Crear nueva cuota
        const result = await pool.query(
            `INSERT INTO cuotas (usuario_id, numero, estado, archivo, nombre_archivo)
             VALUES ($1, $2, 'pendiente', $3, $4) RETURNING *`,
            [req.user.id, parseInt(numero), comprobante, nombreArchivo || 'comprobante.pdf']
        );
        
        res.json({ message: 'Comprobante subido', cuota: result.rows[0] });
        
    } catch (error) {
        console.error('Error subiendo comprobante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// ADMINISTRACIÓN
// ============================================

app.get('/api/admin/clientes', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const result = await pool.query(`
            SELECT 
                u.id, u.nombre, u.apellido, u.dni, u.email, u.telefono, u.plan, 
                u.direccion, u.localidad, u.cp, u.mes_cuota_2 as "mesCuota2", u.created_at,
                COUNT(CASE WHEN c.estado = 'pendiente' THEN 1 END) as "cuotasPendientes",
                COUNT(CASE WHEN c.estado = 'validado' THEN 1 END) as "cuotasValidadas",
                COUNT(CASE WHEN c.estado = 'rechazado' THEN 1 END) as "cuotasRechazadas"
            FROM users u
            LEFT JOIN cuotas c ON u.id = c.usuario_id
            WHERE u.role = 'cliente'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.json(result.rows);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/admin/clientes/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const result = await pool.query(
            'SELECT id, nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2 as "mesCuota2", role, created_at FROM users WHERE id = $1',
            [parseInt(req.params.id)]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/admin/clientes/:id/cuotas', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const result = await pool.query(
            'SELECT * FROM cuotas WHERE usuario_id = $1 ORDER BY numero',
            [parseInt(req.params.id)]
        );
        
        res.json(result.rows);
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.put('/api/admin/cuotas/:id/validar', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'validator' && req.user.role !== 'owner') {
            return res.status(403).json({ message: 'Sin permisos' });
        }

        const { validar, motivo } = req.body;
        
        let result;
        if (validar) {
            result = await pool.query(
                `UPDATE cuotas SET estado = 'validado', fecha_validacion = NOW(), validado_por = $1
                 WHERE id = $2 RETURNING *`,
                [req.user.email, parseInt(req.params.id)]
            );
        } else {
            result = await pool.query(
                `UPDATE cuotas SET estado = 'rechazado', motivo_rechazo = $1, rechazado_por = $2
                 WHERE id = $3 RETURNING *`,
                [motivo || 'No especificado', req.user.email, parseInt(req.params.id)]
            );
        }
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cuota no encontrada' });
        }
        
        res.json({ message: validar ? 'Validada' : 'Rechazada', cuota: result.rows[0] });
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/admin/estadisticas', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const clientesResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['cliente']);
        const cuotasResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado = 'validado' THEN 1 END) as validadas,
                COUNT(CASE WHEN estado = 'rechazado' THEN 1 END) as rechazadas
            FROM cuotas
        `);

        res.json({
            totalClientes: parseInt(clientesResult.rows[0].count),
            totalCuotas: parseInt(cuotasResult.rows[0].total),
            cuotasPendientes: parseInt(cuotasResult.rows[0].pendientes),
            cuotasValidadas: parseInt(cuotasResult.rows[0].validadas),
            cuotasRechazadas: parseInt(cuotasResult.rows[0].rechazadas)
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.post('/api/admin/importar-clientes', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'owner' && req.user.role !== 'responsable') {
            return res.status(403).json({ message: 'Sin permisos' });
        }

        const { clientes } = req.body;
        
        if (!Array.isArray(clientes) || clientes.length === 0) {
            return res.status(400).json({ message: 'Array de clientes requerido' });
        }

        const importados = [];
        const errores = [];

        for (const clienteData of clientes) {
            try {
                if (!clienteData.nombre || !clienteData.apellido || !clienteData.dni || !clienteData.email) {
                    errores.push({ cliente: clienteData, error: 'Faltan campos' });
                    continue;
                }

                const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                const result = await pool.query(
                    `INSERT INTO users (nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2, password, role)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                     RETURNING id, nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, mes_cuota_2 as "mesCuota2", role, created_at`,
                    [
                        clienteData.nombre,
                        clienteData.apellido,
                        clienteData.dni,
                        clienteData.email,
                        clienteData.telefono || '',
                        clienteData.plan || 'No especificado',
                        clienteData.direccion || '',
                        clienteData.localidad || '',
                        clienteData.cp || '',
                        clienteData.mesCuota2 || 'Octubre',
                        hashedPassword,
                        'cliente'
                    ]
                );

                const nuevoCliente = { ...result.rows[0], passwordTemporal: tempPassword };
                importados.push(nuevoCliente);

            } catch (error) {
                if (error.code === '23505') {
                    errores.push({ cliente: clienteData, error: 'Ya existe' });
                } else {
                    errores.push({ cliente: clienteData, error: error.message });
                }
            }
        }

        res.json({
            message: `${importados.length} importados, ${errores.length} errores`,
            importados,
            errores
        });

    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Iniciar
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('\n===========================================');
        console.log('PROMOCION MUNDIAL 2026 - ACTIVO');
        console.log('===========================================');
        console.log(`Puerto: ${PORT}`);
        console.log('\nCREDENCIALES ADMIN:');
        console.log('validator@mundial2026.com / validator2026');
        console.log('responsable@mundial2026.com / responsable2026');
        console.log('owner@mundial2026.com / owner2026');
        console.log('\nRUTAS:');
        console.log('/ -> Panel Cliente');
        console.log('/admin -> Panel Administracion');
        console.log('\nBASE DE DATOS: PostgreSQL conectada');
        console.log('===========================================\n');
    });
}).catch(error => {
    console.error('Error fatal al iniciar:', error);
    process.exit(1);
});

module.exports = app;