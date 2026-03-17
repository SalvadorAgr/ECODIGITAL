/**
 * EcoDigital - Calendar Service
 * Advanced calendar functionality for appointment management
 */

const { query, transaction } = require('../db');
const appointmentService = require('./appointmentService');

class CalendarService {
    constructor() {
        this.viewTypes = {
            DAY: 'day',
            WEEK: 'week',
            MONTH: 'month',
            AGENDA: 'agenda'
        };

        this.workingDays = [1, 2, 3, 4, 5]; // Monday to Friday
        this.defaultWorkingHours = {
            start: '08:00',
            end: '18:00',
            lunchStart: '12:00',
            lunchEnd: '13:00'
        };
    }

    /**
     * Get calendar view data for a specific period
     */
    async getCalendarView(viewType, startDate, endDate, doctorId = null, filters = {}) {
        try {
            let appointmentsQuery = `
                SELECT 
                    c.id,
                    c.numero_cita,
                    c.fecha_hora,
                    c.duracion_minutos,
                    c.fecha_hora_fin,
                    c.tipo_cita,
                    c.especialidad,
                    c.motivo,
                    c.estado,
                    c.sala_consulta,
                    c.costo_consulta,
                    c.telefono_contacto,
                    c.email_contacto,
                    CONCAT(p.nombre, ' ', p.apellido) as patient_name,
                    p.telefono as patient_phone,
                    p.numero_expediente,
                    CONCAT(u.nombres, ' ', u.apellidos) as doctor_name,
                    u.especialidad as doctor_specialty,
                    u.id_usuario as doctor_id
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                JOIN USUARIOS u ON c.medico_id = u.id_usuario
                WHERE c.activo = TRUE
                AND c.fecha_hora >= $1
                AND c.fecha_hora <= $2
            `;

            const params = [startDate, endDate];
            let paramIndex = 3;

            // Filter by doctor if specified
            if (doctorId) {
                appointmentsQuery += ` AND c.medico_id = $${paramIndex++}`;
                params.push(doctorId);
            }

            // Filter by appointment state
            if (filters.states && filters.states.length > 0) {
                const stateParams = filters.states.map(() => `$${paramIndex++}`).join(', ');
                appointmentsQuery += ` AND c.estado IN (${stateParams})`;
                params.push(...filters.states);
            }

            // Filter by appointment type
            if (filters.types && filters.types.length > 0) {
                const typeParams = filters.types.map(() => `$${paramIndex++}`).join(', ');
                appointmentsQuery += ` AND c.tipo_cita IN (${typeParams})`;
                params.push(...filters.types);
            }

            appointmentsQuery += ` ORDER BY c.fecha_hora ASC`;

            const { rows: appointments } = await query(appointmentsQuery, params);

            // Format appointments for calendar view
            const formattedAppointments = appointments.map(apt => ({
                id: apt.id,
                title: `${apt.patient_name} - ${apt.tipo_cita}`,
                start: apt.fecha_hora,
                end: apt.fecha_hora_fin,
                duration: apt.duracion_minutos,
                type: apt.tipo_cita,
                status: apt.estado,
                patient: {
                    name: apt.patient_name,
                    phone: apt.patient_phone,
                    expediente: apt.numero_expediente
                },
                doctor: {
                    id: apt.doctor_id,
                    name: apt.doctor_name,
                    specialty: apt.doctor_specialty
                },
                details: {
                    reason: apt.motivo,
                    room: apt.sala_consulta,
                    cost: apt.costo_consulta,
                    contactPhone: apt.telefono_contacto,
                    contactEmail: apt.email_contacto
                },
                color: this.getAppointmentColor(apt.estado, apt.tipo_cita),
                editable: apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA'
            }));

            // Get calendar statistics
            const stats = await this.getCalendarStats(startDate, endDate, doctorId);

            return {
                success: true,
                data: {
                    viewType,
                    period: { startDate, endDate },
                    appointments: formattedAppointments,
                    stats: stats.data,
                    doctorId
                }
            };

        } catch (error) {
            console.error('Get calendar view error:', error);
            throw new Error('Failed to get calendar view');
        }
    }

