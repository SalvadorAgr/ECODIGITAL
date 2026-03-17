/**
 * EcoDigital - Authentication Middleware
 * JWT token validation and role-based access control for Cloud Run
 */

const jwt = require('jsonwebtoken');
const { query } = require('../db');

/**
 * Middleware to verify JWT token
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acceso requerido',
            code: 401
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is active
        const result = await query(
            'SELECT id_usuario, id_role, nombre, activo FROM USUARIOS WHERE id_usuario = $1 AND activo = TRUE',
            [decoded.id_usuario]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Token inválido o usuario inactivo',
                code: 401
            });
        }

        req.user = {
            id_usuario: decoded.id_usuario,
            id_role: decoded.id_role,
            nombre: result.rows[0].nombre
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado',
                code: 401,
                details: 'Por favor, inicie sesión nuevamente'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token inválido',
                code: 401
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
};

/**
 * Middleware to check user roles
 * @param {Array} allowedRoles - Array of role IDs that can access the route
 */
const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado',
                code: 401
            });
        }

        try {
            // Get user role information
            const result = await query(
                'SELECT r.id_role, r.nombre_role FROM ROLES r WHERE r.id_role = $1',
                [req.user.id_role]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'Rol de usuario no válido',
                    code: 403
                });
            }

            const userRole = result.rows[0];

            if (!allowedRoles.includes(userRole.id_role)) {
                return res.status(403).json({
                    success: false,
                    error: 'Permisos insuficientes para acceder a este recurso',
                    code: 403,
                    details: `Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`
                });
            }

            req.user.role = userRole;
            next();
        } catch (error) {
            console.error('Role check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                code: 500
            });
        }
    };
};

/**
 * Middleware to check specific permissions
 * @param {string} permission - Permission name to check
 */
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado',
                code: 401
            });
        }

        try {
            // Check if user's role has the required permission
            const result = await query(`
                SELECT p.nombre_permiso 
                FROM PERMISOS p
                JOIN ROLES_PERMISOS rp ON p.id_permiso = rp.id_permiso
                WHERE rp.id_role = $1 AND p.nombre_permiso = $2
            `, [req.user.id_role, permission]);

            if (result.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: `Permiso requerido: ${permission}`,
                    code: 403
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                code: 500
            });
        }
    };
};

/**
 * Optional authentication - sets user if token is valid but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next(); // No token, continue without user
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await query(
            'SELECT id_usuario, id_role, nombre FROM USUARIOS WHERE id_usuario = $1 AND activo = TRUE',
            [decoded.id_usuario]
        );

        if (result.rows.length > 0) {
            req.user = {
                id_usuario: decoded.id_usuario,
                id_role: decoded.id_role,
                nombre: result.rows[0].nombre
            };
        }
    } catch (error) {
        // Invalid token, but continue without user
        console.warn('Optional auth failed:', error.message);
    }

    next();
};

module.exports = {
    authenticateToken,
    requireRole,
    requirePermission,
    optionalAuth
};
