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

// GET /api/v1/analytics/scheduling/overview - Get scheduling overview metrics
router.get('/scheduling/overview', async (req, res) => {
    const {
        fecha_inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
        fecha_fin = new Date().toISOString().split('T')[0], // today
        medico_id
    } = req.query;

    try {
        const pool = getPool();

        // Base filters
        let whereClause = 'WHERE c.activo = TRUE AND DATE(c.fecha_hora) BETWEEN $1 AND $2';
        let params = [fecha_inicio, fecha_fin];
        let paramIndex = 3;

        if (medico_id) {
            whereClause += ` AND c.medico_id = $${paramIndex}`;
            params.push(medico_id);
            paramIndex++;
        }

        // Total appointments metrics
        const appointmentsQuery = `
            SELECT 
                COUNT(*) as total_citas,
                COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) as citas_completadas,
                COUNT(CASE WHEN estado = 'CANCELADA' THEN 1 END) as citas_canceladas,
                COUNT(CASE WHEN estado = 'NO_ASISTIO' THEN 1 END) as no_shows,
                COUNT(CASE WHEN estado IN ('PROGRAMADA', 'CONFIRMADA') THEN 1 END) as citas_pendientes,
                AVG(duracion_minutos) as duracion_promedio,
                SUM(duracion_minutos) as total_minutos_programados
            FROM CITAS c
            ${whereClause}
        `;

        const { rows: appointmentMetrics } = await pool.query(appointmentsQuery, params);

        // Daily appointment distribution
        const dailyDistributionQuery = `
            SELECT 
                DATE(fecha_hora) as fecha,
                COUNT(*) as total_citas,
                COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) as completadas,
                COUNT(CASE WHEN estado = 'CANCELADA' THEN 1 END) as canceladas,
                COUNT(CASE WHEN estado = 'NO_ASISTIO' THEN 1 END) as no_shows,
                AVG(duracion_minutos) as duracion_promedio
            FROM CITAS c
            ${whereClause}
            GROUP BY DATE(fecha_hora)
            ORDER BY fecha
        `;

        const { rows: dailyDistribution } = await pool.query(dailyDistributionQuery, params);

        // Provider utilization
        const providerUtilizationQuery = `
            SELECT 
                u.id as medico_id,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad,
                COUNT(c.id) as total_citas,
                COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END) as citas_completadas,
                AVG(c.duracion_minutos) as duracion_promedio,
                SUM(c.duracion_minutos) as total_minutos,
                ROUND(
                    (COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(c.id), 0)) * 100, 2
                ) as tasa_completacion
            FROM USUARIOS u
            LEFT JOIN CITAS c ON u.id = c.medico_id 
                AND c.activo = TRUE 
                AND DATE(c.fecha_hora) BETWEEN $1 AND $2
                ${medico_id ? `AND c.medico_id = $${paramIndex - 1}` : ''}
            WHERE u.rol IN ('MEDICO', 'ESPECIALISTA', 'ADMIN') AND u.activo = TRUE
            GROUP BY u.id, u.nombres, u.apellidos, u.especialidad
            HAVING COUNT(c.id) > 0
            ORDER BY total_citas DESC
        `;

        const { rows: providerUtilization } = await pool.query(providerUtilizationQuery, params.slice(0, 2));

        // Appointment types distribution
        const appointmentTypesQuery = `
            SELECT 
                tipo_cita,
                COUNT(*) as cantidad,
                AVG(duracion_minutos) as duracion_promedio,
                ROUND(
                    (COUNT(*)::DECIMAL / (SELECT COUNT(*) FROM CITAS c2 ${whereClause})) * 100, 2
                ) as porcentaje
            FROM CITAS c
            ${whereClause}
            GROUP BY tipo_cita
            ORDER BY cantidad DESC
        `;

        const { rows: appointmentTypes } = await pool.query(appointmentTypesQuery, [...params, ...params]);

        // Time slot utilization
        const timeSlotQuery = `
            SELECT 
                EXTRACT(HOUR FROM fecha_hora) as hora,
                COUNT(*) as total_citas,
                COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) as completadas,
                ROUND(AVG(duracion_minutos), 2) as duracion_promedio
            FROM CITAS c
            ${whereClause}
            GROUP BY EXTRACT(HOUR FROM fecha_hora)
            ORDER BY hora
        `;

        const { rows: timeSlotUtilization } = await pool.query(timeSlotQuery, params);

        // Calculate efficiency metrics
        const totalAppointments = parseInt(appointmentMetrics[0].total_citas) || 0;
        const completedAppointments = parseInt(appointmentMetrics[0].citas_completadas) || 0;
        const cancelledAppointments = parseInt(appointmentMetrics[0].citas_canceladas) || 0;
        const noShows = parseInt(appointmentMetrics[0].no_shows) || 0;

        const completionRate = totalAppointments > 0 ?
            ((completedAppointments / totalAppointments) * 100).toFixed(2) : 0;
        const cancellationRate = totalAppointments > 0 ?
            ((cancelledAppointments / totalAppointments) * 100).toFixed(2) : 0;
        const noShowRate = totalAppointments > 0 ?
            ((noShows / totalAppointments) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                period: {
                    fecha_inicio,
                    fecha_fin,
                    dias_analizados: Math.ceil((new Date(fecha_fin) - new Date(fecha_inicio)) / (1000 * 60 * 60 * 24)) + 1
                },
                overview: {
                    ...appointmentMetrics[0],
                    completion_rate: parseFloat(completionRate),
                    cancellation_rate: parseFloat(cancellationRate),
                    no_show_rate: parseFloat(noShowRate),
                    efficiency_score: parseFloat((100 - parseFloat(cancellationRate) - parseFloat(noShowRate)).toFixed(2))
                },
                dailyDistribution,
                providerUtilization,
                appointmentTypes,
                timeSlotUtilization
            },
            message: 'Scheduling analytics retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting scheduling analytics:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/analytics/resources/utilization - Get resource utilization metrics
router.get('/resources/utilization', async (req, res) => {
    const {
        fecha_inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fecha_fin = new Date().toISOString().split('T')[0],
        tipo_recurso,
        ubicacion
    } = req.query;

    try {
        const pool = getPool();

        // Base filters for reservations
        let whereClause = 'WHERE rr.fecha_inicio BETWEEN $1 AND $2';
        let params = [fecha_inicio + ' 00:00:00', fecha_fin + ' 23:59:59'];
        let paramIndex = 3;

        if (tipo_recurso) {
            whereClause += ` AND r.tipo_recurso = $${paramIndex}`;
            params.push(tipo_recurso);
            paramIndex++;
        }

        if (ubicacion) {
            whereClause += ` AND r.ubicacion = $${paramIndex}`;
            params.push(ubicacion);
            paramIndex++;
        }

        // Resource utilization overview
        const utilizationQuery = `
            SELECT 
                r.id,
                r.nombre,
                r.tipo_recurso,
                r.ubicacion,
                r.capacidad_maxima,
                r.estado_recurso,
                COUNT(rr.id) as total_reservas,
                COUNT(CASE WHEN rr.estado_reserva = 'COMPLETADA' THEN 1 END) as reservas_completadas,
                COUNT(CASE WHEN rr.estado_reserva = 'CANCELADA' THEN 1 END) as reservas_canceladas,
                SUM(EXTRACT(EPOCH FROM (rr.fecha_fin - rr.fecha_inicio))/3600) as horas_reservadas,
                AVG(EXTRACT(EPOCH FROM (rr.fecha_fin - rr.fecha_inicio))/3600) as duracion_promedio_horas,
                ROUND(
                    (COUNT(CASE WHEN rr.estado_reserva = 'COMPLETADA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(rr.id), 0)) * 100, 2
                ) as tasa_utilizacion
            FROM RECURSOS r
            LEFT JOIN RESERVAS_RECURSOS rr ON r.id = rr.recurso_id 
                AND rr.activo = TRUE
                AND rr.fecha_inicio BETWEEN $1 AND $2
            WHERE r.activo = TRUE
            ${tipo_recurso ? `AND r.tipo_recurso = $${params.length - (ubicacion ? 1 : 0)}` : ''}
            ${ubicacion ? `AND r.ubicacion = $${params.length}` : ''}
            GROUP BY r.id, r.nombre, r.tipo_recurso, r.ubicacion, r.capacidad_maxima, r.estado_recurso
            ORDER BY total_reservas DESC
        `;

        const { rows: resourceUtilization } = await pool.query(utilizationQuery, params);

        // Daily resource usage
        const dailyUsageQuery = `
            SELECT 
                DATE(rr.fecha_inicio) as fecha,
                COUNT(DISTINCT rr.recurso_id) as recursos_utilizados,
                COUNT(rr.id) as total_reservas,
                SUM(EXTRACT(EPOCH FROM (rr.fecha_fin - rr.fecha_inicio))/3600) as horas_totales
            FROM RESERVAS_RECURSOS rr
            JOIN RECURSOS r ON rr.recurso_id = r.id
            ${whereClause}
            AND rr.activo = TRUE AND r.activo = TRUE
            GROUP BY DATE(rr.fecha_inicio)
            ORDER BY fecha
        `;

        const { rows: dailyUsage } = await pool.query(dailyUsageQuery, params);

        // Resource type distribution
        const typeDistributionQuery = `
            SELECT 
                r.tipo_recurso,
                COUNT(DISTINCT r.id) as total_recursos,
                COUNT(rr.id) as total_reservas,
                SUM(EXTRACT(EPOCH FROM (rr.fecha_fin - rr.fecha_inicio))/3600) as horas_utilizadas,
                AVG(EXTRACT(EPOCH FROM (rr.fecha_fin - rr.fecha_inicio))/3600) as duracion_promedio
            FROM RECURSOS r
            LEFT JOIN RESERVAS_RECURSOS rr ON r.id = rr.recurso_id 
                AND rr.activo = TRUE
                AND rr.fecha_inicio BETWEEN $1 AND $2
            WHERE r.activo = TRUE
            GROUP BY r.tipo_recurso
            ORDER BY total_reservas DESC
        `;

        const { rows: typeDistribution } = await pool.query(typeDistributionQuery, params.slice(0, 2));

        // Peak usage hours
        const peakHoursQuery = `
            SELECT 
                EXTRACT(HOUR FROM rr.fecha_inicio) as hora,
                COUNT(rr.id) as reservas_activas,
                COUNT(DISTINCT rr.recurso_id) as recursos_utilizados,
                AVG(EXTRACT(EPOCH FROM (rr.fecha_fin - rr.fecha_inicio))/60) as duracion_promedio_minutos
            FROM RESERVAS_RECURSOS rr
            JOIN RECURSOS r ON rr.recurso_id = r.id
            ${whereClause}
            AND rr.activo = TRUE AND r.activo = TRUE
            GROUP BY EXTRACT(HOUR FROM rr.fecha_inicio)
            ORDER BY hora
        `;

        const { rows: peakHours } = await pool.query(peakHoursQuery, params);

        // Calculate efficiency metrics
        const totalResources = resourceUtilization.length;
        const activeResources = resourceUtilization.filter(r => r.total_reservas > 0).length;
        const averageUtilization = resourceUtilization.length > 0 ?
            (resourceUtilization.reduce((sum, r) => sum + parseFloat(r.tasa_utilizacion || 0), 0) / resourceUtilization.length).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                period: {
                    fecha_inicio,
                    fecha_fin
                },
                overview: {
                    total_recursos: totalResources,
                    recursos_activos: activeResources,
                    utilizacion_promedio: parseFloat(averageUtilization),
                    total_reservas: resourceUtilization.reduce((sum, r) => sum + parseInt(r.total_reservas || 0), 0),
                    horas_totales_reservadas: resourceUtilization.reduce((sum, r) => sum + parseFloat(r.horas_reservadas || 0), 0).toFixed(2)
                },
                resourceUtilization,
                dailyUsage,
                typeDistribution,
                peakHours
            },
            message: 'Resource utilization analytics retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting resource analytics:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/analytics/waitlist/metrics - Get waitlist performance metrics
router.get('/waitlist/metrics', async (req, res) => {
    const {
        fecha_inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fecha_fin = new Date().toISOString().split('T')[0],
        especialidad,
        prioridad
    } = req.query;

    try {
        const pool = getPool();

        // Base filters
        let whereClause = 'WHERE le.fecha_creacion BETWEEN $1 AND $2';
        let params = [fecha_inicio + ' 00:00:00', fecha_fin + ' 23:59:59'];
        let paramIndex = 3;

        if (especialidad) {
            whereClause += ` AND u.especialidad = $${paramIndex}`;
            params.push(especialidad);
            paramIndex++;
        }

        if (prioridad) {
            whereClause += ` AND le.prioridad = $${paramIndex}`;
            params.push(prioridad);
            paramIndex++;
        }

        // Waitlist overview metrics
        const waitlistOverviewQuery = `
            SELECT 
                COUNT(*) as total_entradas,
                COUNT(CASE WHEN le.estado = 'ACTIVA' THEN 1 END) as entradas_activas,
                COUNT(CASE WHEN le.estado = 'CONVERTIDA' THEN 1 END) as entradas_convertidas,
                COUNT(CASE WHEN le.estado = 'CANCELADA' THEN 1 END) as entradas_canceladas,
                COUNT(CASE WHEN le.estado = 'EXPIRADA' THEN 1 END) as entradas_expiradas,
                AVG(EXTRACT(EPOCH FROM (COALESCE(le.fecha_conversion, CURRENT_TIMESTAMP) - le.fecha_creacion))/3600) as tiempo_promedio_espera_horas,
                ROUND(
                    (COUNT(CASE WHEN le.estado = 'CONVERTIDA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(*), 0)) * 100, 2
                ) as tasa_conversion
            FROM LISTA_ESPERA le
            JOIN USUARIOS u ON le.medico_preferido_id = u.id
            ${whereClause}
        `;

        const { rows: waitlistOverview } = await pool.query(waitlistOverviewQuery, params);

        // Daily waitlist activity
        const dailyActivityQuery = `
            SELECT 
                DATE(le.fecha_creacion) as fecha,
                COUNT(*) as nuevas_entradas,
                COUNT(CASE WHEN le.estado = 'CONVERTIDA' AND DATE(le.fecha_conversion) = DATE(le.fecha_creacion) THEN 1 END) as conversiones_mismo_dia,
                AVG(CASE WHEN le.estado = 'CONVERTIDA' THEN EXTRACT(EPOCH FROM (le.fecha_conversion - le.fecha_creacion))/3600 END) as tiempo_promedio_conversion_horas
            FROM LISTA_ESPERA le
            JOIN USUARIOS u ON le.medico_preferido_id = u.id
            ${whereClause}
            GROUP BY DATE(le.fecha_creacion)
            ORDER BY fecha
        `;

        const { rows: dailyActivity } = await pool.query(dailyActivityQuery, params);

        // Provider waitlist performance
        const providerPerformanceQuery = `
            SELECT 
                u.id as medico_id,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad,
                COUNT(le.id) as total_entradas_waitlist,
                COUNT(CASE WHEN le.estado = 'CONVERTIDA' THEN 1 END) as conversiones,
                AVG(CASE WHEN le.estado = 'CONVERTIDA' THEN EXTRACT(EPOCH FROM (le.fecha_conversion - le.fecha_creacion))/3600 END) as tiempo_promedio_conversion_horas,
                ROUND(
                    (COUNT(CASE WHEN le.estado = 'CONVERTIDA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(le.id), 0)) * 100, 2
                ) as tasa_conversion_proveedor
            FROM USUARIOS u
            LEFT JOIN LISTA_ESPERA le ON u.id = le.medico_preferido_id
                AND le.fecha_creacion BETWEEN $1 AND $2
            WHERE u.rol IN ('MEDICO', 'ESPECIALISTA', 'ADMIN') AND u.activo = TRUE
            GROUP BY u.id, u.nombres, u.apellidos, u.especialidad
            HAVING COUNT(le.id) > 0
            ORDER BY conversiones DESC
        `;

        const { rows: providerPerformance } = await pool.query(providerPerformanceQuery, params.slice(0, 2));

        // Priority distribution
        const priorityDistributionQuery = `
            SELECT 
                le.prioridad,
                COUNT(*) as cantidad,
                COUNT(CASE WHEN le.estado = 'CONVERTIDA' THEN 1 END) as conversiones,
                AVG(CASE WHEN le.estado = 'CONVERTIDA' THEN EXTRACT(EPOCH FROM (le.fecha_conversion - le.fecha_creacion))/3600 END) as tiempo_promedio_conversion,
                ROUND(
                    (COUNT(CASE WHEN le.estado = 'CONVERTIDA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(*), 0)) * 100, 2
                ) as tasa_conversion_prioridad
            FROM LISTA_ESPERA le
            JOIN USUARIOS u ON le.medico_preferido_id = u.id
            ${whereClause}
            GROUP BY le.prioridad
            ORDER BY 
                CASE le.prioridad 
                    WHEN 'URGENTE' THEN 1 
                    WHEN 'ALTA' THEN 2 
                    WHEN 'NORMAL' THEN 3 
                    WHEN 'BAJA' THEN 4 
                END
        `;

        const { rows: priorityDistribution } = await pool.query(priorityDistributionQuery, params);

        // Current active waitlist
        const activeWaitlistQuery = `
            SELECT 
                le.id,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                CONCAT(u.nombres, ' ', u.apellidos) as medico_preferido,
                u.especialidad,
                le.tipo_cita_solicitada,
                le.prioridad,
                le.fecha_creacion,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - le.fecha_creacion))/3600 as horas_esperando,
                le.observaciones
            FROM LISTA_ESPERA le
            JOIN PACIENTES p ON le.paciente_id = p.id
            JOIN USUARIOS u ON le.medico_preferido_id = u.id
            WHERE le.estado = 'ACTIVA'
            ORDER BY 
                CASE le.prioridad 
                    WHEN 'URGENTE' THEN 1 
                    WHEN 'ALTA' THEN 2 
                    WHEN 'NORMAL' THEN 3 
                    WHEN 'BAJA' THEN 4 
                END,
                le.fecha_creacion
            LIMIT 20
        `;

        const { rows: activeWaitlist } = await pool.query(activeWaitlistQuery);

        res.status(200).json({
            success: true,
            data: {
                period: {
                    fecha_inicio,
                    fecha_fin
                },
                overview: waitlistOverview[0],
                dailyActivity,
                providerPerformance,
                priorityDistribution,
                activeWaitlist
            },
            message: 'Waitlist analytics retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting waitlist analytics:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/analytics/efficiency/report - Get comprehensive efficiency report
router.get('/efficiency/report', async (req, res) => {
    const {
        fecha_inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fecha_fin = new Date().toISOString().split('T')[0],
        medico_id
    } = req.query;

    try {
        const pool = getPool();

        // Base filters
        let whereClause = 'WHERE c.activo = TRUE AND DATE(c.fecha_hora) BETWEEN $1 AND $2';
        let params = [fecha_inicio, fecha_fin];
        let paramIndex = 3;

        if (medico_id) {
            whereClause += ` AND c.medico_id = $${paramIndex}`;
            params.push(medico_id);
            paramIndex++;
        }

        // Efficiency metrics calculation
        const efficiencyQuery = `
            WITH appointment_metrics AS (
                SELECT 
                    c.medico_id,
                    COUNT(*) as total_appointments,
                    COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END) as completed,
                    COUNT(CASE WHEN c.estado = 'CANCELADA' THEN 1 END) as cancelled,
                    COUNT(CASE WHEN c.estado = 'NO_ASISTIO' THEN 1 END) as no_shows,
                    AVG(c.duracion_minutos) as avg_duration,
                    SUM(c.duracion_minutos) as total_scheduled_minutes,
                    AVG(CASE WHEN c.fecha_hora_fin IS NOT NULL AND c.fecha_hora_inicio IS NOT NULL 
                        THEN EXTRACT(EPOCH FROM (c.fecha_hora_fin - c.fecha_hora_inicio))/60 
                        END) as avg_actual_duration
                FROM CITAS c
                ${whereClause}
                GROUP BY c.medico_id
            ),
            schedule_metrics AS (
                SELECT 
                    h.medico_id,
                    SUM(EXTRACT(EPOCH FROM (h.hora_fin::time - h.hora_inicio::time))/60) * 
                        (SELECT COUNT(DISTINCT DATE(c2.fecha_hora)) 
                         FROM CITAS c2 
                         WHERE c2.medico_id = h.medico_id 
                         AND DATE(c2.fecha_hora) BETWEEN $1 AND $2) as total_available_minutes
                FROM HORARIOS_MEDICOS h
                WHERE h.activo = TRUE
                GROUP BY h.medico_id
            )
            SELECT 
                u.id as medico_id,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad,
                am.total_appointments,
                am.completed,
                am.cancelled,
                am.no_shows,
                am.avg_duration,
                am.avg_actual_duration,
                sm.total_available_minutes,
                am.total_scheduled_minutes,
                ROUND((am.completed::DECIMAL / NULLIF(am.total_appointments, 0)) * 100, 2) as completion_rate,
                ROUND((am.cancelled::DECIMAL / NULLIF(am.total_appointments, 0)) * 100, 2) as cancellation_rate,
                ROUND((am.no_shows::DECIMAL / NULLIF(am.total_appointments, 0)) * 100, 2) as no_show_rate,
                ROUND((am.total_scheduled_minutes / NULLIF(sm.total_available_minutes, 0)) * 100, 2) as schedule_utilization,
                ROUND(
                    ((am.completed::DECIMAL / NULLIF(am.total_appointments, 0)) * 0.4 +
                     (1 - (am.cancelled + am.no_shows)::DECIMAL / NULLIF(am.total_appointments, 0)) * 0.3 +
                     (am.total_scheduled_minutes / NULLIF(sm.total_available_minutes, 0)) * 0.3) * 100, 2
                ) as efficiency_score
            FROM USUARIOS u
            JOIN appointment_metrics am ON u.id = am.medico_id
            LEFT JOIN schedule_metrics sm ON u.id = sm.medico_id
            WHERE u.rol IN ('MEDICO', 'ESPECIALISTA', 'ADMIN') AND u.activo = TRUE
            ORDER BY efficiency_score DESC NULLS LAST
        `;

        const { rows: efficiencyReport } = await pool.query(efficiencyQuery, params.slice(0, 2));

        // Time-based efficiency analysis
        const timeEfficiencyQuery = `
            SELECT 
                EXTRACT(HOUR FROM c.fecha_hora) as hour_of_day,
                COUNT(*) as total_appointments,
                COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END) as completed,
                AVG(c.duracion_minutos) as avg_scheduled_duration,
                AVG(CASE WHEN c.fecha_hora_fin IS NOT NULL AND c.fecha_hora_inicio IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (c.fecha_hora_fin - c.fecha_hora_inicio))/60 
                    END) as avg_actual_duration,
                ROUND(
                    (COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(*), 0)) * 100, 2
                ) as hourly_completion_rate
            FROM CITAS c
            ${whereClause}
            GROUP BY EXTRACT(HOUR FROM c.fecha_hora)
            ORDER BY hour_of_day
        `;

        const { rows: timeEfficiency } = await pool.query(timeEfficiencyQuery, params);

        // Weekly efficiency trends
        const weeklyTrendsQuery = `
            SELECT 
                DATE_TRUNC('week', c.fecha_hora)::date as week_start,
                COUNT(*) as total_appointments,
                COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END) as completed,
                COUNT(CASE WHEN c.estado = 'CANCELADA' THEN 1 END) as cancelled,
                COUNT(CASE WHEN c.estado = 'NO_ASISTIO' THEN 1 END) as no_shows,
                ROUND(
                    (COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END)::DECIMAL / 
                     NULLIF(COUNT(*), 0)) * 100, 2
                ) as weekly_completion_rate
            FROM CITAS c
            ${whereClause}
            GROUP BY DATE_TRUNC('week', c.fecha_hora)
            ORDER BY week_start
        `;

        const { rows: weeklyTrends } = await pool.query(weeklyTrendsQuery, params);

        // Calculate overall system efficiency
        const totalAppointments = efficiencyReport.reduce((sum, r) => sum + (parseInt(r.total_appointments) || 0), 0);
        const totalCompleted = efficiencyReport.reduce((sum, r) => sum + (parseInt(r.completed) || 0), 0);
        const totalCancelled = efficiencyReport.reduce((sum, r) => sum + (parseInt(r.cancelled) || 0), 0);
        const totalNoShows = efficiencyReport.reduce((sum, r) => sum + (parseInt(r.no_shows) || 0), 0);

        const systemEfficiency = {
            overall_completion_rate: totalAppointments > 0 ? ((totalCompleted / totalAppointments) * 100).toFixed(2) : 0,
            overall_cancellation_rate: totalAppointments > 0 ? ((totalCancelled / totalAppointments) * 100).toFixed(2) : 0,
            overall_no_show_rate: totalAppointments > 0 ? ((totalNoShows / totalAppointments) * 100).toFixed(2) : 0,
            average_efficiency_score: efficiencyReport.length > 0 ?
                (efficiencyReport.reduce((sum, r) => sum + (parseFloat(r.efficiency_score) || 0), 0) / efficiencyReport.length).toFixed(2) : 0
        };

        res.status(200).json({
            success: true,
            data: {
                period: {
                    fecha_inicio,
                    fecha_fin
                },
                systemEfficiency,
                providerEfficiency: efficiencyReport,
                timeEfficiency,
                weeklyTrends
            },
            message: 'Efficiency report generated successfully'
        });

    } catch (err) {
        console.error('Error generating efficiency report:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;