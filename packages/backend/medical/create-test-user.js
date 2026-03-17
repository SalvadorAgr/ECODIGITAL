const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function createTestUser() {
    try {
        // Hash de la contraseña "123456"
        const hashedPassword = await bcrypt.hash('123456', 12);

        const result = await query(`
      INSERT INTO USUARIOS (
        nombre, hash_password, email, id_role, nombre_completo, 
        activo, fecha_creacion, fecha_actualizacion
      ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
      RETURNING id_usuario, nombre, email
    `, ['admin', hashedPassword, 'admin@test.com', 1, 'Usuario Admin']);

        console.log('Usuario de prueba creado:', result.rows[0]);
        console.log('Credenciales:');
        console.log('Usuario: admin');
        console.log('Contraseña: 123456');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createTestUser();