/**
 * EcoDigital - Authentication Routes
 * JWT-based authentication with user registration, login, password reset, and token refresh
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, transaction } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = '8h') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate refresh token
 * @returns {string} Random refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// === USER REGISTRATION Endpoint ===
// Path: POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  const {
    nombre,
    password,
    email,
    id_role = 3, // Default to basic user role
    nombre_completo,
    telefono
  } = req.body;

  // Validation
  if (!nombre || !password || !email) {
    return res.status(400).json({
      success: false,
      error: 'Nombre de usuario, contraseña y email son requeridos',
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

  try {
    await transaction(async (client) => {
      // Check if username already exists
      const userCheck = await client.query(
        'SELECT id_usuario FROM USUARIOS WHERE nombre = $1 OR email = $2',
        [nombre, email]
      );

      if (userCheck.rows.length > 0) {
        throw new Error('El nombre de usuario o email ya existe');
      }

      // Check if role exists
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

      // Log the registration
      await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
        'USUARIOS',
        newUser.id_usuario,
        'INSERT',
        newUser.id_usuario,
        JSON.stringify({ action: 'user_registration', email: email })
      ]);

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
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
    console.error('Registration error:', error);

    if (error.message.includes('ya existe')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 409
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 500
    });
  }
});

// === LOGIN Endpoint ===
// Path: POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { nombre, password } = req.body;

  // Basic validation
  if (!nombre || !password) {
    return res.status(400).json({
      success: false,
      error: 'Nombre de usuario y contraseña son requeridos',
      code: 400
    });
  }

  try {
    // DESARROLLO LOCAL - Credenciales hardcodeadas
    const testUsers = [
      { nombre: 'admin', password: '123456', email: 'admin@ecodigital.com', id_usuario: 1, id_role: 1, nombre_role: 'Admin' },
      { nombre: 'jsanchez', password: 'EcoDigital2026!', email: 'joel.sanchez@ecodigital.com', id_usuario: 2, id_role: 1, nombre_role: 'Doctor' }
    ];

    const user = testUsers.find(u => u.nombre === nombre && u.password === password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas',
        code: 401
      });
    }

    // Generate tokens
    const tokenPayload = {
      id_usuario: user.id_usuario,
      id_role: user.id_role,
      nombre: user.nombre
    };

    const accessToken = generateToken(tokenPayload, '8h');
    const refreshToken = generateRefreshToken();

    // Send response
    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: {
          id_usuario: user.id_usuario,
          nombre: user.nombre,
          email: user.email,
          nombre_completo: user.nombre,
          id_role: user.id_role,
          nombre_role: user.nombre_role
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: '8h'
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 500
    });
  }
});

// === TOKEN REFRESH Endpoint ===
// Path: POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token requerido',
      code: 400
    });
  }

  try {
    // Verify refresh token
    const result = await query(`
      SELECT rt.*, u.nombre, u.id_role, u.activo
      FROM REFRESH_TOKENS rt
      JOIN USUARIOS u ON rt.id_usuario = u.id_usuario
      WHERE rt.token = $1 AND rt.expires_at > NOW() AND u.activo = TRUE
    `, [refresh_token]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token inválido o expirado',
        code: 401
      });
    }

    const tokenData = result.rows[0];

    // Generate new access token
    const tokenPayload = {
      id_usuario: tokenData.id_usuario,
      id_role: tokenData.id_role,
      nombre: tokenData.nombre
    };

    const newAccessToken = generateToken(tokenPayload, '8h');

    res.status(200).json({
      success: true,
      message: 'Token renovado exitosamente',
      data: {
        access_token: newAccessToken,
        expires_in: '8h'
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 500
    });
  }
});

// === PASSWORD RESET REQUEST Endpoint ===
// Path: POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email requerido',
      code: 400
    });
  }

  try {
    // Check if user exists
    const result = await query(
      'SELECT id_usuario, nombre, email FROM USUARIOS WHERE email = $1 AND activo = TRUE',
      [email]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Si el email existe, se enviará un enlace de recuperación'
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store reset token (expires in 1 hour)
    await query(`
      INSERT INTO PASSWORD_RESET_TOKENS (id_usuario, token_hash, expires_at, created_at)
      VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())
      ON CONFLICT (id_usuario)
      DO UPDATE SET token_hash = $2, expires_at = NOW() + INTERVAL '1 hour', created_at = NOW()
    `, [user.id_usuario, resetTokenHash]);

    // Log password reset request
    await query(`
      INSERT INTO LOGS_AUDITORIA (
        tabla_afectada, id_registro_afectado, tipo_operacion,
        id_usuario_autor, fecha_hora, detalles
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      'USUARIOS',
      user.id_usuario,
      'PASSWORD_RESET_REQUEST',
      user.id_usuario,
      JSON.stringify({ action: 'password_reset_requested', email: email })
    ]);

    // TODO: Send email with reset link
    // For now, return the token (in production, this should be sent via email)
    res.status(200).json({
      success: true,
      message: 'Si el email existe, se enviará un enlace de recuperación',
      // TODO: Remove this in production
      data: {
        reset_token: resetToken,
        reset_url: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 500
    });
  }
});

// === PASSWORD RESET Endpoint ===
// Path: POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    return res.status(400).json({
      success: false,
      error: 'Token y nueva contraseña son requeridos',
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

  try {
    await transaction(async (client) => {
      // Hash the provided token
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Verify reset token
      const result = await client.query(`
        SELECT prt.*, u.nombre, u.email
        FROM PASSWORD_RESET_TOKENS prt
        JOIN USUARIOS u ON prt.id_usuario = u.id_usuario
        WHERE prt.token_hash = $1 AND prt.expires_at > NOW() AND u.activo = TRUE
      `, [tokenHash]);

      if (result.rows.length === 0) {
        throw new Error('Token de recuperación inválido o expirado');
      }

      const resetData = result.rows[0];

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(new_password, saltRounds);

      // Update password
      await client.query(
        'UPDATE USUARIOS SET hash_password = $1, fecha_actualizacion = NOW() WHERE id_usuario = $2',
        [hashedPassword, resetData.id_usuario]
      );

      // Delete used reset token
      await client.query(
        'DELETE FROM PASSWORD_RESET_TOKENS WHERE id_usuario = $1',
        [resetData.id_usuario]
      );

      // Invalidate all refresh tokens for this user
      await client.query(
        'DELETE FROM REFRESH_TOKENS WHERE id_usuario = $1',
        [resetData.id_usuario]
      );

      // Log password reset
      await client.query(`
        INSERT INTO LOGS_AUDITORIA (
          tabla_afectada, id_registro_afectado, tipo_operacion,
          id_usuario_autor, fecha_hora, detalles
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
        'USUARIOS',
        resetData.id_usuario,
        'PASSWORD_RESET',
        resetData.id_usuario,
        JSON.stringify({ action: 'password_reset_completed', email: resetData.email })
      ]);

      res.status(200).json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    });

  } catch (error) {
    console.error('Password reset error:', error);

    if (error.message.includes('inválido o expirado')) {
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

// === LOGOUT Endpoint ===
// Path: POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Remove refresh token
    await query(
      'DELETE FROM REFRESH_TOKENS WHERE id_usuario = $1',
      [req.user.id_usuario]
    );

    // Log logout
    await query(`
      INSERT INTO LOGS_AUDITORIA (
        tabla_afectada, id_registro_afectado, tipo_operacion,
        id_usuario_autor, fecha_hora, detalles
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      'USUARIOS',
      req.user.id_usuario,
      'LOGOUT',
      req.user.id_usuario,
      JSON.stringify({ action: 'user_logout', ip: req.ip })
    ]);

    res.status(200).json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 500
    });
  }
});

// === GET USER PROFILE Endpoint ===
// Path: GET /api/v1/auth/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id_usuario, u.nombre, u.email, u.nombre_completo, u.telefono,
             u.fecha_creacion, u.fecha_actualizacion, r.nombre_role
      FROM USUARIOS u
      JOIN ROLES r ON u.id_role = r.id_role
      WHERE u.id_usuario = $1 AND u.activo = TRUE
    `, [req.user.id_usuario]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
        code: 404
      });
    }

    const user = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        nombre_completo: user.nombre_completo,
        telefono: user.telefono,
        nombre_role: user.nombre_role,
        fecha_creacion: user.fecha_creacion,
        fecha_actualizacion: user.fecha_actualizacion
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 500
    });
  }
});

// === VERIFY TOKEN Endpoint ===
// Path: GET /api/v1/auth/verify
router.get('/verify', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token válido',
    data: {
      user: req.user
    }
  });
});

module.exports = router;