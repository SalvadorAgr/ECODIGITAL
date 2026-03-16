/**
 * EcoDigital - Export Service
 * Service for exporting data to various formats (CSV, Excel, PDF)
 */

const { query } = require('../db');

class ExportService {
    constructor() {
        this.supportedFormats = ['csv', 'excel', 'json'];
    }

    /**
     * Export patients data
     */
    async exportPatients(filters = {}, format = 'csv', userId = null) {
        try {
            // Build query with filters
            let baseQuery = `
                SELECT 
                    p.id,
                    p.nombre,
                    p.apellido,
                    p.cedula,
                    p.fecha_nacimiento,
                    EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad,
                    p.genero,
                    p.telefono,
                    p.email,
                    p.ciudad,
                    p.provincia,
                    p.tipo_sangre,
                    p.seguro_medico,
                    p.numero_expediente,
                    p.fecha_primera_consulta,
                    p.fecha_ultima_consulta,
                    CASE WHEN p.activo THEN 'Activo' ELSE 'Inactivo' END as estado,
                    p.fecha_creacion
                FROM PACIENTES p
                WHERE 1=1
            `;

            const params = [];
            let paramIndex = 1;

            // Apply filters
            if (filters.activo !== undefined) {
                baseQuery += ` AND p.activo = $${paramIndex}`;
                params.push(filters.activo);
                paramIndex++;
            }

            if (filters.genero) {
                baseQuery += ` AND p.genero = $${paramIndex}`;
                params.push(filters.genero);
                paramIndex++;
            }

            if (filters.ciudad) {
                baseQuery += ` AND p.ciudad ILIKE $${paramIndex}`;
                params.push(`%${filters.ciudad}%`);
                paramIndex++;
            }

            if (filters.fecha_desde) {
                baseQuery += ` AND p.fecha_creacion >= $${paramIndex}`;
                params.push(filters.fecha_desde);
                paramIndex++;
            }

            if (filters.fecha_hasta) {
                baseQuery += ` AND p.fecha_creacion <= $${paramIndex}`;
                params.push(filters.fecha_hasta);
                paramIndex++;
            }

            baseQuery += ` ORDER BY p.apellido, p.nombre`;

            const { rows } = await query(baseQuery, params);

            // Log export activity
            if (userId) {
                await this.logExportActivity(userId, 'patients', format, rows.length, filters);
            }

            return this.formatData(rows, format, 'patients');

        } catch (error) {
            console.error('Export patients error:', error);
            throw new Error('Failed to export patients data');
        }
    }

    /**
     * Export clinical history data
     */
    async exportClinicalHistory(filters = {}, format = 'csv', userId = null) {
        try {
            let baseQuery = `
                SELECT 
                    h.id,
                    CONCAT(p.nombre, ' ', p.apellido) as paciente,
                    p.numero_expediente,
                    h.fecha_hora,
                    h.tipo_consulta,
                    h.motivo_consulta,
                    h.diagnostico_principal,
                    h.diagnosticos_secundarios,
                    h.codigo_cie10,
                    CONCAT(u.nombre, ' ', u.apellido) as medico,
                    h.estado_consulta,
                    CASE WHEN h.requiere_seguimiento THEN 'Sí' ELSE 'No' END as requiere_seguimiento,
                    CASE WHEN h.urgente THEN 'Sí' ELSE 'No' END as urgente,
                    h.peso,
                    h.altura,
                    h.imc,
                    h.plan_tratamiento,
                    h.recomendaciones,
                    h.fecha_creacion
                FROM HISTORIAL_CLINICO h
                JOIN PACIENTES p ON h.id_paciente = p.id
                LEFT JOIN USUARIOS u ON h.medico_id = u.id_usuario
                WHERE h.activo = TRUE
            `;

            const params = [];
            let paramIndex = 1;

            // Apply filters
            if (filters.paciente_id) {
                baseQuery += ` AND h.id_paciente = $${paramIndex}`;
                params.push(filters.paciente_id);
                paramIndex++;
            }

            if (filters.medico_id) {
                baseQuery += ` AND h.medico_id = $${paramIndex}`;
                params.push(filters.medico_id);
                paramIndex++;
            }

            if (filters.tipo_consulta) {
                baseQuery += ` AND h.tipo_consulta = $${paramIndex}`;
                params.push(filters.tipo_consulta);
                paramIndex++;
            }

            if (filters.fecha_desde) {
                baseQuery += ` AND h.fecha_hora >= $${paramIndex}`;
                params.push(filters.fecha_desde);
                paramIndex++;
            }

            if (filters.fecha_hasta) {
                baseQuery += ` AND h.fecha_hora <= $${paramIndex}`;
                params.push(filters.fecha_hasta);
                paramIndex++;
            }

            baseQuery += ` ORDER BY h.fecha_hora DESC`;

            const { rows } = await query(baseQuery, params);

            // Log export activity
            if (userId) {
                await this.logExportActivity(userId, 'clinical_history', format, rows.length, filters);
            }

            return this.formatData(rows, format, 'clinical_history');

        } catch (error) {
            console.error('Export clinical history error:', error);
            throw new Error('Failed to export clinical history data');
        }
    }

