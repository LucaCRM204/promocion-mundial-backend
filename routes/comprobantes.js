const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'comprobante-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB límite
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, GIF) y PDF'));
        }
    }
});

// Variables para compartir con server.js
let comprobantes = [];
let premios = [];
let users = [];

// Middleware para inyectar dependencias
router.use((req, res, next) => {
    if (req.app.locals.comprobantes) {
        comprobantes = req.app.locals.comprobantes;
    }
    if (req.app.locals.premios) {
        premios = req.app.locals.premios;
    }
    if (req.app.locals.users) {
        users = req.app.locals.users;
    }
    next();
});

// POST /api/comprobantes/upload
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }
        
        const { cuota_number } = req.body;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }
        
        // Verificar si ya existe un comprobante para esta cuota
        const existingComprobante = comprobantes.find(
            c => c.user_id === userId && c.cuota_number === parseInt(cuota_number)
        );
        
        if (existingComprobante && existingComprobante.status !== 'rejected') {
            // Eliminar archivo subido
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                error: 'Ya existe un comprobante para esta cuota' 
            });
        }
        
        const newComprobante = {
            id: comprobantes.length + 1,
            user_id: userId,
            cuota_number: parseInt(cuota_number),
            file_path: req.file.path,
            file_name: req.file.originalname,
            file_size: req.file.size,
            status: 'pending',
            upload_date: new Date().toISOString()
        };
        
        comprobantes.push(newComprobante);
        
        // Guardar datos
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        res.json({
            success: true,
            comprobante: newComprobante,
            message: 'Comprobante subido exitosamente'
        });
        
    } catch (error) {
        console.error('Error subiendo comprobante:', error);
        
        // Eliminar archivo si hubo error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }
        
        res.status(500).json({ error: 'Error subiendo el archivo' });
    }
});

// GET /api/comprobantes/pending
router.get('/pending', (req, res) => {
    try {
        const userRole = req.user?.role;
        
        if (userRole !== 'validador' && userRole !== 'admin' && userRole !== 'responsable') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const pendingComprobantes = comprobantes.filter(c => c.status === 'pending');
        
        // Agregar información del usuario
        const comprobantesWithUser = pendingComprobantes.map(comprobante => {
            const user = users.find(u => u.id === comprobante.user_id);
            return {
                ...comprobante,
                user: user ? {
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    dni: user.dni,
                    telefono: user.telefono,
                    direccion: user.direccion,
                    localidad: user.localidad,
                    cp: user.cp
                } : null
            };
        });
        
        res.json({
            success: true,
            comprobantes: comprobantesWithUser,
            total: comprobantesWithUser.length
        });
        
    } catch (error) {
        console.error('Error obteniendo comprobantes pendientes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/comprobantes/:id/validate
router.put('/:id/validate', (req, res) => {
    try {
        const userRole = req.user?.role;
        
        if (userRole !== 'validador' && userRole !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const comprobanteId = parseInt(req.params.id);
        const { comments } = req.body;
        
        const comprobante = comprobantes.find(c => c.id === comprobanteId);
        if (!comprobante) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }
        
        // Actualizar comprobante
        comprobante.status = 'validated';
        comprobante.validated_by = req.user.id;
        comprobante.validation_date = new Date().toISOString();
        comprobante.comments = comments || '';
        
        // Crear premio automáticamente
        const newPremio = {
            id: premios.length + 1,
            user_id: comprobante.user_id,
            cuota_number: comprobante.cuota_number,
            status: 'ready',
            created_at: new Date().toISOString()
        };
        
        premios.push(newPremio);
        
        // Guardar datos
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        res.json({
            success: true,
            comprobante,
            premio: newPremio,
            message: 'Comprobante validado exitosamente'
        });
        
    } catch (error) {
        console.error('Error validando comprobante:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/comprobantes/:id/reject
router.put('/:id/reject', (req, res) => {
    try {
        const userRole = req.user?.role;
        
        if (userRole !== 'validador' && userRole !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const comprobanteId = parseInt(req.params.id);
        const { comments } = req.body;
        
        const comprobante = comprobantes.find(c => c.id === comprobanteId);
        if (!comprobante) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }
        
        // Actualizar comprobante
        comprobante.status = 'rejected';
        comprobante.validated_by = req.user.id;
        comprobante.validation_date = new Date().toISOString();
        comprobante.comments = comments || 'Comprobante rechazado';
        
        // Guardar datos
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        res.json({
            success: true,
            comprobante,
            message: 'Comprobante rechazado'
        });
        
    } catch (error) {
        console.error('Error rechazando comprobante:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/comprobantes/user/:userId
router.get('/user/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const requestUserId = req.user?.id;
        const userRole = req.user?.role;
        
        // Verificar permisos
        if (requestUserId !== userId && userRole !== 'admin' && userRole !== 'responsable') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const userComprobantes = comprobantes.filter(c => c.user_id === userId);
        
        res.json({
            success: true,
            comprobantes: userComprobantes
        });
        
    } catch (error) {
        console.error('Error obteniendo comprobantes del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;