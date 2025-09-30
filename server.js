const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'promocion-mundial-2026-secret-key-ultra-segura';

// Configuración de multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo JPG, PNG o PDF'));
        }
    }
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Base de datos en memoria
let users = [];
let cuotas = [];
let nextUserId = 1;
let nextCuotaId = 1;

// USUARIOS ADMINISTRADORES POR DEFECTO
const adminUsers = [
    {
        id: 'admin-validator',
        email: 'validator@mundial2026.com',
        password: bcrypt.hashSync('validator2026', 10),
        nombre: 'María',
        apellido: 'Validadora',
        role: 'validator'
    },
    {
        id: 'admin-responsable',
        email: 'responsable@mundial2026.com',
        password: bcrypt.hashSync('responsable2026', 10),
        nombre: 'Carlos',
        apellido: 'Responsable',
        role: 'responsable'
    },
    {
        id: 'admin-owner',
        email: 'owner@mundial2026.com',
        password: bcrypt.hashSync('owner2026', 10),
        nombre: 'Roberto',
        apellido: 'Dueño',
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
// RUTAS DE SALUD Y BIENVENIDA
// ============================================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        users: users.length,
        cuotas: cuotas.length
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'API Promoción Mundial 2026',
        status: 'active',
        version: '2.0.0',
        endpoints: {
            auth: '/api/auth/*',
            cuotas: '/api/cuotas/*',
            admin: '/api/admin/*'
        }
    });
});

// ============================================
// AUTENTICACIÓN
// ============================================

// REGISTRO DE CLIENTE
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, password } = req.body;
        
        if (!nombre || !apellido || !dni || !email || !password) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }
        
        // Verificar si ya existe
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
        
        res.json({
            token,
            user: userResponse
        });
        
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// LOGIN UNIFICADO (Cliente y Admin)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña son requeridos' });
        }

        let user = null;
        let isAdmin = false;

        // Si viene un role específico, es login de admin
        if (role && role !== 'cliente') {
            user = adminUsers.find(u => u.email === email && u.role === role);
            isAdmin = true;
        } else {
            // Login de cliente
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
        
        res.json({
            token,
            user: userResponse
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// VERIFICAR TOKEN
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true,
        user: req.user
    });
});

// ============================================
// RUTAS DE CUOTAS (CLIENTE)
// ============================================