    /**
     * Get calendar statistics for a period
     */
    async getCalendarStats(startDate, endDate, doctorId = null) {
        try {
            let statsQuery = `
                SELECT 
                    COUNT(*) as total_appointments,
                    COUNT(CASE WHEN estado = 'PROGRAMADA' THEN 1 END) as scheduled,
                    COUNT(CASE WHEN estado = 'CONFIRMADA' THEN 1 END) as confirmed,
                    COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) as completed,
                    COUNT(CASE WHEN estado = 'CANCELADA' THEN 1 END) as cancelled,
                    COUNT(CASE WHEN estado = 'NO_ASISTIO' THEN 1 END) as no_show,
                    AVG(duracion_minutos) as avg_duration,
                    SUM(CASE WHEN estado = 'COMPLETADA' THEN costo_consulta ELSE 0 END) as total_revenue,
                    COUNT(DISTINCT medico_id) as active_doctors,
                    COUNT(DISTINCT id_paciente) as unique_patients
                FROM CITAS
                WHERE activo = TRUE
                AND fecha_hora >= $1
                AND fecha_hora <= $2
            `;

            const params = [startDate, endDate];

            if (doctorId) {
                statsQuery += ` AND medico_id = $3`;
                params.push(doctorId);
            }

            const { rows } = await query(statsQuery, params);
            const stats = rows[0];

            // Convert string numbers to appropriate types
            Object.keys(stats).forEach(key => {
                if (key.includes('avg_') || key.includes('total_revenue')) {
                    stats[key] = parseFloat(stats[key]) || 0;
                } else {
                    stats[key] = parseInt(stats[key]) || 0;
                }
            });

            return {
                success: true,
                data: stats
            };

        } catch (error) {
            console.error('Get calendar stats error:', error);
            throw new Error('Failed to get calendar statistics');
        }
    }

