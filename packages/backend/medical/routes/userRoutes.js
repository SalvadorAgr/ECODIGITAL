/**
 * EcoDigital - User Management Routes
 * CRUD operations for users and role management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction, utils } = require('../db');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication to all user routes
router.use(authenticateToken);

// === GET ALL USERS ===
// Path: GET /api/v1/users
router.get('/', requirePermission('users.read'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            role_id = '',
            activo = '',
            sort_by = 'fecha_creacion',
            sort_order = 'DESC'
        } = req.query;

        // Build filters
        const filters = {};
        if (search) {
            // For search, we'll use a custom WHERE clause
        }
        if (role_id) filters.id_role = role_id;
        if (activo !== '') filters.activo = activo === 'true';

        // Build WHERE clause
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (search) {
            whereConditions.push(`(
        u.nombre ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex + 1} OR 
        u.nombre_completo ILIKE $${paramIndex + 2}
      )`);
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
            paramIndex += 3;
        }

        Object.entries(filters).forEach(([key, value]) => {
            whereConditions.push(`u.${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        });

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Build ORDER BY clause
        const orderClause = utils.buildOrderClause(`u.${sort_by}`, sort_order);

        // Build pagination
        const offset = (page - 1) * limit;
        const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), offset);

        // Get total count
        const countQuery = `
      SELECT COUNT(*) as total
      FROM USUARIOS u
      ${whereClause}
    `;
        const countResult = await query(countQuery, params.slice(0, paramIndex - 2));
        const total = parseInt(countResult.rows[0].total);

        // Get users
        const usersQuery = `
      SELECT 
        u.id_usuario,
        u.nombre,
        u.email,
        u.nombre_completo,
        u.telefono,
        u.activo,
        u.fecha_creacion,
        u.fecha_actualizacion,
        r.id_role,
        r.nombre_role,
        (SELECT COUNT(*) FROM REFRESH_TOKENS rt WHERE rt.id_usuario = u.id_usuario AND rt.expires_at > NOW()) as sesiones_activas
      FROM USUARIOS u
      JOIN ROLES r ON u.id_role = r.id_role
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

        const result = await query(usersQuery, params);

        res.status(200).json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === GET USER BY ID ===
// Path: GET /api/v1/users/:id
router.get('/:id', requirePermission('users.read'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
      SELECT 
        u.id_usuario,
        u.nombre,
        u.email,
        u.nombre_completo,
        u.telefono,
        u.activo,
        u.fecha_creacion,
        u.fecha_actualizacion,
        r.id_role,
        r.nombre_role,
        (SELECT COUNT(*) FROM REFRESH_TOKENS rt WHERE rt.id_usuario = u.id_usuario AND rt.expires_at > NOW()) as sesiones_activas
      FROM USUARIOS u
      JOIN ROLES r ON u.id_role = r.id_role
      WHERE u.id_usuario = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 404
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === CREATE USER ===
// Path: POST /api/v1/users
router.post('/', requirePermission('users.create'), async (req, res) => {
    try {
        const {
            nombre,
            email,
            password,
            nombre_completo,
            telefono,
            id_role
        } = req.body;

        // Validation
        if (!nombre || !email || !password || !id_role) {
            return res.status(400).json({
                success: false,
                error: 'Nombre, email, contraseña y rol son requeridos',
                code: 400
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'La contraseña debe tener al menos 8 caracteres',
                code: 400
            });
        }

        await transaction(async (client) => {
            // Check if username or email already exists
            const existingUser = await client.query(
                'SELECT id_usuario FROM USUARIOS WHERE nombre = $1 OR email = $2',
                [nombre, email]
            );

            if (existingUser.rows.length > 0) {
                throw new Error('El nombre de usuario o email ya existe');
            }

            // Verify role exists
            const roleCheck = await client.query(
                'SELECT id_role FROM ROLES WHERE id_role = $1',
                [id_role]
            );

            if (roleCheck.rows.length === 0) {
                throw new Error('Rol especificado no válido');
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user
            const result = await client.query(`
        INSERT INTO USUARIOS (
          nombre, hash_password, email, id_role, nombre_completo, telefono,
          activo, fecha_creacion, fecha_actualizacion
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
        RETURNING id_usuario, nombre, email, nombre_completo, id_role
      `, [nombre, hashedPassword, email, id_role, nombre_completo, telefono]);

            const newUser = result.rows[0];

            // Log the creation
            await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
                'USUARIOS',
                newUser.id_usuario,
                'INSERT',
                req.user.id_usuario,
                JSON.stringify({
                    action: 'user_created',
                    created_user: newUser.nombre,
                    created_by: req.user.nombre
                })
            ]);

            res.status(201).json({
                success: true,
                message: 'Usuario creado exitosamente',
                data: {
                    id_usuario: newUser.id_usuario,
                    nombre: newUser.nombre,
                    email: newUser.email,
                    nombre_completo: newUser.nombre_completo,
                    id_role: newUser.id_role
                }
            });
        });

    } catch (error) {
        console.error('Create user error:', error);

        if (error.message.includes('ya existe')) {
            return res.status(409).json({
                success: false,
                error: error.message,
                code: 409
            });
        }

        if (error.message.includes('no válido')) {
            return res.status(400).json({
                success: false,
                error: error.message,
                code: 400
            });
        }

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === UPDATE USER ===
// Path: PUT /api/v1/users/:id
router.put('/:id', requirePermission('users.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            email,
            nombre_completo,
            telefono,
            id_role,
            activo
        } = req.body;

        await transaction(async (client) => {
            // Check if user exists
            const existingUser = await client.query(
                'SELECT * FROM USUARIOS WHERE id_usuario = $1',
                [id]
            );

            if (existingUser.rows.length === 0) {
                throw new Error('Usuario no encontrado');
            }

            const currentUser = existingUser.rows[0];

            // Check if new username/email conflicts with other users
            if (nombre || email) {
                const conflictCheck = await client.query(
                    'SELECT id_usuario FROM USUARIOS WHERE (nombre = $1 OR email = $2) AND id_usuario != $3',
                    [nombre || currentUser.nombre, email || currentUser.email, id]
                );

                if (conflictCheck.rows.length > 0) {
                    throw new Error('El nombre de usuario o email ya existe');
                }
            }

            // Verify role exists if provided
            if (id_role) {
                const roleCheck = await client.query(
                    'SELECT id_role FROM ROLES WHERE id_role = $1',
                    [id_role]
                );

                if (roleCheck.rows.length === 0) {
                    throw new Error('Rol especificado no válido');
                }
            }

            // Build update query
            const updates = [];
            const params = [];
            let paramIndex = 1;

            if (nombre !== undefined) {
                updates.push(`nombre = $${paramIndex++}`);
                params.push(nombre);
            }
            if (email !== undefined) {
                updates.push(`email = $${paramIndex++}`);
                params.push(email);
            }
            if (nombre_completo !== undefined) {
                updates.push(`nombre_completo = $${paramIndex++}`);
                params.push(nombre_completo);
            }
            if (telefono !== undefined) {
                updates.push(`telefono = $${paramIndex++}`);
                params.push(telefono);
            }
            if (id_role !== undefined) {
                updates.push(`id_role = $${paramIndex++}`);
                params.push(id_role);
            }
            if (activo !== undefined) {
                updates.push(`activo = $${paramIndex++}`);
                params.push(activo);
            }

            if (updates.length === 0) {
                throw new Error('No hay campos para actualizar');
            }

            updates.push(`fecha_actualizacion = NOW()`);
            params.push(id);

            const updateQuery = `
        UPDATE USUARIOS 
        SET ${updates.join(', ')}
        WHERE id_usuario = $${paramIndex}
        RETURNING id_usuario, nombre, email, nombre_completo, telefono, id_role, activo
      `;

            const result = await client.query(updateQuery, params);
            const updatedUser = result.rows[0];

            // Log the update
            await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
                'USUARIOS',
                id,
                'UPDATE',
                req.user.id_usuario,
                JSON.stringify({
                    action: 'user_updated',
                    updated_user: updatedUser.nombre,
                    updated_by: req.user.nombre,
                    changes: req.body
                })
            ]);

            res.status(200).json({
                success: true,
                message: 'Usuario actualizado exitosamente',
                data: updatedUser
            });
        });

    } catch (error) {
        console.error('Update user error:', error);

        if (error.message.includes('no encontrado')) {
            return res.status(404).json({
                success: false,
                error: error.message,
                code: 404
            });
        }

        if (error.message.includes('ya existe') || error.message.includes('no válido') || error.message.includes('No hay campos')) {
            return res.status(400).json({
                success: false,
                error: error.message,
                code: 400
            });
        }

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === DELETE USER (Soft Delete) ===
// Path: DELETE /api/v1/users/:id
router.delete('/:id', requirePermission('users.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (parseInt(id) === req.user.id_usuario) {
            return res.status(400).json({
                success: false,
                error: 'No puedes eliminar tu propia cuenta',
                code: 400
            });
        }

        await transaction(async (client) => {
            // Check if user exists
            const existingUser = await client.query(
                'SELECT nombre FROM USUARIOS WHERE id_usuario = $1 AND activo = TRUE',
                [id]
            );

            if (existingUser.rows.length === 0) {
                throw new Error('Usuario no encontrado o ya está inactivo');
            }

            const userName = existingUser.rows[0].nombre;

            // Soft delete user
            await client.query(
                'UPDATE USUARIOS SET activo = FALSE, fecha_actualizacion = NOW() WHERE id_usuario = $1',
                [id]
            );

            // Invalidate all refresh tokens for this user
            await client.query(
                'DELETE FROM REFRESH_TOKENS WHERE id_usuario = $1',
                [id]
            );

            // Log the deletion
            await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
                'USUARIOS',
                id,
                'DELETE',
                req.user.id_usuario,
                JSON.stringify({
                    action: 'user_deleted',
                    deleted_user: userName,
                    deleted_by: req.user.nombre
                })
            ]);

            res.status(200).json({
                success: true,
                message: 'Usuario eliminado exitosamente'
            });
        });

    } catch (error) {
        console.error('Delete user error:', error);

        if (error.message.includes('no encontrado')) {
            return res.status(404).json({
                success: false,
                error: error.message,
                code: 404
            });
        }

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === CHANGE USER PASSWORD ===
// Path: PUT /api/v1/users/:id/password
router.put('/:id/password', requirePermission('users.update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password, current_password } = req.body;

        if (!new_password) {
            return res.status(400).json({
                success: false,
                error: 'Nueva contraseña requerida',
                code: 400
            });
        }

        if (new_password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'La contraseña debe tener al menos 8 caracteres',
                code: 400
            });
        }

        // If changing own password, require current password
        if (parseInt(id) === req.user.id_usuario && !current_password) {
            return res.status(400).json({
                success: false,
                error: 'Contraseña actual requerida para cambiar tu propia contraseña',
                code: 400
            });
        }

        await transaction(async (client) => {
            // Get user
            const userResult = await client.query(
                'SELECT nombre, hash_password FROM USUARIOS WHERE id_usuario = $1 AND activo = TRUE',
                [id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Usuario no encontrado');
            }

            const user = userResult.rows[0];

            // Verify current password if changing own password
            if (parseInt(id) === req.user.id_usuario) {
                const isCurrentPasswordValid = await bcrypt.compare(current_password, user.hash_password);
                if (!isCurrentPasswordValid) {
                    throw new Error('Contraseña actual incorrecta');
                }
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(new_password, saltRounds);

            // Update password
            await client.query(
                'UPDATE USUARIOS SET hash_password = $1, fecha_actualizacion = NOW() WHERE id_usuario = $2',
                [hashedPassword, id]
            );

            // Invalidate all refresh tokens for this user (force re-login)
            await client.query(
                'DELETE FROM REFRESH_TOKENS WHERE id_usuario = $1',
                [id]
            );

            // Log password change
            await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
                'USUARIOS',
                id,
                'PASSWORD_CHANGE',
                req.user.id_usuario,
                JSON.stringify({
                    action: 'password_changed',
                    target_user: user.nombre,
                    changed_by: req.user.nombre
                })
            ]);

            res.status(200).json({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            });
        });

    } catch (error) {
        console.error('Change password error:', error);

        if (error.message.includes('no encontrado') || error.message.includes('incorrecta')) {
            return res.status(400).json({
                success: false,
                error: error.message,
                code: 400
            });
        }

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === GET ALL ROLES ===
// Path: GET /api/v1/users/roles
router.get('/roles/list', requirePermission('users.read'), async (req, res) => {
    try {
        const result = await query(`
      SELECT 
        r.id_role,
        r.nombre_role,
        r.descripcion,
        r.nivel_acceso,
        r.activo,
        COUNT(u.id_usuario) as usuarios_count
      FROM ROLES r
      LEFT JOIN USUARIOS u ON r.id_role = u.id_role AND u.activo = TRUE
      WHERE r.activo = TRUE
      GROUP BY r.id_role, r.nombre_role, r.descripcion, r.nivel_acceso, r.activo
      ORDER BY r.id_role
    `);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

// === ASSIGN ROLE TO USER ===
// Path: PUT /api/v1/users/:id/role
router.put('/:id/role', requireRole([1]), async (req, res) => { // Only admin principal
    try {
        const { id } = req.params;
        const { id_role } = req.body;

        if (!id_role) {
            return res.status(400).json({
                success: false,
                error: 'ID de rol requerido',
                code: 400
            });
        }

        await transaction(async (client) => {
            // Check if user exists
            const userResult = await client.query(
                'SELECT nombre, id_role as current_role FROM USUARIOS WHERE id_usuario = $1 AND activo = TRUE',
                [id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Usuario no encontrado');
            }

            const user = userResult.rows[0];

            // Check if role exists
            const roleResult = await client.query(
                'SELECT nombre_role FROM ROLES WHERE id_role = $1 AND activo = TRUE',
                [id_role]
            );

            if (roleResult.rows.length === 0) {
                throw new Error('Rol no encontrado');
            }

            const role = roleResult.rows[0];

            // Update user role
            await client.query(
                'UPDATE USUARIOS SET id_role = $1, fecha_actualizacion = NOW() WHERE id_usuario = $2',
                [id_role, id]
            );

            // Invalidate all refresh tokens for this user (force re-login with new permissions)
            await client.query(
                'DELETE FROM REFRESH_TOKENS WHERE id_usuario = $1',
                [id]
            );

            // Log role assignment
            await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
                'USUARIOS',
                id,
                'ROLE_ASSIGNMENT',
                req.user.id_usuario,
                JSON.stringify({
                    action: 'role_assigned',
                    target_user: user.nombre,
                    old_role: user.current_role,
                    new_role: id_role,
                    new_role_name: role.nombre_role,
                    assigned_by: req.user.nombre
                })
            ]);

            res.status(200).json({
                success: true,
                message: `Rol ${role.nombre_role} asignado exitosamente a ${user.nombre}`
            });
        });

    } catch (error) {
        console.error('Assign role error:', error);

        if (error.message.includes('no encontrado')) {
            return res.status(404).json({
                success: false,
                error: error.message,
                code: 404
            });
        }

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 500
        });
    }
});

module.exports = router;