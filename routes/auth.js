const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'promocion-mundial-2026-secret-key';

// Importar usuarios desde el archivo principal
// En producción, esto vendría de la base de datos
let users = [];

// Middleware para inyectar dependencias
router.use((req, res, next) => {
    if (req.app.locals.users) {
        users = req.app.locals.users;
    }
    next();
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { nombre, apellido, dni, email, telefono, plan, direccion, localidad, cp, password } = req.body;
        
        // Validar campos obligatorios
        if (!nombre || !apellido || !dni || !email || !password) {
            return res.status(400).json({ 
                error: 'Faltan campos obligatorios' 
            });
        }
        
        // Verificar si el usuario ya existe
        const existingUser = users.find(u => u.email === email || u.dni === dni);
        if (existingUser) {
            return res.status(400).json({ 
                error: 'Ya existe un usuario con ese email o DNI' 
            });
        }
        
        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Crear nuevo usuario
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
            created_at: new Date().toISOString(),
            status: 'active'
        };
        
        users.push(newUser);
        
        // Guardar datos (llamar a saveData del servidor principal)
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        // Crear token JWT
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Remover contraseña de la respuesta
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

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validar campos
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }
        
        // Buscar usuario
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        // Verificar estado del usuario
        if (user.status === 'inactive') {
            return res.status(403).json({ error: 'Usuario inactivo. Contacta al administrador.' });
        }
        
        // Crear token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Actualizar último login
        user.last_login = new Date().toISOString();
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        // Remover contraseña de la respuesta
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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    // En un sistema con base de datos, aquí se invalidaría el token
    res.json({ 
        success: true, 
        message: 'Logout exitoso' 
    });
});

// GET /api/auth/validate-token
router.get('/validate-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ 
            success: true, 
            user: decoded 
        });
    } catch (error) {
        res.status(403).json({ error: 'Token inválido o expirado' });
    }
});

// POST /api/auth/refresh-token
router.post('/refresh-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Crear nuevo token
        const newToken = jwt.sign(
            { id: decoded.id, email: decoded.email, role: decoded.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            success: true, 
            token: newToken 
        });
    } catch (error) {
        res.status(403).json({ error: 'Token inválido' });
    }
});

module.exports = router;