const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'promocion-mundial-2026-secret-key-ultra-segura';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos en memoria (reemplaza esto con tu DB real si tienes)
let users = [];
let cuotas = [];
let nextUserId = 1;
let nextCuotaId = 1;

// Admins predefinidos
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
        timestamp: new Date().toISOString(),
        users: users.length,
        cuotas: cuotas.length
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
        
        const existingUser = users.find(u => u.email === email || u.dni === dni);
        if (existingUser) {
            return res.status(400).json({ message: 'Ya existe un usuario con ese email o DNI' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            id: nextUserId++,
            nombre,
            apellido,
            dni,
            email,
            telefono: telefono || '',
            plan: plan || 'No especificado',
            direccion: direccion || '',
            localidad: localidad || '',
            cp: cp || '',
            mesCuota2: mesCuota2 || 'Octubre',
            password: hashedPassword,
            role: 'cliente',
            created_at: new Date().toISOString()
        };
        
        users.push(newUser);
        
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        const { password: _, ...userResponse } = newUser;
        
        res.json({ token, user: userResponse });
        
    } catch (error) {
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

        if (role && role !== 'cliente') {
            user = adminUsers.find(u => u.email === email && u.role === role);
        } else {
            user = users.find(u => u.email === email);
        }
        
        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
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

app.get('/api/auth/profile', authenticateToken, (req, res) => {
    try {
        let user;
        if (req.user.role !== 'cliente') {
            user = adminUsers.find(u => u.id === req.user.id);
        } else {
            user = users.find(u => u.id === req.user.id);
        }
        
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        const { password, ...userResponse } = user;
        res.json(userResponse);
        
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { nombre, apellido, telefono, plan, direccion, localidad, cp, password } = req.body;
        
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex === -1) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        if (nombre) users[userIndex].nombre = nombre;
        if (apellido) users[userIndex].apellido = apellido;
        if (telefono) users[userIndex].telefono = telefono;
        if (plan) users[userIndex].plan = plan;
        if (direccion) users[userIndex].direccion = direccion;
        if (localidad) users[userIndex].localidad = localidad;
        if (cp) users[userIndex].cp = cp;
        if (password) {
            users[userIndex].password = await bcrypt.hash(password, 10);
        }
        
        const { password: _, ...userResponse } = users[userIndex];
        res.json(userResponse);
        
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// CUOTAS (CLIENTE)
// ============================================

app.get('/api/cuotas/mis-cuotas', authenticateToken, (req, res) => {
    try {
        const userCuotas = cuotas.filter(c => c.usuario_id === req.user.id);
        res.json(userCuotas);
    } catch (error) {
        console.error('Error obteniendo cuotas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/cuotas/subir', authenticateToken, (req, res) => {
    try {
        const { numero, comprobante, nombreArchivo } = req.body;
        
        if (!comprobante || !numero) {
            return res.status(400).json({ message: 'Número de cuota y archivo requeridos' });
        }

        const existingCuota = cuotas.find(c => 
            c.usuario_id === req.user.id && 
            c.numero === parseInt(numero)
        );

        if (existingCuota && existingCuota.estado === 'pendiente') {
            return res.status(400).json({ message: 'Ya existe un comprobante pendiente' });
        }

        if (existingCuota && existingCuota.estado === 'rechazado') {
            existingCuota.estado = 'pendiente';
            existingCuota.archivo = comprobante;
            existingCuota.nombre_archivo = nombreArchivo || 'comprobante.pdf';
            existingCuota.fecha_subida = new Date().toISOString();
            existingCuota.motivo_rechazo = null;
            
            return res.json({ message: 'Comprobante actualizado', cuota: existingCuota });
        }

        const nuevaCuota = {
            id: nextCuotaId++,
            usuario_id: req.user.id,
            numero: parseInt(numero),
            estado: 'pendiente',
            archivo: comprobante,
            nombre_archivo: nombreArchivo || 'comprobante.pdf',
            fecha_subida: new Date().toISOString()
        };

        cuotas.push(nuevaCuota);
        res.json({ message: 'Comprobante subido', cuota: nuevaCuota });
        
    } catch (error) {
        console.error('Error subiendo comprobante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// ADMINISTRACIÓN
// ============================================

app.get('/api/admin/clientes', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const clientesConStats = users.map(user => {
            const userCuotas = cuotas.filter(c => c.usuario_id === user.id);
            
            return {
                id: user.id,
                nombre: user.nombre,
                apellido: user.apellido,
                dni: user.dni,
                email: user.email,
                telefono: user.telefono,
                plan: user.plan,
                direccion: user.direccion,
                localidad: user.localidad,
                cp: user.cp,
                mesCuota2: user.mesCuota2,
                cuotasPendientes: userCuotas.filter(c => c.estado === 'pendiente').length,
                cuotasValidadas: userCuotas.filter(c => c.estado === 'validado').length,
                cuotasRechazadas: userCuotas.filter(c => c.estado === 'rechazado').length,
                created_at: user.created_at
            };
        });

        res.json(clientesConStats);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/admin/clientes/:id', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const user = users.find(u => u.id === parseInt(req.params.id));
        if (!user) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        
        const { password, ...userResponse } = user;
        res.json(userResponse);
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/admin/clientes/:id/cuotas', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const userCuotas = cuotas.filter(c => c.usuario_id === parseInt(req.params.id));
        res.json(userCuotas);
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.put('/api/admin/cuotas/:id/validar', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'validator' && req.user.role !== 'owner') {
            return res.status(403).json({ message: 'Sin permisos' });
        }

        const cuota = cuotas.find(c => c.id === parseInt(req.params.id));
        if (!cuota) {
            return res.status(404).json({ message: 'Cuota no encontrada' });
        }

        const { validar, motivo } = req.body;

        if (validar) {
            cuota.estado = 'validado';
            cuota.fecha_validacion = new Date().toISOString();
            cuota.validado_por = req.user.email;
        } else {
            cuota.estado = 'rechazado';
            cuota.motivo_rechazo = motivo || 'No especificado';
            cuota.rechazado_por = req.user.email;
        }
        
        res.json({ message: validar ? 'Validada' : 'Rechazada', cuota });
        
    } catch (error) {
        res.status(500).json({ message: 'Error interno' });
    }
});

app.get('/api/admin/estadisticas', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        res.json({
            totalClientes: users.length,
            totalCuotas: cuotas.length,
            cuotasPendientes: cuotas.filter(c => c.estado === 'pendiente').length,
            cuotasValidadas: cuotas.filter(c => c.estado === 'validado').length,
            cuotasRechazadas: cuotas.filter(c => c.estado === 'rechazado').length
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

                const existe = users.find(u => u.email === clienteData.email || u.dni === clienteData.dni);
                if (existe) {
                    errores.push({ cliente: clienteData, error: 'Ya existe' });
                    continue;
                }

                const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                const nuevoCliente = {
                    id: nextUserId++,
                    ...clienteData,
                    mesCuota2: clienteData.mesCuota2 || 'Octubre',
                    password: hashedPassword,
                    passwordTemporal: tempPassword,
                    role: 'cliente',
                    created_at: new Date().toISOString()
                };

                users.push(nuevoCliente);
                const { password, ...clienteResponse } = nuevoCliente;
                importados.push(clienteResponse);

            } catch (error) {
                errores.push({ cliente: clienteData, error: error.message });
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
    console.log('===========================================\n');
});

module.exports = app;