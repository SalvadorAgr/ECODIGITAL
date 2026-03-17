/**
 * Enhanced Appointment Routes
 * Integrates new Python services with existing appointment functionality
 */

const express = require('express');
const { getPool, utils } = require('../db');
const integrationService = require('../services/integrationService');
const enhancedErrorHandler = require('../middleware/enhancedErrorHandler');

const router = express.Router();

// Middleware to verify database connection is ready
router.use((req, res, next) => {
    const pool = getPool();
    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Service unavailable, database not connected.'
        });
    }
    next();
});

// GET /api/v1/appointments/enhanced/:id - Get enhanced appointment with priority and resource info
router.get('/enhanced/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    try {
        const enhancedData = await integrationService.getEnhancedAppointmentData(parseInt(id));

        if (!enhancedData) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        res.status(200).json({
            success: true,
            data: enhancedData,
            message: 'Enhanced appointment data retrieved successfully'
        });

    } catch (error) {
        console.error(`Error getting enhanced appointment ${id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/appointments/enhanced - Create appointment with advanced features
router.post('/enhanced', async (req, res, next) => {
    const {
        id_paciente,
        medico_id,
        fecha_hora,
        duracion_minutos = 30,
        tipo_cita,
        especialidad,
        motivo,
        observaciones,
        prioridad = 'NORMAL',
        es_urgente = false,
        motivo_urgencia,
        telefono_contacto,
        email_contacto,
        costo_consulta,
        seguro_medico,
        copago,
        sala_consulta,
        equipos_necesarios,
        preparacion_especial,
        recursos = [] // Array of resource requirements
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!id_paciente || isNaN(parseInt(id_paciente))) {
        errors.push('Valid patient ID is required');
    }
    if (!medico_id || isNaN(parseInt(medico_id))) {
        errors.push('Valid doctor ID is required');
    }
    if (!fecha_hora) {
        errors.push('Appointment date and time is required');
    }
    if (!tipo_cita) {
        errors.push('Appointment type is required');
    }
    if (!motivo || motivo.trim().length < 5) {
        errors.push('Reason for appointment is required and must be at least 5 characters');
    }

    // Validate appointment type
    const validTypes = ['CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'];
    if (tipo_cita && !validTypes.includes(tipo_cita)) {
        errors.push('Invalid appointment type');
    }

    // Validate priority
    const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];
    if (prioridad && !validPriorities.includes(prioridad)) {
        errors.push('Invalid priority level');
    }

    // Validate date is in the future
    if (fecha_hora && new Date(fecha_hora) <= new Date()) {
        errors.push('Appointment date must be in the future');
    }

    if (errors.length > 0) {
        return next(enhancedErrorHandler.validationError(errors));
    }

    try {
        const pool = getPool();

        // Check if patient exists and is active
        const { rows: patientRows } = await pool.query(
            'SELECT id, nombre, apellido, activo FROM PACIENTES WHERE id = $1',
            [id_paciente]
        );

        if (patientRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        if (!patientRows[0].activo) {
            return res.status(400).json({
                success: false,
                error: 'Patient is inactive'
            });
        }

        // Check if doctor exists and is active
        const { rows: doctorRows } = await pool.query(
            'SELECT id, nombres, apellidos, activo, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\')',
            [medico_id]
        );

        if (doctorRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor not found or not authorized'
            });
        }

        if (!doctorRows[0].activo) {
            return res.status(400).json({
                success: false,
                error: 'Doctor is inactive'
            });
        }

        // Get user ID from auth middleware (if available)
        const userId = req.user?.id || 1; // Default to system user if no auth

        // Create enhanced appointment using integration service
        const appointmentData = {
            id_paciente,
            medico_id,
            fecha_hora,
            duracion_minutos,
            tipo_cita,
            especialidad,
            motivo,
            observaciones,
            prioridad,
            es_urgente,
            motivo_urgencia,
            telefono_contacto,
            email_contacto,
            costo_consulta,
            seguro_medico,
            copago,
            sala_consulta,
            equipos_necesarios,
            preparacion_especial,
            recursos
        };

        // Create enhanced appointment with timeout
        const timeoutMs = 4000;
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
        });

        const result = await Promise.race([
            integrationService.createEnhancedAppointment(appointmentData, userId),
            timeoutPromise
        ]);

        // Get the complete appointment information for response
        const enhancedData = await integrationService.getEnhancedAppointmentData(result.appointmentId);

        res.status(201).json({
            success: true,
            data: enhancedData,
            message: 'Enhanced appointment created successfully',
            priority_score: result.priorityScore
        });

    } catch (error) {
        console.error('Error creating enhanced appointment:', error);

        // Handle specific integration errors
        if (error.message.includes('Resource') && error.message.includes('not available')) {
            return next(enhancedErrorHandler.resourceConflictError([], error.message));
        }

        if (error.message.includes('schedule exceptions')) {
            return next(enhancedErrorHandler.scheduleConflictError([], error.message));
        }

        next(error);
    }
});

// PUT /api/v1/appointments/enhanced/:id - Update appointment with advanced conflict detection
router.put('/enhanced/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    const updates = req.body;

    // Enhanced validation for updates
    const errors = [];
    if (updates.fecha_hora && new Date(updates.fecha_hora) <= new Date()) {
        errors.push('Appointment date must be in the future');
    }
    if (updates.tipo_cita) {
        const validTypes = ['CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'];
        if (!validTypes.includes(updates.tipo_cita)) {
            errors.push('Invalid appointment type');
        }
    }
    if (updates.estado) {
        const validStates = ['PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'];
        if (!validStates.includes(updates.estado)) {
            errors.push('Invalid appointment state');
        }
    }
    if (updates.prioridad) {
        const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];
        if (!validPriorities.includes(updates.prioridad)) {
            errors.push('Invalid priority level');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors
        });
    }

    try {
        const userId = req.user?.id || 1; // Default to system user if no auth

        const result = await integrationService.updateEnhancedAppointment(
            parseInt(id),
            updates,
            userId
        );

        // Get the updated appointment information
        const enhancedData = await integrationService.getEnhancedAppointmentData(parseInt(id));

        res.status(200).json({
            success: true,
            data: enhancedData,
            message: 'Enhanced appointment updated successfully',
            priority_score: result.priorityScore
        });

    } catch (error) {
        console.error(`Error updating enhanced appointment ${id}:`, error);

        // Handle specific integration errors
        if (error.message.includes('Resource conflicts')) {
            return res.status(409).json({
                success: false,
                error: 'Resource conflict detected',
                details: error.message
            });
        }

        if (error.message.includes('schedule exceptions')) {
            return res.status(409).json({
                success: false,
                error: 'Schedule conflict detected',
                details: error.message
            });
        }

        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/priority-ordered - Get appointments ordered by priority
router.get('/priority-ordered', async (req, res) => {
    try {
        const {
            medico_id,
            fecha_desde,
            fecha_hasta,
            estados,
            limit = 100
        } = req.query;

        const filters = {};

        if (medico_id) filters.medico_id = parseInt(medico_id);
        if (fecha_desde) filters.fecha_desde = fecha_desde;
        if (fecha_hasta) filters.fecha_hasta = fecha_hasta;
        if (estados) filters.estados = estados.split(',');
        if (limit) filters.limit = parseInt(limit);

        const appointments = await integrationService.getPriorityOrderedAppointments(filters);

        res.status(200).json({
            success: true,
            data: appointments,
            message: `Found ${appointments.length} priority-ordered appointments`
        });

    } catch (error) {
        console.error('Error getting priority-ordered appointments:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/appointments/:id/assign-priority - Assign priority to appointment
router.post('/:id/assign-priority', async (req, res) => {
    const { id } = req.params;
    const {
        prioridad,
        motivo,
        es_urgente = false,
        motivo_urgencia
    } = req.body;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    if (!prioridad) {
        return res.status(400).json({
            success: false,
            error: 'Priority level is required'
        });
    }

    const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];
    if (!validPriorities.includes(prioridad)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid priority level'
        });
    }

    try {
        const userId = req.user?.id || 1;

        const success = await integrationService.assignAppointmentPriority(
            parseInt(id),
            prioridad,
            userId,
            motivo,
            es_urgente,
            motivo_urgencia
        );

        if (success) {
            // Get updated appointment data
            const enhancedData = await integrationService.getEnhancedAppointmentData(parseInt(id));

            res.status(200).json({
                success: true,
                data: enhancedData,
                message: 'Priority assigned successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Appointment not found or could not be updated'
            });
        }

    } catch (error) {
        console.error(`Error assigning priority to appointment ${id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/:id/check-conflicts - Check for scheduling conflicts
router.get('/:id/check-conflicts', async (req, res) => {
    const { id } = req.params;
    const { fecha_hora, duracion_minutos } = req.query;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    try {
        const pool = getPool();

        // Get current appointment data
        const { rows } = await pool.query(
            'SELECT * FROM CITAS WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const appointment = rows[0];
        const checkStartTime = fecha_hora || appointment.fecha_hora;
        const checkDuration = duracion_minutos || appointment.duracion_minutos;
        const checkEndTime = new Date(new Date(checkStartTime).getTime() + (checkDuration * 60000));

        const conflicts = {
            schedule_exceptions: [],
            resource_conflicts: [],
            has_conflicts: false
        };

        // Check schedule exceptions
        const exceptions = await integrationService.checkScheduleExceptions(
            appointment.medico_id,
            checkStartTime,
            checkEndTime
        );
        conflicts.schedule_exceptions = exceptions;

        // Check resource conflicts if appointment has resources
        if (appointment.equipos_necesarios) {
            try {
                const recursos = JSON.parse(appointment.equipos_necesarios);
                for (const resource of recursos) {
                    const resourceConflicts = await integrationService.getResourceConflicts(
                        resource.id,
                        checkStartTime,
                        checkEndTime,
                        parseInt(id)
                    );
                    conflicts.resource_conflicts.push(...resourceConflicts);
                }
            } catch (parseError) {
                console.warn('Could not parse equipment data for conflict checking');
            }
        }

        conflicts.has_conflicts = conflicts.schedule_exceptions.length > 0 ||
            conflicts.resource_conflicts.length > 0;

        res.status(200).json({
            success: true,
            data: conflicts,
            message: conflicts.has_conflicts ? 'Conflicts detected' : 'No conflicts found'
        });

    } catch (error) {
        console.error(`Error checking conflicts for appointment ${id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/integration/health - Health check for integration services
router.get('/integration/health', async (req, res) => {
    try {
        const healthStatus = await integrationService.healthCheck();

        const allHealthy = Object.values(healthStatus).every(status => status === 'healthy');

        res.status(allHealthy ? 200 : 503).json({
            success: allHealthy,
            data: healthStatus,
            message: allHealthy ? 'All integration services are healthy' : 'Some integration services are unhealthy'
        });

    } catch (error) {
        console.error('Error checking integration health:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;