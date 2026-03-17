const express = require('express');
const { getPool } = require('../db');
const OptimizationEngine = require('../services/optimizationEngine');

const router = express.Router();

// Initialize optimization engine
const optimizationEngine = new OptimizationEngine();

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

// POST /api/v1/optimization/schedule - Optimize schedule for provider and date range
router.post('/schedule', async (req, res) => {
    try {
        const {
            providerId,
            startDate,
            endDate,
            options = {}
        } = req.body;

        // Validation
        const errors = [];
        if (!providerId || isNaN(parseInt(providerId))) {
            errors.push('Valid provider ID is required');
        }
        if (!startDate) {
            errors.push('Start date is required');
        }
        if (!endDate) {
            errors.push('End date is required');
        }

        // Validate date range
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start >= end) {
                errors.push('End date must be after start date');
            }

            const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) {
                errors.push('Date range cannot exceed 30 days');
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Check if provider exists
        const pool = getPool();
        const providerCheck = await pool.query(
            'SELECT id, nombres, apellidos, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\') AND activo = TRUE',
            [providerId]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or not authorized'
            });
        }

        const provider = providerCheck.rows[0];

        // Perform schedule optimization
        const result = await optimizationEngine.optimizeSchedule(
            providerId,
            new Date(startDate),
            new Date(endDate),
            options
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...result.data,
                provider: {
                    id: provider.id,
                    name: `${provider.nombres} ${provider.apellidos}`,
                    specialty: provider.especialidad
                }
            },
            message: 'Schedule optimization completed successfully'
        });

    } catch (error) {
        console.error('Error optimizing schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/optimization/utilization - Maximize provider utilization
router.post('/utilization', async (req, res) => {
    try {
        const {
            providerId,
            date,
            constraints = {}
        } = req.body;

        // Validation
        const errors = [];
        if (!providerId || isNaN(parseInt(providerId))) {
            errors.push('Valid provider ID is required');
        }
        if (!date) {
            errors.push('Date is required');
        }

        // Validate date is not in the past
        if (date && new Date(date) < new Date().setHours(0, 0, 0, 0)) {
            errors.push('Date cannot be in the past');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Check if provider exists
        const pool = getPool();
        const providerCheck = await pool.query(
            'SELECT id, nombres, apellidos, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\') AND activo = TRUE',
            [providerId]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or not authorized'
            });
        }

        const provider = providerCheck.rows[0];

        // Perform utilization maximization
        const result = await optimizationEngine.maximizeUtilization(
            providerId,
            new Date(date),
            constraints
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...result.data,
                provider: {
                    id: provider.id,
                    name: `${provider.nombres} ${provider.apellidos}`,
                    specialty: provider.especialidad
                }
            },
            message: 'Utilization optimization completed successfully'
        });

    } catch (error) {
        console.error('Error maximizing utilization:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/optimization/wait-times - Minimize patient wait times
router.post('/wait-times', async (req, res) => {
    try {
        const {
            providerId,
            date,
            appointmentRequests = []
        } = req.body;

        // Validation
        const errors = [];
        if (!providerId || isNaN(parseInt(providerId))) {
            errors.push('Valid provider ID is required');
        }
        if (!date) {
            errors.push('Date is required');
        }

        // Validate date is not in the past
        if (date && new Date(date) < new Date().setHours(0, 0, 0, 0)) {
            errors.push('Date cannot be in the past');
        }

        // Validate appointment requests format
        if (appointmentRequests.length > 0) {
            appointmentRequests.forEach((request, index) => {
                if (!request.id_paciente) {
                    errors.push(`Appointment request ${index + 1}: Patient ID is required`);
                }
                if (!request.tipo_cita) {
                    errors.push(`Appointment request ${index + 1}: Appointment type is required`);
                }
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Check if provider exists
        const pool = getPool();
        const providerCheck = await pool.query(
            'SELECT id, nombres, apellidos, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\') AND activo = TRUE',
            [providerId]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or not authorized'
            });
        }

        const provider = providerCheck.rows[0];

        // Perform wait time minimization
        const result = await optimizationEngine.minimizeWaitTimes(
            providerId,
            new Date(date),
            appointmentRequests
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...result.data,
                provider: {
                    id: provider.id,
                    name: `${provider.nombres} ${provider.apellidos}`,
                    specialty: provider.especialidad
                }
            },
            message: 'Wait time optimization completed successfully'
        });

    } catch (error) {
        console.error('Error minimizing wait times:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/optimization/metrics/:providerId - Get optimization metrics for a provider
router.get('/metrics/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        const {
            startDate,
            endDate,
            includeRecommendations = 'true'
        } = req.query;

        // Validation
        if (!providerId || isNaN(parseInt(providerId))) {
            return res.status(400).json({
                success: false,
                error: 'Valid provider ID is required'
            });
        }

        // Set default date range if not provided (last 30 days)
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Check if provider exists
        const pool = getPool();
        const providerCheck = await pool.query(
            'SELECT id, nombres, apellidos, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\') AND activo = TRUE',
            [providerId]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or not authorized'
            });
        }

        const provider = providerCheck.rows[0];

        // Get schedule data and analyze performance
        const scheduleData = await optimizationEngine.getScheduleData(providerId, start, end);
        const performanceMetrics = await optimizationEngine.analyzeSchedulePerformance(scheduleData);

        let recommendations = [];
        if (includeRecommendations === 'true') {
            recommendations = await optimizationEngine.generateOptimizationRecommendations(
                scheduleData,
                performanceMetrics,
                optimizationEngine.config
            );
        }

        res.status(200).json({
            success: true,
            data: {
                provider: {
                    id: provider.id,
                    name: `${provider.nombres} ${provider.apellidos}`,
                    specialty: provider.especialidad
                },
                dateRange: { startDate: start, endDate: end },
                metrics: performanceMetrics,
                recommendations: includeRecommendations === 'true' ? recommendations : undefined,
                optimizationScore: optimizationEngine.calculateOptimizationScore({
                    utilizationImprovement: Math.max(0.8 - performanceMetrics.utilization, 0),
                    waitTimeReduction: Math.max(performanceMetrics.averageWaitTime - 15, 0),
                    efficiencyImprovement: Math.max(0.85 - performanceMetrics.onTimeRate, 0)
                })
            },
            message: 'Optimization metrics retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting optimization metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/optimization/recommendations/:providerId - Get optimization recommendations
router.get('/recommendations/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        const {
            startDate,
            endDate,
            priority = 'all'
        } = req.query;

        // Validation
        if (!providerId || isNaN(parseInt(providerId))) {
            return res.status(400).json({
                success: false,
                error: 'Valid provider ID is required'
            });
        }

        // Set default date range if not provided (next 7 days)
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Check if provider exists
        const pool = getPool();
        const providerCheck = await pool.query(
            'SELECT id, nombres, apellidos, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\') AND activo = TRUE',
            [providerId]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or not authorized'
            });
        }

        const provider = providerCheck.rows[0];

        // Get schedule data and generate recommendations
        const scheduleData = await optimizationEngine.getScheduleData(providerId, start, end);
        const performanceMetrics = await optimizationEngine.analyzeSchedulePerformance(scheduleData);
        const recommendations = await optimizationEngine.generateOptimizationRecommendations(
            scheduleData,
            performanceMetrics,
            optimizationEngine.config
        );

        // Filter by priority if specified
        let filteredRecommendations = recommendations;
        if (priority !== 'all') {
            filteredRecommendations = recommendations.filter(rec =>
                rec.priority.toLowerCase() === priority.toLowerCase()
            );
        }

        res.status(200).json({
            success: true,
            data: {
                provider: {
                    id: provider.id,
                    name: `${provider.nombres} ${provider.apellidos}`,
                    specialty: provider.especialidad
                },
                dateRange: { startDate: start, endDate: end },
                recommendations: filteredRecommendations,
                totalRecommendations: recommendations.length,
                filteredCount: filteredRecommendations.length,
                priorityBreakdown: {
                    high: recommendations.filter(r => r.priority === 'HIGH').length,
                    medium: recommendations.filter(r => r.priority === 'MEDIUM').length,
                    low: recommendations.filter(r => r.priority === 'LOW').length
                }
            },
            message: 'Optimization recommendations retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting optimization recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/optimization/simulate - Simulate optimization results
router.post('/simulate', async (req, res) => {
    try {
        const {
            providerId,
            date,
            modifications = []
        } = req.body;

        // Validation
        const errors = [];
        if (!providerId || isNaN(parseInt(providerId))) {
            errors.push('Valid provider ID is required');
        }
        if (!date) {
            errors.push('Date is required');
        }
        if (!Array.isArray(modifications)) {
            errors.push('Modifications must be an array');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Check if provider exists
        const pool = getPool();
        const providerCheck = await pool.query(
            'SELECT id, nombres, apellidos, especialidad FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\') AND activo = TRUE',
            [providerId]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or not authorized'
            });
        }

        const provider = providerCheck.rows[0];

        // Get current schedule
        const currentSchedule = await optimizationEngine.getCurrentSchedule(providerId, new Date(date));
        const currentMetrics = await optimizationEngine.analyzeSchedulePerformance(currentSchedule);

        // Simulate the modifications
        const simulatedSchedule = { modifications };
        const simulatedMetrics = await optimizationEngine.simulateOptimizedMetrics(simulatedSchedule);
        const improvementMetrics = await optimizationEngine.calculateImprovementMetrics(currentMetrics, simulatedSchedule);

        res.status(200).json({
            success: true,
            data: {
                provider: {
                    id: provider.id,
                    name: `${provider.nombres} ${provider.apellidos}`,
                    specialty: provider.especialidad
                },
                date,
                currentMetrics,
                simulatedMetrics,
                improvementMetrics,
                optimizationScore: optimizationEngine.calculateOptimizationScore(improvementMetrics),
                modifications: modifications.length
            },
            message: 'Optimization simulation completed successfully'
        });

    } catch (error) {
        console.error('Error simulating optimization:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;