    /**
     * Get doctor schedule for a specific date range
     */
    async getDoctorSchedule(doctorId, startDate, endDate) {
        try {
            // Get doctor's working hours (in a real system, this would come from a schedule table)
            const workingHours = this.defaultWorkingHours;

            // Get appointments for the period
            const appointmentsQuery = `
                SELECT 
                    fecha_hora,
                    duracion_minutos,
                    fecha_hora_fin,
                    estado,
                    tipo_cita,
                    CONCAT(p.nombre, ' ', p.apellido) as patient_name
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                WHERE c.medico_id = $1
                AND c.activo = TRUE
                AND c.fecha_hora >= $2
                AND c.fecha_hora <= $3
                AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                ORDER BY c.fecha_hora
            `;

            const { rows: appointments } = await query(appointmentsQuery, [doctorId, startDate, endDate]);

            // Generate schedule for each day in the range
            const schedule = [];
            const currentDate = new Date(startDate);
            const endDateObj = new Date(endDate);

            while (currentDate <= endDateObj) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayOfWeek = currentDate.getDay();

                // Check if it's a working day
                const isWorkingDay = this.workingDays.includes(dayOfWeek);

                // Get appointments for this day
                const dayAppointments = appointments.filter(apt =>
                    apt.fecha_hora.toISOString().split('T')[0] === dateStr
                );

                // Calculate available slots
                const availableSlots = isWorkingDay
                    ? await appointmentService.generateAvailableSlots(
                        dateStr,
                        workingHours,
                        dayAppointments,
                        30
                    )
                    : [];

                schedule.push({
                    date: dateStr,
                    dayOfWeek,
                    isWorkingDay,
                    workingHours: isWorkingDay ? workingHours : null,
                    appointments: dayAppointments.length,
                    availableSlots: availableSlots.length,
                    totalSlots: availableSlots.length + dayAppointments.length,
                    occupancyRate: availableSlots.length > 0
                        ? Math.round((dayAppointments.length / (availableSlots.length + dayAppointments.length)) * 100)
                        : 0,
                    appointmentDetails: dayAppointments
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }

            return {
                success: true,
                data: {
                    doctorId,
                    period: { startDate, endDate },
                    workingHours,
                    schedule,
                    summary: {
                        totalDays: schedule.length,
                        workingDays: schedule.filter(day => day.isWorkingDay).length,
                        totalAppointments: appointments.length,
                        averageOccupancy: Math.round(
                            schedule.reduce((sum, day) => sum + day.occupancyRate, 0) / schedule.length
                        )
                    }
                }
            };

        } catch (error) {
            console.error('Get doctor schedule error:', error);
            throw new Error('Failed to get doctor schedule');
        }
    }

    /**
     * Find available time slots across multiple doctors
     */
    async findAvailableSlots(date, duration = 30, doctorIds = [], specialty = null) {
        try {
            let doctorsQuery = `
                SELECT 
                    id_usuario as id,
                    CONCAT(nombres, ' ', apellidos) as name,
                    especialidad,
                    telefono,
                    email
                FROM USUARIOS
                WHERE activo = TRUE
                AND rol IN ('MEDICO', 'ADMIN')
            `;

            const params = [];
            let paramIndex = 1;

            // Filter by specific doctors
            if (doctorIds && doctorIds.length > 0) {
                const doctorParams = doctorIds.map(() => `$${paramIndex++}`).join(', ');
                doctorsQuery += ` AND id_usuario IN (${doctorParams})`;
                params.push(...doctorIds);
            }

            // Filter by specialty
            if (specialty) {
                doctorsQuery += ` AND especialidad = $${paramIndex++}`;
                params.push(specialty);
            }

            doctorsQuery += ` ORDER BY nombres, apellidos`;

            const { rows: doctors } = await query(doctorsQuery, params);

            // Get available slots for each doctor
            const doctorSlots = await Promise.all(
                doctors.map(async (doctor) => {
                    try {
                        const availability = await appointmentService.getDoctorAvailability(
                            doctor.id,
                            date,
                            duration
                        );

                        return {
                            doctor: {
                                id: doctor.id,
                                name: doctor.name,
                                specialty: doctor.especialidad,
                                phone: doctor.telefono,
                                email: doctor.email
                            },
                            availableSlots: availability.data.availableSlots,
                            totalSlots: availability.data.availableSlots.length,
                            workingHours: availability.data.workingHours
                        };
                    } catch (error) {
                        console.error(`Error getting availability for doctor ${doctor.id}:`, error);
                        return {
                            doctor: {
                                id: doctor.id,
                                name: doctor.name,
                                specialty: doctor.especialidad,
                                phone: doctor.telefono,
                                email: doctor.email
                            },
                            availableSlots: [],
                            totalSlots: 0,
                            error: error.message
                        };
                    }
                })
            );

            // Aggregate all available slots by time
            const allSlots = {};
            doctorSlots.forEach(doctorData => {
                doctorData.availableSlots.forEach(slot => {
                    const timeKey = slot.startTime;
                    if (!allSlots[timeKey]) {
                        allSlots[timeKey] = {
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            duration: slot.duration,
                            availableDoctors: []
                        };
                    }
                    allSlots[timeKey].availableDoctors.push(doctorData.doctor);
                });
            });

            // Convert to array and sort by time
            const aggregatedSlots = Object.values(allSlots).sort((a, b) =>
                new Date(a.startTime) - new Date(b.startTime)
            );

            return {
                success: true,
                data: {
                    date,
                    duration,
                    requestedDoctors: doctorIds,
                    specialty,
                    doctorAvailability: doctorSlots,
                    aggregatedSlots,
                    summary: {
                        totalDoctors: doctors.length,
                        doctorsWithSlots: doctorSlots.filter(d => d.totalSlots > 0).length,
                        totalAvailableSlots: aggregatedSlots.length,
                        bestTimeSlots: aggregatedSlots
                            .filter(slot => slot.availableDoctors.length > 1)
                            .slice(0, 5)
                    }
                }
            };

        } catch (error) {
            console.error('Find available slots error:', error);
            throw new Error('Failed to find available slots');
        }
    }

    /**
     * Get appointment color based on status and type
     */
    getAppointmentColor(status, type) {
        const statusColors = {
            'PROGRAMADA': '#3B82F6', // Blue
            'CONFIRMADA': '#10B981', // Green
            'EN_CURSO': '#F59E0B', // Amber
            'COMPLETADA': '#6B7280', // Gray
            'CANCELADA': '#EF4444', // Red
            'NO_ASISTIO': '#F97316', // Orange
            'REPROGRAMADA': '#8B5CF6' // Purple
        };

        const typeColors = {
            'URGENCIA': '#DC2626', // Red for urgent
            'CIRUGIA': '#7C2D12', // Dark red for surgery
            'PRIMERA_VEZ': '#059669', // Green for new patients
            'SEGUIMIENTO': '#0D9488', // Teal for follow-up
            'CONTROL': '#0891B2', // Sky blue for control
            'CONSULTA_GENERAL': '#4F46E5', // Indigo for general
            'POST_OPERATORIO': '#BE185D' // Pink for post-op
        };

        // Priority: urgent types override status colors
        if (type === 'URGENCIA' || type === 'CIRUGIA') {
            return typeColors[type];
        }

        return statusColors[status] || '#6B7280';
    }

    /**
     * Get calendar events for external calendar integration
     */
    async getCalendarEvents(startDate, endDate, doctorId = null, format = 'ical') {
        try {
            const calendarData = await this.getCalendarView('agenda', startDate, endDate, doctorId);
            const appointments = calendarData.data.appointments;

            if (format === 'ical') {
                return this.generateICalFormat(appointments);
            } else if (format === 'google') {
                return this.generateGoogleCalendarFormat(appointments);
            } else {
                return {
                    success: true,
                    data: appointments
                };
            }

        } catch (error) {
            console.error('Get calendar events error:', error);
            throw new Error('Failed to get calendar events');
        }
    }

    /**
     * Generate iCal format for calendar export
     */
    generateICalFormat(appointments) {
        let ical = 'BEGIN:VCALENDAR\n';
        ical += 'VERSION:2.0\n';
        ical += 'PRODID:-//EcoDigital//Medical Calendar//EN\n';
        ical += 'CALSCALE:GREGORIAN\n';

        appointments.forEach(apt => {
            const startDate = new Date(apt.start);
            const endDate = new Date(apt.end);

            ical += 'BEGIN:VEVENT\n';
            ical += `UID:${apt.id}@ecodigital.com\n`;
            ical += `DTSTART:${this.formatICalDate(startDate)}\n`;
            ical += `DTEND:${this.formatICalDate(endDate)}\n`;
            ical += `SUMMARY:${apt.title}\n`;
            ical += `DESCRIPTION:Paciente: ${apt.patient.name}\\nTipo: ${apt.type}\\nMotivo: ${apt.details.reason}\n`;
            ical += `LOCATION:${apt.details.room || 'Consultorio'}\n`;
            ical += `STATUS:${apt.status === 'CONFIRMADA' ? 'CONFIRMED' : 'TENTATIVE'}\n`;
            ical += 'END:VEVENT\n';
        });

        ical += 'END:VCALENDAR\n';

        return {
            success: true,
            data: ical,
            contentType: 'text/calendar',
            filename: `appointments_${new Date().toISOString().split('T')[0]}.ics`
        };
    }

    /**
     * Format date for iCal
     */
    formatICalDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    /**
     * Generate Google Calendar format
     */
    generateGoogleCalendarFormat(appointments) {
        const events = appointments.map(apt => ({
            summary: apt.title,
            description: `Paciente: ${apt.patient.name}\nTipo: ${apt.type}\nMotivo: ${apt.details.reason}`,
            start: {
                dateTime: apt.start,
                timeZone: 'America/Mexico_City'
            },
            end: {
                dateTime: apt.end,
                timeZone: 'America/Mexico_City'
            },
            location: apt.details.room || 'Consultorio',
            status: apt.status === 'CONFIRMADA' ? 'confirmed' : 'tentative',
            colorId: this.getGoogleCalendarColorId(apt.status)
        }));

        return {
            success: true,
            data: events,
            format: 'google_calendar'
        };
    }

    /**
     * Get Google Calendar color ID based on appointment status
     */
    getGoogleCalendarColorId(status) {
        const colorMap = {
            'PROGRAMADA': '1', // Blue
            'CONFIRMADA': '2', // Green
            'EN_CURSO': '5', // Yellow
            'COMPLETADA': '8', // Gray
            'CANCELADA': '11', // Red
            'NO_ASISTIO': '6', // Orange
            'REPROGRAMADA': '3' // Purple
        };

        return colorMap[status] || '1';
    }

    /**
     * Get calendar summary for dashboard
     */
    async getCalendarSummary(doctorId = null) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Get today's appointments
            const todayData = await this.getCalendarView('day', today, today + ' 23:59:59', doctorId);

            // Get tomorrow's appointments
            const tomorrowData = await this.getCalendarView('day', tomorrow, tomorrow + ' 23:59:59', doctorId);

            // Get this week's stats
            const weekStats = await this.getCalendarStats(today, weekEnd, doctorId);

            return {
                success: true,
                data: {
                    today: {
                        date: today,
                        appointments: todayData.data.appointments,
                        count: todayData.data.appointments.length,
                        next: todayData.data.appointments
                            .filter(apt => new Date(apt.start) > new Date())
                            .slice(0, 3)
                    },
                    tomorrow: {
                        date: tomorrow,
                        appointments: tomorrowData.data.appointments,
                        count: tomorrowData.data.appointments.length
                    },
                    thisWeek: {
                        stats: weekStats.data,
                        period: { start: today, end: weekEnd }
                    }
                }
            };

        } catch (error) {
            console.error('Get calendar summary error:', error);
            throw new Error('Failed to get calendar summary');
        }
    }
}

module.exports = new CalendarService();