    /**
     * Export appointments data
     */
    async exportAppointments(filters = {}, format = 'csv', userId = null) {
        try {
            let baseQuery = `
                SELECT 
                    c.id,
                    c.numero_cita,
                    CONCAT(p.nombre, ' ', p.apellido) as paciente,
                    p.telefono as telefono_paciente,
                    c.fecha_hora,
                    c.tipo_cita,
                    c.motivo,
                    c.estado,
                    CONCAT(u.nombre, ' ', u.apellido) as medico,
                    c.duracion_estimada,
                    c.notas,
                    c.fecha_creacion
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                LEFT JOIN USUARIOS u ON c.medico_id = u.id_usuario
                WHERE c.activo = TRUE
            `;

            const params = [];
            let paramIndex = 1;

            // Apply filters
            if (filters.paciente_id) {
                baseQuery += ` AND c.id_paciente = $${paramIndex}`;
                params.push(filters.paciente_id);
                paramIndex++;
            }

            if (filters.medico_id) {
                baseQuery += ` AND c.medico_id = $${paramIndex}`;
                params.push(filters.medico_id);
                paramIndex++;
            }

            if (filters.estado) {
                baseQuery += ` AND c.estado = $${paramIndex}`;
                params.push(filters.estado);
                paramIndex++;
            }

            if (filters.fecha_desde) {
                baseQuery += ` AND c.fecha_hora >= $${paramIndex}`;
                params.push(filters.fecha_desde);
                paramIndex++;
            }

            if (filters.fecha_hasta) {
                baseQuery += ` AND c.fecha_hora <= $${paramIndex}`;
                params.push(filters.fecha_hasta);
                paramIndex++;
            }

            baseQuery += ` ORDER BY c.fecha_hora DESC`;

            const { rows } = await query(baseQuery, params);

            // Log export activity
            if (userId) {
                await this.logExportActivity(userId, 'appointments', format, rows.length, filters);
            }

            return this.formatData(rows, format, 'appointments');

        } catch (error) {
            console.error('Export appointments error:', error);
            throw new Error('Failed to export appointments data');
        }
    }

    /**
     * Format data according to specified format
     */
    formatData(data, format, dataType) {
        switch (format.toLowerCase()) {
            case 'csv':
                return this.formatAsCSV(data, dataType);
            case 'json':
                return this.formatAsJSON(data, dataType);
            case 'excel':
                return this.formatAsExcel(data, dataType);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    /**
     * Format data as CSV
     */
    formatAsCSV(data, dataType) {
        if (!data || data.length === 0) {
            return {
                content: '',
                filename: `${dataType}_${new Date().toISOString().split('T')[0]}.csv`,
                contentType: 'text/csv',
                size: 0
            };
        }

        // Get headers from first row
        const headers = Object.keys(data[0]);

        // Create CSV content
        let csvContent = headers.join(',') + '\n';

        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];

                // Handle null/undefined values
                if (value === null || value === undefined) {
                    return '';
                }

                // Convert to string and escape quotes
                value = String(value).replace(/"/g, '""');

                // Wrap in quotes if contains comma, newline, or quote
                if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                    value = `"${value}"`;
                }

                return value;
            });

