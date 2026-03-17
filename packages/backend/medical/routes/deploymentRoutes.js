/**
 * Blue-Green Deployment Management Routes
 * 
 * API endpoints for managing blue-green deployments
 */

const express = require('express');
const router = express.Router();
const {
    deploymentHealthCheck,
    getDeploymentConfig,
    updateDeploymentConfig,
    incrementRollout,
    completeRollout,
    rollbackToBlue,
    initializeGreenDeployment
} = require('../middleware/blueGreenDeployment');

/**
 * GET /api/v1/deployment/status
 * Get current deployment status
 */
router.get('/status', deploymentHealthCheck);

/**
 * GET /api/v1/deployment/config
 * Get deployment configuration
 */
router.get('/config', (req, res) => {
    try {
        const config = getDeploymentConfig();
        res.status(200).json({
            success: true,
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment config',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/deployment/initialize
 * Initialize a new green deployment
 * Body: { version: "1.1.0" }
 */
router.post('/initialize', async (req, res) => {
    try {
        const { version } = req.body;

        if (!version) {
            return res.status(400).json({
                success: false,
                error: 'Version is required'
            });
        }

        const config = await initializeGreenDeployment(version);

        res.status(200).json({
            success: true,
            message: `Green deployment initialized with version ${version}`,
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to initialize green deployment',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/deployment/increment
 * Increment green rollout percentage
 * Body: { percentage: 10 } (optional, defaults to 10)
 */
router.post('/increment', async (req, res) => {
    try {
        const { percentage = 10 } = req.body;

        if (percentage < 0 || percentage > 100) {
            return res.status(400).json({
                success: false,
                error: 'Percentage must be between 0 and 100'
            });
        }

        const config = await incrementRollout(percentage);

        res.status(200).json({
            success: true,
            message: `Rollout increased to ${config.greenRolloutPercent}%`,
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to increment rollout',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/deployment/complete
 * Complete rollout to green (100%)
 */
router.post('/complete', async (req, res) => {
    try {
        const config = await completeRollout();

        res.status(200).json({
            success: true,
            message: 'Rollout completed. Green is now production.',
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to complete rollout',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/deployment/rollback
 * Rollback to blue environment
 */
router.post('/rollback', async (req, res) => {
    try {
        const config = await rollbackToBlue();

        res.status(200).json({
            success: true,
            message: 'Rolled back to blue environment',
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to rollback',
            message: error.message
        });
    }
});

/**
 * PUT /api/v1/deployment/config
 * Update deployment configuration
 * Body: { greenRolloutPercent: 50, greenVersion: "1.1.0" }
 */
router.put('/config', async (req, res) => {
    try {
        const updates = req.body;

        // Validate updates
        if (updates.greenRolloutPercent !== undefined) {
            if (updates.greenRolloutPercent < 0 || updates.greenRolloutPercent > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'greenRolloutPercent must be between 0 and 100'
                });
            }
        }

        const config = updateDeploymentConfig(updates);

        res.status(200).json({
            success: true,
            message: 'Deployment configuration updated',
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update deployment config',
            message: error.message
        });
    }
});

module.exports = router;
