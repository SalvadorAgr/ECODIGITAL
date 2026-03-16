/**
 * Integration Service
 * Connects new Python services with existing Node.js appointment system
 */

const { getPool } = require('../db');
const { spawn } = require('child_process');
const path = require('path');

class IntegrationService {
    constructor() {
        this.pythonServicePath = path.join(__dirname, '../../src/backend');
        this.serviceCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Execute Python service method
     * @param {string} serviceName - Name of the Python service
     * @param {string} method - Method to call
     * @param {Object} params - Parameters to pass
     * @returns {Promise<Object>} Service response
     */
    async callPythonService(serviceName, method, params = {}) {
        try {
            const cacheKey = `${serviceName}_${method}_${JSON.stringify(params)}`;

            // Check cache for non-mutating operations
            if (this._isReadOnlyOperation(method) && this.serviceCache.has(cacheKey)) {
                const cached = this.serviceCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const pythonScript = path.join(this.pythonServicePath, 'integration_bridge.py');

            const result = await new Promise((resolve, reject) => {
                const python = spawn('python3', [
                    pythonScript,
                    serviceName,
                    method,
                    JSON.stringify(params)
                ]);

                let stdout = '';
                let stderr = '';

                python.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                python.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                python.on('close', (code) => {
                    if (code === 0) {
                        try {
                            const response = JSON.parse(stdout);
                            resolve(response);
                        } catch (e) {
                            reject(new Error(`Failed to parse Python service response: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`Python service failed with code ${code}: ${stderr}`));
                    }
                });

                python.on('error', (error) => {
                    reject(new Error(`Failed to start Python service: ${error.message}`));
                });
            });

            // Cache read-only results
            if (this._isReadOnlyOperation(method)) {
                this.serviceCache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
            }

            return result;

        } catch (error) {
            console.error(`Error calling Python service ${serviceName}.${method}:`, error);
            throw error;
        }
    }

    /**
     * Resource Management Integration
     */
    async checkResourceAvailability(resourceId, startTime, endTime) {
        try {
            return await this.callPythonService('resource_manager', 'check_resource_availability', {
                resource_id: resourceId,
                start_time: startTime,
                end_time: endTime
            });
        } catch (error) {
            console.error('Error checking resource availability:', error);
            return false;
        }
    }

    async createResourceBooking(bookingRequest, userId) {
        try {
            return await this.callPythonService('resource_manager', 'create_booking', {
                booking_request: bookingRequest,
                user_id: userId
            });
        } catch (error) {
            console.error('Error creating resource booking:', error);
            throw error;
        }
    }

    async getResourceConflicts(resourceId, startTime, endTime, excludeBookingId = null) {
        try {
            return await this.callPythonService('resource_manager', 'check_resource_conflicts', {
                resource_id: resourceId,
                start_time: startTime,
                end_time: endTime,
                exclude_booking_id: excludeBookingId
            });
        } catch (error) {
            console.error('Error checking resource conflicts:', error);
            return [];
        }
    }

    /**
     * Priority Management Integration
     */
    async calculatePriorityScore(priority, isUrgent = false, waitTimeHours = 0, appointmentType = null) {
        try {
            return await this.callPythonService('priority_manager', 'calculate_priority_score', {
                prioridad: priority,
                es_urgente: isUrgent,
                tiempo_espera_horas: waitTimeHours,
                tipo_cita: appointmentType
            });
        } catch (error) {
            console.error('Error calculating priority score:', error);
            return 50; // Default normal priority
        }
    }

    async assignAppointmentPriority(appointmentId, newPriority, userId, reason = null, isUrgent = false) {
        try {
            return await this.callPythonService('priority_manager', 'assign_priority', {
                cita_id: appointmentId,
                nueva_prioridad: newPriority,
                usuario_id: userId,
                motivo: reason,
                es_urgente: isUrgent
            });
        } catch (error) {
            console.error('Error assigning appointment priority:', error);
            throw error;
        }
    }

    async getPriorityOrderedAppointments(filters = {}) {
        try {
            return await this.callPythonService('priority_manager', 'get_priority_ordered_appointments', filters);
        } catch (error) {
            console.error('Error getting priority-ordered appointments:', error);
            return [];
        }
    }

    /**
     * Schedule Exception Management Integration
     */
    async checkScheduleExceptions(providerId, startTime, endTime) {
        try {
            return await this.callPythonService('schedule_exception_manager', 'check_exceptions_in_range', {
                provider_id: providerId,
                start_time: startTime,
                end_time: endTime
            });
        } catch (error) {
            console.error('Error checking schedule exceptions:', error);
            return [];
        }
    }

    async createScheduleException(exceptionData, userId) {
        try {
            return await this.callPythonService('schedule_exception_manager', 'create_exception', {
                exception_data: exceptionData,
                user_id: userId
            });
        } catch (error) {
            console.error('Error creating schedule exception:', error);
            throw error;
        }
    }

    /**
     * Mobile Sync Integration
     */
    async syncMobileData(deviceId, syncData) {
        try {
            return await this.callPythonService('mobile_sync_service', 'sync_device_data', {
                device_id: deviceId,
                sync_data: syncData
            });
        } catch (error) {
            console.error('Error syncing mobile data:', error);
            throw error;
        }
    }

    async getMobileConflicts(deviceId, localChanges) {
        try {
            return await this.callPythonService('mobile_sync_service', 'detect_conflicts', {
                device_id: deviceId,
                local_changes: localChanges
            });
        } catch (error) {
            console.error('Error getting mobile conflicts:', error);
            return [];
        }
    }

    /**
     * Enhanced Appointment Creation with New Services
     */
    async createEnhancedAppointment(appointmentData, userId) {
        const pool = getPool();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Calculate priority score
            const priorityScore = await this.calculatePriorityScore(
                appointmentData.prioridad || 'NORMAL',
                appointmentData.es_urgente || false,
                0,
                appointmentData.tipo_cita
            );

            // 2. Check resource availability if resources are specified
            if (appointmentData.recursos && appointmentData.recursos.length > 0) {
                for (const resource of appointmentData.recursos) {
                    const isAvailable = await this.checkResourceAvailability(
                        resource.id,
                        appointmentData.fecha_hora,
                        new Date(new Date(appointmentData.fecha_hora).getTime() +
                            (appointmentData.duracion_minutos * 60000))
                    );

                    if (!isAvailable) {
                        throw new Error(`Resource ${resource.nombre} is not available at the requested time`);
                    }
                }
            }

            // 3. Check schedule exceptions
            const exceptions = await this.checkScheduleExceptions(
                appointmentData.medico_id,
                appointmentData.fecha_hora,
                new Date(new Date(appointmentData.fecha_hora).getTime() +
                    (appointmentData.duracion_minutos * 60000))
            );

            if (exceptions.length > 0) {
                throw new Error(`Provider has schedule exceptions during the requested time: ${exceptions.map(e => e.motivo).join(', ')}`);
            }

            // 4. Create the appointment with enhanced data
            const enhancedAppointmentData = {
                ...appointmentData,
                puntuacion_prioridad: priorityScore,
                creado_por: userId
            };

            const [result] = await connection.execute(`
                INSERT INTO CITAS (
                    id_paciente, medico_id, fecha_hora, duracion_minutos,
                    tipo_cita, especialidad, motivo, observaciones,
                    prioridad, puntuacion_prioridad, es_urgente,
                    telefono_contacto, email_contacto,
                    costo_consulta, seguro_medico, copago,
                    sala_consulta, equipos_necesarios, preparacion_especial,
                    creado_por
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                enhancedAppointmentData.id_paciente,
                enhancedAppointmentData.medico_id,
                enhancedAppointmentData.fecha_hora,
                enhancedAppointmentData.duracion_minutos,
                enhancedAppointmentData.tipo_cita,
                enhancedAppointmentData.especialidad,
                enhancedAppointmentData.motivo,
                enhancedAppointmentData.observaciones,
                enhancedAppointmentData.prioridad || 'NORMAL',
                priorityScore,
                enhancedAppointmentData.es_urgente || false,
                enhancedAppointmentData.telefono_contacto,
                enhancedAppointmentData.email_contacto,
                enhancedAppointmentData.costo_consulta,
                enhancedAppointmentData.seguro_medico,
                enhancedAppointmentData.copago,
                enhancedAppointmentData.sala_consulta,
                JSON.stringify(enhancedAppointmentData.equipos_necesarios),
                enhancedAppointmentData.preparacion_especial,
                userId
            ]);

            const appointmentId = result.insertId;

            // 5. Create resource bookings if specified
            if (appointmentData.recursos && appointmentData.recursos.length > 0) {
                for (const resource of appointmentData.recursos) {
                    const bookingRequest = {
                        recurso_id: resource.id,
                        solicitante_id: userId,
                        fecha_inicio: appointmentData.fecha_hora,
                        fecha_fin: new Date(new Date(appointmentData.fecha_hora).getTime() +
                            (appointmentData.duracion_minutos * 60000)),
                        motivo_reserva: `Appointment: ${appointmentData.motivo}`,
                        tipo_reserva: 'CITA_MEDICA',
                        prioridad: appointmentData.prioridad || 'NORMAL',
                        cita_id: appointmentId
                    };

                    await this.createResourceBooking(bookingRequest, userId);
                }
            }

            await connection.commit();

            return {
                success: true,
                appointmentId: appointmentId,
                priorityScore: priorityScore,
                message: 'Enhanced appointment created successfully'
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Enhanced Appointment Update with Conflict Detection
     */
    async updateEnhancedAppointment(appointmentId, updates, userId) {
        const pool = getPool();

        try {
            // Get current appointment data
            const [currentRows] = await pool.execute(
                'SELECT * FROM CITAS WHERE id = ? AND activo = TRUE',
                [appointmentId]
            );

            if (currentRows.length === 0) {
                throw new Error('Appointment not found');
            }

            const currentAppointment = currentRows[0];

            // Check for conflicts if time or resources are being changed
            if (updates.fecha_hora || updates.duracion_minutos) {
                const newStartTime = updates.fecha_hora || currentAppointment.fecha_hora;
                const newDuration = updates.duracion_minutos || currentAppointment.duracion_minutos;
                const newEndTime = new Date(new Date(newStartTime).getTime() + (newDuration * 60000));

                // Check schedule exceptions
                const exceptions = await this.checkScheduleExceptions(
                    currentAppointment.medico_id,
                    newStartTime,
                    newEndTime
                );

                if (exceptions.length > 0) {
                    throw new Error(`Provider has schedule exceptions during the new time: ${exceptions.map(e => e.motivo).join(', ')}`);
                }

                // Check resource conflicts if appointment has resources
                if (currentAppointment.equipos_necesarios) {
                    try {
                        const recursos = JSON.parse(currentAppointment.equipos_necesarios);
                        for (const resource of recursos) {
                            const conflicts = await this.getResourceConflicts(
                                resource.id,
                                newStartTime,
                                newEndTime,
                                appointmentId
                            );

                            if (conflicts.length > 0) {
                                throw new Error(`Resource conflicts detected for ${resource.nombre}`);
                            }
                        }
                    } catch (parseError) {
                        console.warn('Could not parse equipment data for conflict checking');
                    }
                }
            }

            // Recalculate priority score if priority-related fields are updated
            let newPriorityScore = currentAppointment.puntuacion_prioridad;
            if (updates.prioridad || updates.es_urgente !== undefined) {
                const waitTimeHours = Math.floor(
                    (Date.now() - new Date(currentAppointment.fecha_creacion).getTime()) / (1000 * 60 * 60)
                );

                newPriorityScore = await this.calculatePriorityScore(
                    updates.prioridad || currentAppointment.prioridad,
                    updates.es_urgente !== undefined ? updates.es_urgente : currentAppointment.es_urgente,
                    waitTimeHours,
                    currentAppointment.tipo_cita
                );
            }

            // Build update query
            const updateFields = [];
            const updateValues = [];

            Object.keys(updates).forEach(field => {
                if (field !== 'id' && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            });

            if (newPriorityScore !== currentAppointment.puntuacion_prioridad) {
                updateFields.push('puntuacion_prioridad = ?');
                updateValues.push(newPriorityScore);
            }

            updateFields.push('modificado_por = ?', 'fecha_modificacion = NOW()');
            updateValues.push(userId);
            updateValues.push(appointmentId);

            const updateQuery = `
                UPDATE CITAS 
                SET ${updateFields.join(', ')}
                WHERE id = ? AND activo = TRUE
            `;

            const [result] = await pool.execute(updateQuery, updateValues);

            if (result.affectedRows === 0) {
                throw new Error('Appointment not found or could not be updated');
            }

            return {
                success: true,
                appointmentId: appointmentId,
                priorityScore: newPriorityScore,
                message: 'Enhanced appointment updated successfully'
            };

        } catch (error) {
            console.error('Error updating enhanced appointment:', error);
            throw error;
        }
    }

    /**
     * Get Enhanced Appointment Data
     */
    async getEnhancedAppointmentData(appointmentId) {
        const pool = getPool();

        try {
            // Get appointment with related data
            const [appointmentRows] = await pool.execute(`
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                    p.telefono as telefono_paciente,
                    p.email as email_paciente,
                    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                    u.especialidad as especialidad_medico
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                JOIN USUARIOS u ON c.medico_id = u.id
                WHERE c.id = ? AND c.activo = TRUE
            `, [appointmentId]);

            if (appointmentRows.length === 0) {
                return null;
            }

            const appointment = appointmentRows[0];

            // Get priority information
            const priorityInfo = await this.callPythonService('priority_manager', 'get_appointment_priority_info', {
                cita_id: appointmentId
            });

            // Get resource bookings
            const [resourceRows] = await pool.execute(`
                SELECT 
                    rr.*,
                    r.nombre as nombre_recurso,
                    r.tipo_recurso,
                    r.ubicacion
                FROM RESERVAS_RECURSOS rr
                JOIN RECURSOS r ON rr.recurso_id = r.id
                WHERE rr.cita_id = ? AND rr.activo = TRUE
            `, [appointmentId]);

            return {
                ...appointment,
                priority_info: priorityInfo,
                resource_bookings: resourceRows,
                enhanced_data: true
            };

        } catch (error) {
            console.error('Error getting enhanced appointment data:', error);
            throw error;
        }
    }

    /**
     * Utility Methods
     */
    _isReadOnlyOperation(method) {
        const readOnlyMethods = [
            'check_resource_availability',
            'check_resource_conflicts',
            'get_priority_ordered_appointments',
            'check_exceptions_in_range',
            'calculate_priority_score',
            'get_appointment_priority_info'
        ];
        return readOnlyMethods.includes(method);
    }

    /**
     * Clear service cache
     */
    clearCache() {
        this.serviceCache.clear();
    }

    /**
     * Health check for Python services
     */
    async healthCheck() {
        try {
            const services = ['resource_manager', 'priority_manager', 'schedule_exception_manager', 'mobile_sync_service'];
            const results = {};

            for (const service of services) {
                try {
                    await this.callPythonService(service, 'health_check', {});
                    results[service] = 'healthy';
                } catch (error) {
                    results[service] = 'unhealthy';
                }
            }

            return results;
        } catch (error) {
            console.error('Error performing health check:', error);
            return { error: error.message };
        }
    }
}

module.exports = new IntegrationService();