            csvContent += values.join(',') + '\n';
        });

        return {
            content: csvContent,
            filename: `${dataType}_${new Date().toISOString().split('T')[0]}.csv`,
            contentType: 'text/csv',
            size: Buffer.byteLength(csvContent, 'utf8')
        };
    }

    /**
     * Format data as JSON
     */
    formatAsJSON(data, dataType) {
        const jsonContent = JSON.stringify({
            exportDate: new Date().toISOString(),
            dataType: dataType,
            recordCount: data.length,
            data: data
        }, null, 2);

        return {
            content: jsonContent,
            filename: `${dataType}_${new Date().toISOString().split('T')[0]}.json`,
            contentType: 'application/json',
            size: Buffer.byteLength(jsonContent, 'utf8')
        };
    }

    /**
     * Format data as Excel (simplified - returns CSV with Excel MIME type)
     * For full Excel support, would need a library like xlsx
     */
    formatAsExcel(data, dataType) {
        const csvData = this.formatAsCSV(data, dataType);

        return {
            ...csvData,
            filename: `${dataType}_${new Date().toISOString().split('T')[0]}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }

    /**
     * Log export activity for audit purposes
     */
    async logExportActivity(userId, dataType, format, recordCount, filters) {
        try {
            await query(`
                INSERT INTO LOGS_AUDITORIA (
                    tabla_afectada, 
                    tipo_operacion, 
                    id_usuario_autor,
                    fecha_hora,
                    detalles
                ) VALUES ($1, $2, $3, NOW(), $4)
            `, [
                dataType.toUpperCase(),
                'EXPORT',
                userId,
                JSON.stringify({
                    action: 'data_export',
                    format: format,
                    recordCount: recordCount,
                    filters: filters,
                    timestamp: new Date().toISOString()
                })
            ]);
        } catch (error) {
            console.error('Failed to log export activity:', error);
            // Don't throw error, just log it
        }
    }

    /**
     * Get export statistics for a user
     */
    async getExportStats(userId, dateFrom = null, dateTo = null) {
        try {
            let statsQuery = `
                SELECT 
                    tabla_afectada as data_type,
                    COUNT(*) as export_count,
                    SUM((detalles->>'recordCount')::int) as total_records_exported,
                    MAX(fecha_hora) as last_export
                FROM LOGS_AUDITORIA 
                WHERE tipo_operacion = 'EXPORT' 
                AND id_usuario_autor = $1
            `;

            const params = [userId];
            let paramIndex = 2;

            if (dateFrom) {
                statsQuery += ` AND fecha_hora >= $${paramIndex}`;
                params.push(dateFrom);
                paramIndex++;
            }

            if (dateTo) {
                statsQuery += ` AND fecha_hora <= $${paramIndex}`;
                params.push(dateTo);
                paramIndex++;
            }

            statsQuery += ` GROUP BY tabla_afectada ORDER BY export_count DESC`;

            const { rows } = await query(statsQuery, params);

            return {
                success: true,
                data: rows,
                summary: {
                    totalExports: rows.reduce((sum, row) => sum + parseInt(row.export_count), 0),
                    totalRecords: rows.reduce((sum, row) => sum + parseInt(row.total_records_exported || 0), 0)
                }
            };

        } catch (error) {
            console.error('Get export stats error:', error);
            throw new Error('Failed to retrieve export statistics');
        }
    }

    /**
     * Validate export request
     */
    validateExportRequest(dataType, format, filters = {}) {
        const errors = [];

        // Validate data type
        const validDataTypes = ['patients', 'clinical_history', 'appointments'];
        if (!validDataTypes.includes(dataType)) {
            errors.push(`Invalid data type. Must be one of: ${validDataTypes.join(', ')}`);
        }

        // Validate format
        if (!this.supportedFormats.includes(format.toLowerCase())) {
            errors.push(`Invalid format. Must be one of: ${this.supportedFormats.join(', ')}`);
        }

        // Validate date filters
        if (filters.fecha_desde && filters.fecha_hasta) {
            const fromDate = new Date(filters.fecha_desde);
            const toDate = new Date(filters.fecha_hasta);

            if (fromDate > toDate) {
                errors.push('Start date cannot be after end date');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = new ExportService();