const express = require('express');
const router = express.Router();

// Variables compartidas
let users = [];
let comprobantes = [];
let premios = [];

// Middleware para inyectar dependencias
router.use((req, res, next) => {
    if (req.app.locals.users) users = req.app.locals.users;
    if (req.app.locals.comprobantes) comprobantes = req.app.locals.comprobantes;
    if (req.app.locals.premios) premios = req.app.locals.premios;
    next();
});

// Middleware para verificar rol de admin
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'responsable') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
};

// GET /api/admin/stats - Estadísticas generales
router.get('/stats', requireAdmin, (req, res) => {
    try {
        const stats = {
            total_users: users.length,
            active_users: users.filter(u => u.status === 'active').length,
            inactive_users: users.filter(u => u.status === 'inactive').length,
            
            total_comprobantes: comprobantes.length,
            pending_validations: comprobantes.filter(c => c.status === 'pending').length,
            validated_comprobantes: comprobantes.filter(c => c.status === 'validated').length,
            rejected_comprobantes: comprobantes.filter(c => c.status === 'rejected').length,
            
            total_premios: premios.length,
            ready_premios: premios.filter(p => p.status === 'ready').length,
            claimed_premios: premios.filter(p => p.status === 'claimed').length,
            dispatched_premios: premios.filter(p => p.status === 'dispatched').length,
            delivered_premios: premios.filter(p => p.status === 'delivered').length
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

// GET /api/admin/users - Obtener todos los usuarios
router.get('/users', requireAdmin, (req, res) => {
    try {
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            
            // Agregar estadísticas del usuario
            const userComprobantes = comprobantes.filter(c => c.user_id === user.id);
            const userPremios = premios.filter(p => p.user_id === user.id);
            
            return {
                ...userWithoutPassword,
                comprobantes_count: userComprobantes.length,
                comprobantes_pending: userComprobantes.filter(c => c.status === 'pending').length,
                comprobantes_validated: userComprobantes.filter(c => c.status === 'validated').length,
                premios_count: userPremios.length
            };
        });
        
        res.json({
            success: true,
            users: usersWithoutPasswords,
            total: usersWithoutPasswords.length
        });
        
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/admin/users/:id - Obtener usuario específico
router.get('/users/:id', requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const { password, ...userWithoutPassword } = user;
        
        // Agregar comprobantes y premios del usuario
        const userComprobantes = comprobantes.filter(c => c.user_id === userId);
        const userPremios = premios.filter(p => p.user_id === userId);
        
        res.json({
            success: true,
            user: {
                ...userWithoutPassword,
                comprobantes: userComprobantes,
                premios: userPremios
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/admin/users/:id - Actualizar usuario
router.put('/users/:id', requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Actualizar campos permitidos
        const allowedFields = ['nombre', 'apellido', 'telefono', 'plan', 'direccion', 'localidad', 'cp', 'status'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });
        
        user.updated_at = new Date().toISOString();
        
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        const { password, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            user: userWithoutPassword,
            message: 'Usuario actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/admin/users/:id - Eliminar usuario (soft delete)
router.delete('/users/:id', requireAdmin, (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden eliminar usuarios' });
        }
        
        const userId = parseInt(req.params.id);
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Soft delete - cambiar estado a inactivo
        user.status = 'inactive';
        user.deleted_at = new Date().toISOString();
        
        if (req.app.locals.saveData) {
            req.app.locals.saveData();
        }
        
        res.json({
            success: true,
            message: 'Usuario desactivado exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/admin/comprobantes - Todos los comprobantes
router.get('/comprobantes', requireAdmin, (req, res) => {
    try {
        const { status, from_date, to_date } = req.query;
        
        let filtered = [...comprobantes];
        
        // Filtrar por estado
        if (status) {
            filtered = filtered.filter(c => c.status === status);
        }
        
        // Filtrar por fecha
        if (from_date) {
            filtered = filtered.filter(c => new Date(c.upload_date) >= new Date(from_date));
        }
        if (to_date) {
            filtered = filtered.filter(c => new Date(c.upload_date) <= new Date(to_date));
        }
        
        // Agregar información del usuario
        const comprobantesWithUser = filtered.map(comprobante => {
            const user = users.find(u => u.id === comprobante.user_id);
            return {
                ...comprobante,
                user: user ? {
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    dni: user.dni
                } : null
            };
        });
        
        res.json({
            success: true,
            comprobantes: comprobantesWithUser,
            total: comprobantesWithUser.length
        });
        
    } catch (error) {
        console.error('Error obteniendo comprobantes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/admin/premios - Todos los premios
router.get('/premios', requireAdmin, (req, res) => {
    try {
        const { status } = req.query;
        
        let filtered = [...premios];
        
        if (status) {
            filtered = filtered.filter(p => p.status === status);
        }
        
        // Agregar información del usuario
        const premiosWithUser = filtered.map(premio => {
            const user = users.find(u => u.id === premio.user_id);
            return {
                ...premio,
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
            premios: premiosWithUser,
            total: premiosWithUser.length
        });
        
    } catch (error) {
        console.error('Error obteniendo premios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/admin/reports - Generar reporte
router.post('/reports', requireAdmin, (req, res) => {
    try {
        const { report_type, from_date, to_date } = req.body;
        
        let reportData = {};
        
        switch(report_type) {
            case 'validaciones':
                reportData = {
                    total: comprobantes.length,
                    pending: comprobantes.filter(c => c.status === 'pending').length,
                    validated: comprobantes.filter(c => c.status === 'validated').length,
                    rejected: comprobantes.filter(c => c.status === 'rejected').length
                };
                break;
                
            case 'premios':
                reportData = {
                    total: premios.length,
                    ready: premios.filter(p => p.status === 'ready').length,
                    claimed: premios.filter(p => p.status === 'claimed').length,
                    dispatched: premios.filter(p => p.status === 'dispatched').length,
                    delivered: premios.filter(p => p.status === 'delivered').length
                };
                break;
                
            case 'usuarios':
                reportData = {
                    total: users.length,
                    active: users.filter(u => u.status === 'active').length,
                    inactive: users.filter(u => u.status === 'inactive').length
                };
                break;
                
            default:
                return res.status(400).json({ error: 'Tipo de reporte no válido' });
        }
        
        res.json({
            success: true,
            report: {
                type: report_type,
                generated_at: new Date().toISOString(),
                data: reportData
            }
        });
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;