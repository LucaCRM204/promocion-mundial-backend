const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Datos en memoria (en producción usarías una base de datos)
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
        rol: 'validator',
        email: 'validador@vw.com'
    },
    {
        id: 'admin-2',
        username: 'responsable',
        password: bcrypt.hashSync('responsable2026', 10),
        nombre: 'Responsable',
        rol: 'responsable',
        email: 'responsable@vw.com'
    },
    {
        id: 'admin-3',
        username: 'owner',
        password: bcrypt.hashSync('owner2026', 10),
        nombre: 'Dueño',
        rol: 'owner',
        email: 'owner@vw.com'
    }
];

// Compartir datos entre archivos
app.locals.users = users;
app.locals.comprobantes = comprobantes;
app.locals.premios = premios;
app.locals.adminUsers = adminUsers;

// Función para guardar datos
app.locals.saveData = function() {
    const data = {
        users,
        comprobantes,
        premios,
        lastUpdate: new Date().toISOString()
    };
    
    try {
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        console.log('Datos guardados correctamente');
    } catch (error) {
        console.error('Error guardando datos:', error);
    }
};

// Cargar datos al iniciar
try {
    if (fs.existsSync('data.json')) {
        const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        users = data.users || [];
        comprobantes = data.comprobantes || [];
        premios = data.premios || [];
        app.locals.users = users;
        app.locals.comprobantes = comprobantes;
        app.locals.premios = premios;
        console.log('Datos cargados correctamente');
    }
} catch (error) {
    console.error('Error cargando datos:', error);
}
// Middleware de autenticación opcional (no bloquea, solo decodifica si existe token)
app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'promocion-mundial-2026-secret-key';
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Token inválido, pero no bloqueamos la request
            req.user = null;
        }
    }
    
    next();
});
// Rutas
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const comprobantesRoutes = require('./routes/comprobantes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', comprobantesRoutes);

// Ruta de login para administradores
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
                rol: admin.rol,
                email: admin.email
            },
            message: 'Login exitoso'
        });

    } catch (error) {
        console.error('Error en admin login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener clientes
app.get('/api/get-clients', (req, res) => {
    try {
        const clientsWithStats = users.map(user => {
            const userComprobantes = comprobantes.filter(c => c.usuario_id === user.id);
            return {
                ...user,
                pendientes: userComprobantes.filter(c => c.estado === 'pending').length,
                validados: userComprobantes.filter(c => c.estado === 'validated').length
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

// Ruta para obtener estadísticas
app.get('/api/get-stats', (req, res) => {
    try {
        const stats = {
            total_usuarios: users.length,
            comprobantes_pending: comprobantes.filter(c => c.estado === 'pending').length,
            comprobantes_validated: comprobantes.filter(c => c.estado === 'validated').length,
            comprobantes_rejected: comprobantes.filter(c => c.estado === 'rejected').length,
            premios_entregados: premios.filter(p => p.entregado).length
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

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'API Promoción Mundial 2026',
        status: 'active',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth/*',
            admin: '/api/admin/*'
        }
    });
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