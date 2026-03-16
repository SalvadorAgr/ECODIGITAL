const express = require('express');
const { getPool, utils } = require('../db');

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

// GET /api/v1/appointments/calendar/availability/:medico_id - Check doctor availability
router.get('/availability/:medico_id', async (req, res) => {
    const { medico_id } = req.params;
    const { fecha, duracion_minutos = 30 } = req.query;

    // Validate parameters
    if (!medico_id || isNaN(parseInt(medico_id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid doctor ID provided'
        });
    }

    if (!fecha) {
        return res.status(400).json({
            success: false,
            error: 'Date parameter is required'
        });
    }

    try {
        const pool = getPool();

        // Check if doctor exists and is active
        const doctorCheck = await pool.query(
            'SELECT id, nombres, apellidos, activo, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\')',
            [medico_id]
        );

        if (doctorCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor not found or not authorized'
            });
        }

        if (!doctorCheck.rows[0].activo) {
            return res.status(400).json({
                success: false,
                error: 'Doctor is inactive'
            });
        }

        const doctor = doctorCheck.rows[0];

        // Get doctor's schedule for the specified date
        const dayOfWeek = new Date(fecha).getDay() || 7; // Convert Sunday (0) to 7

        const scheduleQuery = `
            SELECT 
                hora_inicio,
                hora_fin,
                duracion_cita_minutos,
                pausas
            FROM HORARIOS_MEDICOS
            WHERE medico_id = $1
            AND dia_semana = $2
            AND activo = TRUE
            AND fecha_inicio_vigencia <= $3
            AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= $3)
        `;

        const { rows: scheduleRows } = await pool.query(scheduleQuery, [medico_id, dayOfWeek, fecha]);

        if (scheduleRows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    doctor: `${doctor.nombres} ${doctor.apellidos}`,
                    fecha,
                    available: false,
                    reason: 'Doctor does not work on this day',
                    slots: []
                }
            });
        }

        const schedule = scheduleRows[0];

        // Check for schedule exceptions
        const exceptionQuery = `
            SELECT 
                tipo_excepcion,
                motivo,
                hora_inicio_especial,
                hora_fin_especial
            FROM EXCEPCIONES_HORARIO
            WHERE medico_id = $1
            AND fecha = $2
            AND activo = TRUE
        `;

        const { rows: exceptionRows } = await pool.query(exceptionQuery, [medico_id, fecha]);

        if (exceptionRows.length > 0) {
            const exception = exceptionRows[0];
            if (exception.tipo_excepcion === 'NO_DISPONIBLE') {
                return res.status(200).json({
                    success: true,
                    data: {
                        doctor: `${doctor.nombres} ${doctor.apellidos}`,
                        fecha,
                        available: false,
                        reason: exception.motivo || 'Doctor is not available on this date',
                        slots: []
                    }
                });
            }

            // If it's a special schedule, use the exception hours
            if (exception.tipo_excepcion === 'HORARIO_ESPECIAL' && exception.hora_inicio_especial && exception.hora_fin_especial) {
                schedule.hora_inicio = exception.hora_inicio_especial;
                schedule.hora_fin = exception.hora_fin_especial;
            }
        }

        // Get existing appointments for the date
        const appointmentsQuery = `
            SELECT 
                fecha_hora,
                duracion_minutos,
                estado
            FROM CITAS
            WHERE medico_id = $1
            AND DATE(fecha_hora) = $2
            AND activo = TRUE
            AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            ORDER BY fecha_hora
        `;

        const { rows: appointments } = await pool.query(appointmentsQuery, [medico_id, fecha]);

        // Generate available time slots
        const slots = generateAvailableSlots(
            schedule.hora_inicio,
            schedule.hora_fin,
            parseInt(duracion_minutos),
            schedule.pausas,
            appointments,
            fecha
        );

        res.status(200).json({
            success: true,
            data: {
                doctor: `${doctor.nombres} ${doctor.apellidos}`,
                especialidad: doctor.especialidad,
                fecha,
                available: slots.length > 0,
                totalSlots: slots.length,
                slots,
                schedule: {
                    hora_inicio: schedule.hora_inicio,
                    hora_fin: schedule.hora_fin,
                    duracion_cita_default: schedule.duracion_cita_minutos
                },
                existingAppointments: appointments.length
            }
        });

    } catch (err) {
        console.error('Error checking availability:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/appointments/calendar/conflicts - Check for scheduling conflicts
router.post('/conflicts', async (req, res) => {
    const {
        medico_id,
        fecha_hora,
        duracion_minutos = 30,
        exclude_appointment_id
    } = req.body;

    // Validate parameters
    const errors = [];
    if (!medico_id || isNaN(parseInt(medico_id))) {
        errors.push('Valid doctor ID is required');
    }
    if (!fecha_hora) {
        errors.push('Date and time is required');
    }
    if (!duracion_minutos || isNaN(parseInt(duracion_minutos))) {
        errors.push('Valid duration in minutes is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors
        });
    }

    try {
        const pool = getPool();

        // Build conflict check query
        let conflictQuery = `
            SELECT 
                id,
                numero_cita,
                fecha_hora,
                duracion_minutos,
                fecha_hora_fin,
                tipo_cita,
                estado,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            WHERE c.medico_id = $1
            AND c.activo = TRUE
            AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            AND (
                ($2 BETWEEN c.fecha_hora AND c.fecha_hora_fin) OR
                ($2 + INTERVAL '1 minute' * $3 BETWEEN c.fecha_hora AND c.fecha_hora_fin) OR
                (c.fecha_hora BETWEEN $2 AND $2 + INTERVAL '1 minute' * $3)
            )
        `;

        const params = [medico_id, fecha_hora, duracion_minutos];

        // Exclude specific appointment if provided (for updates)
        if (exclude_appointment_id) {
            conflictQuery += ' AND c.id != $4';
            params.push(exclude_appointment_id);
        }

        const { rows: conflicts } = await pool.query(conflictQuery, params);

        const hasConflicts = conflicts.length > 0;

        res.status(200).json({
            success: true,
            data: {
                hasConflicts,
                conflictCount: conflicts.length,
                conflicts: conflicts.map(conflict => ({
                    id: conflict.id,
                    numero_cita: conflict.numero_cita,
                    fecha_hora: conflict.fecha_hora,
                    duracion_minutos: conflict.duracion_minutos,
                    fecha_hora_fin: conflict.fecha_hora_fin,
                    tipo_cita: conflict.tipo_cita,
                    estado: conflict.estado,
                    nombre_paciente: conflict.nombre_paciente
                })),
                requestedSlot: {
                    fecha_hora,
                    duracion_minutos,
                    fecha_hora_fin: new Date(new Date(fecha_hora).getTime() + duracion_minutos * 60000).toISOString()
                }
            },
            message: hasConflicts ?
                `Found ${conflicts.length} scheduling conflict(s)` :
                'No scheduling conflicts detected'
        });

    } catch (err) {
        console.error('Error checking conflicts:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/appointments/calendar/agenda/:medico_id - Get doctor's daily agenda
router.get('/agenda/:medico_id', async (req, res) => {
    const { medico_id } = req.params;
    const { fecha } = req.query;

    // Validate parameters
    if (!medico_id || isNaN(parseInt(medico_id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid doctor ID provided'
        });
    }

    if (!fecha) {
        return res.status(400).json({
            success: false,
            error: 'Date parameter is required'
        });
    }

    try {
        const pool = getPool();

        // Get doctor information
        const doctorQuery = `
            SELECT id, nombres, apellidos, especialidad, activo
            FROM USUARIOS
            WHERE id = $1 AND rol IN ('MEDICO', 'ADMIN')
        `;

        const { rows: doctorRows } = await pool.query(doctorQuery, [medico_id]);

        if (doctorRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor not found or not authorized'
            });
        }

        const doctor = doctorRows[0];

        // Get appointments for the specified date
        const appointmentsQuery = `
            SELECT 
                c.id,
                c.numero_cita,
                c.fecha_hora,
                c.duracion_minutos,
                c.fecha_hora_fin,
                c.tipo_cita,
                c.estado,
                c.motivo,
                c.observaciones,
                c.sala_consulta,
                c.telefono_contacto,
                c.email_contacto,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.telefono as telefono_paciente,
                p.numero_expediente,
                EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad_paciente,
                p.tipo_sangre,
                p.alergias
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            WHERE c.medico_id = $1
            AND DATE(c.fecha_hora) = $2
            AND c.activo = TRUE
            ORDER BY c.fecha_hora
        `;

        const { rows: appointments } = await pool.query(appointmentsQuery, [medico_id, fecha]);

        // Get doctor's schedule for the day
        const dayOfWeek = new Date(fecha).getDay() || 7;

        const scheduleQuery = `
            SELECT 
                hora_inicio,
                hora_fin,
                duracion_cita_minutos,
                pausas
            FROM HORARIOS_MEDICOS
            WHERE medico_id = $1
            AND dia_semana = $2
            AND activo = TRUE
            AND fecha_inicio_vigencia <= $3
            AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= $3)
        `;

        const { rows: scheduleRows } = await pool.query(scheduleQuery, [medico_id, dayOfWeek, fecha]);

        // Check for schedule exceptions
        const exceptionQuery = `
            SELECT 
                tipo_excepcion,
                motivo,
                hora_inicio_especial,
                hora_fin_especial
            FROM EXCEPCIONES_HORARIO
            WHERE medico_id = $1
            AND fecha = $2
            AND activo = TRUE
        `;

        const { rows: exceptionRows } = await pool.query(exceptionQuery, [medico_id, fecha]);

        // Calculate statistics
        const stats = {
            totalAppointments: appointments.length,
            byStatus: appointments.reduce((acc, apt) => {
                acc[apt.estado] = (acc[apt.estado] || 0) + 1;
                return acc;
            }, {}),
            byType: appointments.reduce((acc, apt) => {
                acc[apt.tipo_cita] = (acc[apt.tipo_cita] || 0) + 1;
                return acc;
            }, {}),
            totalDuration: appointments.reduce((sum, apt) => sum + apt.duracion_minutos, 0)
        };

        res.status(200).json({
            success: true,
            data: {
                doctor: {
                    id: doctor.id,
                    nombre: `${doctor.nombres} ${doctor.apellidos}`,
                    especialidad: doctor.especialidad,
                    activo: doctor.activo
                },
                fecha,
                schedule: scheduleRows.length > 0 ? scheduleRows[0] : null,
                exceptions: exceptionRows,
                appointments,
                statistics: stats,
                workingDay: scheduleRows.length > 0 && exceptionRows.every(ex => ex.tipo_excepcion !== 'NO_DISPONIBLE')
            },
            message: `Retrieved agenda for ${doctor.nombres} ${doctor.apellidos} on ${fecha}`
        });

    } catch (err) {
        console.error('Error getting agenda:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/appointments/calendar/week/:medico_id - Get doctor's weekly schedule
router.get('/week/:medico_id', async (req, res) => {
    const { medico_id } = req.params;
    const { start_date } = req.query;

    // Validate parameters
    if (!medico_id || isNaN(parseInt(medico_id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid doctor ID provided'
        });
    }

    if (!start_date) {
        return res.status(400).json({
            success: false,
            error: 'Start date parameter is required'
        });
    }

    try {
        const pool = getPool();

        // Calculate end date (6 days after start_date)
        const startDate = new Date(start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        // Get doctor information
        const doctorQuery = `
            SELECT id, nombres, apellidos, especialidad, activo
            FROM USUARIOS
            WHERE id = $1 AND rol IN ('MEDICO', 'ADMIN')
        `;

        const { rows: doctorRows } = await pool.query(doctorQuery, [medico_id]);

        if (doctorRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor not found or not authorized'
            });
        }

        const doctor = doctorRows[0];

        // Get appointments for the week
        const appointmentsQuery = `
            SELECT 
                c.id,
                c.numero_cita,
                c.fecha_hora,
                c.duracion_minutos,
                c.tipo_cita,
                c.estado,
                c.motivo,
                c.sala_consulta,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.numero_expediente,
                DATE(c.fecha_hora) as fecha_cita
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            WHERE c.medico_id = $1
            AND DATE(c.fecha_hora) BETWEEN $2 AND $3
            AND c.activo = TRUE
            ORDER BY c.fecha_hora
        `;

        const { rows: appointments } = await pool.query(appointmentsQuery, [
            medico_id,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        ]);

        // Get doctor's regular schedule
        const scheduleQuery = `
            SELECT 
                dia_semana,
                hora_inicio,
                hora_fin,
                duracion_cita_minutos,
                pausas,
                activo
            FROM HORARIOS_MEDICOS
            WHERE medico_id = $1
            AND activo = TRUE
            AND fecha_inicio_vigencia <= $2
            AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= $3)
            ORDER BY dia_semana
        `;

        const { rows: scheduleRows } = await pool.query(scheduleQuery, [
            medico_id,
            endDate.toISOString().split('T')[0],
            startDate.toISOString().split('T')[0]
        ]);

        // Get exceptions for the week
        const exceptionsQuery = `
            SELECT 
                fecha,
                tipo_excepcion,
                motivo,
                hora_inicio_especial,
                hora_fin_especial
            FROM EXCEPCIONES_HORARIO
            WHERE medico_id = $1
            AND fecha BETWEEN $2 AND $3
            AND activo = TRUE
            ORDER BY fecha
        `;

        const { rows: exceptions } = await pool.query(exceptionsQuery, [
            medico_id,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        ]);

        // Group appointments by date
        const appointmentsByDate = appointments.reduce((acc, apt) => {
            const date = apt.fecha_cita;
            if (!acc[date]) acc[date] = [];
            acc[date].push(apt);
            return acc;
        }, {});

        // Group exceptions by date
        const exceptionsByDate = exceptions.reduce((acc, exc) => {
            const date = exc.fecha.toISOString().split('T')[0];
            acc[date] = exc;
            return acc;
        }, {});

        // Build weekly schedule
        const weeklySchedule = [];
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayOfWeek = currentDate.getDay() || 7;

            const daySchedule = scheduleRows.find(s => s.dia_semana === dayOfWeek);
            const dayException = exceptionsByDate[dateStr];
            const dayAppointments = appointmentsByDate[dateStr] || [];

            weeklySchedule.push({
                date: dateStr,
                dayOfWeek,
                dayName: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][currentDate.getDay()],
                schedule: daySchedule || null,
                exception: dayException || null,
                appointments: dayAppointments,
                appointmentCount: dayAppointments.length,
                isWorkingDay: daySchedule && (!dayException || dayException.tipo_excepcion !== 'NO_DISPONIBLE')
            });
        }

        // Calculate weekly statistics
        const weekStats = {
            totalAppointments: appointments.length,
            workingDays: weeklySchedule.filter(day => day.isWorkingDay).length,
            busyDays: weeklySchedule.filter(day => day.appointmentCount > 0).length,
            averageAppointmentsPerDay: appointments.length / 7,
            byStatus: appointments.reduce((acc, apt) => {
                acc[apt.estado] = (acc[apt.estado] || 0) + 1;
                return acc;
            }, {}),
            byType: appointments.reduce((acc, apt) => {
                acc[apt.tipo_cita] = (acc[apt.tipo_cita] || 0) + 1;
                return acc;
            }, {})
        };

        res.status(200).json({
            success: true,
            data: {
                doctor: {
                    id: doctor.id,
                    nombre: `${doctor.nombres} ${doctor.apellidos}`,
                    especialidad: doctor.especialidad
                },
                period: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                },
                weeklySchedule,
                statistics: weekStats
            },
            message: `Retrieved weekly schedule for ${doctor.nombres} ${doctor.apellidos}`
        });

    } catch (err) {
        console.error('Error getting weekly schedule:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

/**
 * Helper function to generate available time slots
 */
function generateAvailableSlots(startTime, endTime, duration, pausas, existingAppointments, fecha) {
    const slots = [];

    // Convert time strings to minutes since midnight
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    // Parse pausas (breaks) if they exist
    const breaks = pausas ? JSON.parse(pausas) : [];

    // Convert existing appointments to time ranges
    const busyRanges = existingAppointments.map(apt => {
        const aptDate = new Date(apt.fecha_hora);
        const startMins = aptDate.getHours() * 60 + aptDate.getMinutes();
        return {
            start: startMins,
            end: startMins + apt.duracion_minutos
        };
    });

    // Add breaks to busy ranges
    breaks.forEach(breakTime => {
        if (breakTime.inicio && breakTime.fin) {
            busyRanges.push({
                start: timeToMinutes(breakTime.inicio),
                end: timeToMinutes(breakTime.fin)
            });
        }
    });

    // Sort busy ranges by start time
    busyRanges.sort((a, b) => a.start - b.start);

    // Generate slots
    let currentTime = startMinutes;

    while (currentTime + duration <= endMinutes) {
        const slotEnd = currentTime + duration;

        // Check if this slot conflicts with any busy range
        const hasConflict = busyRanges.some(range =>
            (currentTime < range.end && slotEnd > range.start)
        );

        if (!hasConflict) {
            const slotDateTime = new Date(fecha + 'T' + minutesToTime(currentTime));

            // Only include future slots
            if (slotDateTime > new Date()) {
                slots.push({
                    hora_inicio: minutesToTime(currentTime),
                    hora_fin: minutesToTime(slotEnd),
                    fecha_hora: slotDateTime.toISOString(),
                    duracion_minutos: duration,
                    available: true
                });
            }
        }

        // Move to next 15-minute interval
        currentTime += 15;
    }

    return slots;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

module.exports = router;