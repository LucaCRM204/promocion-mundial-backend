const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'promocion-mundial-2026-secret-key';

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Datos en memoria
let users = [];
let comprobantes = [];
let premios = [];

// USUARIOS ADMINISTRADORES POR DEFECTO
const adminUsers = [
    {
        id: 'admin-1',
        username: 'validador',
        password: bcrypt.hashSync('validador2026', 10),
        nombre: 'Validador',
        rol: 'validator'
    },
    {
        id: 'admin-2',
        username: 'responsable',
        password: bcrypt.hashSync('responsable2026', 10),
        nombre: 'Responsable',
        rol: 'responsable'
    },
    {
        id: 'admin-3',
        username: 'owner',
        password: bcrypt.hashSync('owner2026', 10),
        nombre: 'Dueño',
        rol: 'owner'
    }
];

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({
        message: 'API Promoción Mundial 2026',
        status: 'active',
        version: '1.0.0'
    });
});

// REGISTRO DE CLIENTE
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, password } = req.body;
        
        if (!nombre || !apellido || !dni || !email || !password) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        const existingUser = users.find(u => u.email === email || u.dni === dni);
        if (existingUser) {
            return res.status(400).json({ error: 'Ya existe un usuario con ese email o DNI' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            id: users.length + 1,
            nombre,
            apellido,
            dni,
            email,
            telefono,
            plan: plan || 'No especificado',
            direccion,
            localidad,
            cp,
            password: hashedPassword,
            role: 'cliente',
            created_at: new Date().toISOString()
        };
        
        users.push(newUser);
        
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        const { password: _, ...userResponse } = newUser;
        
        res.json({
            success: true,
            token,
            user: userResponse,
            message: 'Usuario registrado exitosamente'
        });
        
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// LOGIN DE CLIENTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }
        
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        const { password: _, ...userResponse } = user;
        
        res.json({
            success: true,
            token,
            user: userResponse,
            message: 'Login exitoso'
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// LOGIN DE ADMINISTRADOR
app.post('/api/admin-login', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const admin = adminUsers.find(u => u.username === username && u.rol === role);
        
        if (!admin) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password);
        
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        res.json({
            success: true,
            user: {
                id: admin.id,
                username: admin.username,
                nombre: admin.nombre,
                rol: admin.rol
            },
            message: 'Login exitoso'
        });

    } catch (error) {
        console.error('Error en admin login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// OBTENER CLIENTES
app.get('/api/get-clients', (req, res) => {
    try {
        const clientsWithStats = users.map(user => {
            const userComprobantes = comprobantes.filter(c => c.usuario_id === user.id);
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
                pendientes: userComprobantes.filter(c => c.estado === 'pending').length,
                validados: userComprobantes.filter(c => c.estado === 'validated').length,
                rechazados: userComprobantes.filter(c => c.estado === 'rejected').length
            };
        });

        res.json({
            success: true,
            clients: clientsWithStats
        });
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// OBTENER CLIENTE POR ID
app.get('/api/get-client/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        
        const userComprobantes = comprobantes.filter(c => c.usuario_id === userId);
        const userPremios = premios.filter(p => p.usuario_id === userId);
        
        const { password, ...userResponse } = user;
        
        res.json({
            success: true,
            client: {
                ...userResponse,
                comprobantes: userComprobantes,
                premios: userPremios
            }
        });
    } catch (error) {
        console.error('Error obteniendo cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// OBTENER ESTADÍSTICAS
app.get('/api/get-stats', (req, res) => {
    try {
        const stats = {
            total_usuarios: users.length,
            comprobantes_pending: comprobantes.filter(c => c.estado === 'pending').length,
            comprobantes_validated: comprobantes.filter(c => c.estado === 'validated').length,
            comprobantes_rejected: comprobantes.filter(c => c.estado === 'rejected').length,
            premios_totales: premios.length
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// SUBIR COMPROBANTE
app.post('/api/upload-comprobante', (req, res) => {
    try {
        const { usuario_id, numero_cuota } = req.body;
        
        const newComprobante = {
            id: comprobantes.length + 1,
            usuario_id: parseInt(usuario_id),
            numero_cuota: parseInt(numero_cuota),
            estado: 'pending',
            fecha_subida: new Date().toISOString(),
            nombre_archivo: `comprobante-cuota-${numero_cuota}.pdf`
        };
        
        comprobantes.push(newComprobante);
        
        res.json({
            success: true,
            filename: `comprobante-cuota-${numero_cuota}.pdf`,
            size: '120 KB'
        });
        
    } catch (error) {
        console.error('Error subiendo comprobante:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// OBTENER DATOS DE USUARIO
app.get('/api/get-user-data', (req, res) => {
    try {
        const { usuario_id } = req.query;
        const userComprobantes = comprobantes.filter(c => c.usuario_id === parseInt(usuario_id));
        
        res.json({
            success: true,
            comprobantes: userComprobantes
        });
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// VALIDAR COMPROBANTE
app.put('/api/validate-comprobante/:id', (req, res) => {
    try {
        const comprobanteId = parseInt(req.params.id);
        const comprobante = comprobantes.find(c => c.id === comprobanteId);
        
        if (!comprobante) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }
        
        comprobante.estado = 'validated';
        comprobante.fecha_validacion = new Date().toISOString();
        
        // Crear premio
        const nuevoPremio = {
            id: premios.length + 1,
            usuario_id: comprobante.usuario_id,
            numero_cuota: comprobante.numero_cuota,
            estado: 'disponible',
            fecha_creacion: new Date().toISOString()
        };
        premios.push(nuevoPremio);
        
        res.json({
            success: true,
            message: 'Comprobante validado exitosamente'
        });
    } catch (error) {
        console.error('Error validando comprobante:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// RECHAZAR COMPROBANTE
app.put('/api/reject-comprobante/:id', (req, res) => {
    try {
        const comprobanteId = parseInt(req.params.id);
        const { motivo } = req.body;
        const comprobante = comprobantes.find(c => c.id === comprobanteId);
        
        if (!comprobante) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }
        
        comprobante.estado = 'rejected';
        comprobante.motivo_rechazo = motivo || 'No especificado';
        comprobante.fecha_rechazo = new Date().toISOString();
        
        res.json({
            success: true,
            message: 'Comprobante rechazado'
        });
    } catch (error) {
        console.error('Error rechazando comprobante:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// RECLAMAR PREMIO
app.post('/api/claim-prize', (req, res) => {
    try {
        const { usuario_id, numero_cuota, nombre_premio } = req.body;
        
        const premio = premios.find(p => p.usuario_id === parseInt(usuario_id) && p.numero_cuota === parseInt(numero_cuota));
        
        if (premio) {
            premio.estado = 'reclamado';
            premio.fecha_reclamo = new Date().toISOString();
        }
        
        res.json({
            success: true,
            message: 'Premio reclamado exitosamente'
        });
    } catch (error) {
        console.error('Error reclamando premio:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🏆 Servidor Promoción Mundial 2026 corriendo en puerto ${PORT}`);
    console.log(`\n📋 CREDENCIALES DE ADMINISTRACIÓN:`);
    console.log(`\n1️⃣  VALIDADOR:`);
    console.log(`   Usuario: validador`);
    console.log(`   Contraseña: validador2026`);
    console.log(`\n2️⃣  RESPONSABLE:`);
    console.log(`   Usuario: responsable`);
    console.log(`   Contraseña: responsable2026`);
    console.log(`\n3️⃣  DUEÑO (Acceso completo):`);
    console.log(`   Usuario: owner`);
    console.log(`   Contraseña: owner2026`);
    console.log(`\n✅ Servidor listo!\n`);
});

module.exports = app;