// OBTENER MIS CUOTAS
app.get('/api/cuotas/mis-cuotas', authenticateToken, (req, res) => {
    try {
        const userCuotas = cuotas.filter(c => c.usuario_id === req.user.id);
        res.json(userCuotas);
    } catch (error) {
        console.error('Error obteniendo cuotas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// SUBIR COMPROBANTE
app.post('/api/cuotas/subir', authenticateToken, upload.single('comprobante'), (req, res) => {
    try {
        const { numero } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ message: 'No se proporcionó archivo' });
        }

        if (!numero) {
            return res.status(400).json({ message: 'Número de cuota requerido' });
        }

        // Verificar si ya existe una cuota para este número
        const existingCuota = cuotas.find(c => 
            c.usuario_id === req.user.id && 
            c.numero === parseInt(numero)
        );

        if (existingCuota && existingCuota.estado === 'pendiente') {
            return res.status(400).json({ message: 'Ya existe un comprobante pendiente para esta cuota' });
        }

        // Si existe pero fue rechazada, permitir resubir
        if (existingCuota && existingCuota.estado === 'rechazado') {
            existingCuota.estado = 'pendiente';
            existingCuota.archivo = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            existingCuota.fecha_subida = new Date().toISOString();
            existingCuota.motivo_rechazo = null;
            
            return res.json({ 
                message: 'Comprobante actualizado correctamente',
                cuota: existingCuota
            });
        }

        // Crear nueva cuota
        const nuevaCuota = {
            id: nextCuotaId++,
            usuario_id: req.user.id,
            numero: parseInt(numero),
            estado: 'pendiente',
            archivo: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
            fecha_subida: new Date().toISOString(),
            motivo_rechazo: null,
            fecha_validacion: null
        };

        cuotas.push(nuevaCuota);
        
        res.json({ 
            message: 'Comprobante subido correctamente',
            cuota: nuevaCuota
        });
        
    } catch (error) {
        console.error('Error subiendo comprobante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// RUTAS DE ADMINISTRACIÓN
// ============================================

// OBTENER TODOS LOS CLIENTES (con estadísticas)
app.get('/api/admin/clientes', authenticateToken, (req, res) => {
    try {
        // Verificar que sea admin
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
                cuotasPendientes: userCuotas.filter(c => c.estado === 'pendiente').length,
                cuotasValidadas: userCuotas.filter(c => c.estado === 'validado').length,
                cuotasRechazadas: userCuotas.filter(c => c.estado === 'rechazado').length
            };
        });

        res.json(clientesConStats);
        
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// OBTENER CLIENTE POR ID
app.get('/api/admin/clientes/:id', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const userId = parseInt(req.params.id);
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        
        const { password, ...userResponse } = user;
        res.json(userResponse);
        
    } catch (error) {
        console.error('Error obteniendo cliente:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// OBTENER CUOTAS DE UN CLIENTE
app.get('/api/admin/clientes/:id/cuotas', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const userId = parseInt(req.params.id);
        const userCuotas = cuotas.filter(c => c.usuario_id === userId);
        
        res.json(userCuotas);
        
    } catch (error) {
        console.error('Error obteniendo cuotas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// VALIDAR O RECHAZAR CUOTA
app.put('/api/admin/cuotas/:id/validar', authenticateToken, (req, res) => {
    try {
        // Solo validator y owner pueden validar
        if (req.user.role !== 'validator' && req.user.role !== 'owner') {
            return res.status(403).json({ message: 'No tienes permisos para validar cuotas' });
        }

        const cuotaId = parseInt(req.params.id);
        const { validar, motivo } = req.body;
        
        const cuota = cuotas.find(c => c.id === cuotaId);
        
        if (!cuota) {
            return res.status(404).json({ message: 'Cuota no encontrada' });
        }

        if (validar) {
            cuota.estado = 'validado';
            cuota.fecha_validacion = new Date().toISOString();
            cuota.validado_por = req.user.email;
        } else {
            cuota.estado = 'rechazado';
            cuota.motivo_rechazo = motivo || 'No especificado';
            cuota.fecha_rechazo = new Date().toISOString();
            cuota.rechazado_por = req.user.email;
        }
        
        res.json({ 
            message: validar ? 'Cuota validada correctamente' : 'Cuota rechazada',
            cuota
        });
        
    } catch (error) {
        console.error('Error validando cuota:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ============================================
// RUTAS ADICIONALES PARA COMPATIBILIDAD
// ============================================

// OBTENER ESTADÍSTICAS GENERALES
app.get('/api/admin/estadisticas', authenticateToken, (req, res) => {
    try {
        if (req.user.role === 'cliente') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const stats = {
            totalClientes: users.length,
            totalCuotas: cuotas.length,
            cuotasPendientes: cuotas.filter(c => c.estado === 'pendiente').length,
            cuotasValidadas: cuotas.filter(c => c.estado === 'validado').length,
            cuotasRechazadas: cuotas.filter(c => c.estado === 'rechazado').length
        };

        res.json(stats);
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ENDPOINT PARA LIMPIAR DATOS (solo en desarrollo)
app.post('/api/admin/reset-data', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'owner') {
            return res.status(403).json({ message: 'Solo el dueño puede resetear datos' });
        }

        users = [];
        cuotas = [];
        nextUserId = 1;
        nextCuotaId = 1;

        res.json({ message: 'Datos reseteados correctamente' });
        
    } catch (error) {
        console.error('Error reseteando datos:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: err.message || 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Ruta 404
app.use((req, res) => {
    res.status(404).json({ 
        message: 'Ruta no encontrada',
        path: req.path
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n===========================================');
    console.log('🏆 PROMOCIÓN MUNDIAL 2026 - API ACTIVA');
    console.log('===========================================');
    console.log(`\n🌐 Servidor corriendo en puerto: ${PORT}`);
    console.log(`📅 Fecha: ${new Date().toLocaleString('es-AR')}`);
    console.log('\n🔐 CREDENCIALES DE ADMINISTRACIÓN:');
    console.log('\n👤 VALIDADOR (Solo validación):');
    console.log('   Email: validator@mundial2026.com');
    console.log('   Password: validator2026');
    console.log('\n👤 RESPONSABLE (Gestión operativa):');
    console.log('   Email: responsable@mundial2026.com');
    console.log('   Password: responsable2026');
    console.log('\n👤 DUEÑO (Acceso completo):');
    console.log('   Email: owner@mundial2026.com');
    console.log('   Password: owner2026');
    console.log('\n===========================================');
    console.log('✅ Sistema listo para recibir peticiones');
    console.log('===========================================\n');
});

module.exports = app;