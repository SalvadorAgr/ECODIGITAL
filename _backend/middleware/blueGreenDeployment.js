/**
 * Blue-Green Deployment Middleware
 * 
 * Implements zero-downtime deployments by routing traffic between
 * blue (current) and green (new) environments based on rollout percentage.
 */

const fs = require('fs');
const path = require('path');

// Configuration file path
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'deployment.json');

/**
 * Get current deployment configuration
 */
function getDeploymentConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading deployment config:', error);
    }

    // Default configuration
    return {
        greenRolloutPercent: 0,
        currentVersion: '1.0.0',
        greenVersion: '1.0.0',
        environment: 'blue',
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Update deployment configuration
 */
function updateDeploymentConfig(updates) {
    try {
        const config = getDeploymentConfig();
        const newConfig = {
            ...config,
            ...updates,
            lastUpdated: new Date().toISOString()
        };

        // Ensure config directory exists
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
        return newConfig;
    } catch (error) {
        console.error('Error updating deployment config:', error);
        throw error;
    }
}

/**
 * Blue-Green routing middleware
 */
function blueGreenRouter() {
    return (req, res, next) => {
        try {
            const config = getDeploymentConfig();
            const rolloutPercent = config.greenRolloutPercent || 0;

            // Determine which environment to use
            const random = Math.random() * 100;
            const isGreen = random < rolloutPercent;

            // Add environment info to request
            req.deploymentEnvironment = isGreen ? 'green' : 'blue';
            req.deploymentVersion = isGreen ? config.greenVersion : config.currentVersion;

            // Add custom header for tracking
            res.setHeader('X-Deployment-Environment', req.deploymentEnvironment);
            res.setHeader('X-Deployment-Version', req.deploymentVersion);

            // Log deployment routing (only in development)
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Blue-Green] Request routed to ${req.deploymentEnvironment} (${req.deploymentVersion})`);
            }

            next();
        } catch (error) {
            console.error('Blue-Green routing error:', error);
            // Fail safe to blue environment
            req.deploymentEnvironment = 'blue';
            next();
        }
    };
}

/**
 * Health check endpoint for deployment status
 */
function deploymentHealthCheck(req, res) {
    try {
        const config = getDeploymentConfig();

        res.status(200).json({
            success: true,
            deployment: {
                blueVersion: config.currentVersion,
                greenVersion: config.greenVersion,
                greenRolloutPercent: config.greenRolloutPercent,
                activeEnvironment: config.environment,
                lastUpdated: config.lastUpdated
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment status',
            message: error.message
        });
    }
}

/**
 * Gradual rollout controller
 * Incrementally increase green environment traffic
 */
async function incrementRollout(percentage = 10) {
    try {
        const config = getDeploymentConfig();
        const newPercent = Math.min(100, config.greenRolloutPercent + percentage);

        const updated = updateDeploymentConfig({
            greenRolloutPercent: newPercent,
            environment: newPercent === 100 ? 'green' : 'blue-green'
        });

        console.log(`[Blue-Green] Rollout increased to ${newPercent}%`);
        return updated;
    } catch (error) {
        console.error('Error incrementing rollout:', error);
        throw error;
    }
}

/**
 * Complete rollout to green
 */
async function completeRollout() {
    try {
        const config = getDeploymentConfig();

        const updated = updateDeploymentConfig({
            greenRolloutPercent: 100,
            currentVersion: config.greenVersion,
            environment: 'green'
        });

        console.log(`[Blue-Green] Rollout completed. Green is now production.`);
        return updated;
    } catch (error) {
        console.error('Error completing rollout:', error);
        throw error;
    }
}

/**
 * Rollback to blue environment
 */
async function rollbackToBlue() {
    try {
        const config = getDeploymentConfig();

        const updated = updateDeploymentConfig({
            greenRolloutPercent: 0,
            environment: 'blue'
        });

        console.log(`[Blue-Green] Rolled back to blue environment`);
        return updated;
    } catch (error) {
        console.error('Error rolling back:', error);
        throw error;
    }
}

/**
 * Initialize new green deployment
 */
async function initializeGreenDeployment(version) {
    try {
        const updated = updateDeploymentConfig({
            greenVersion: version,
            greenRolloutPercent: 0,
            environment: 'blue'
        });

        console.log(`[Blue-Green] Initialized green deployment: ${version}`);
        return updated;
    } catch (error) {
        console.error('Error initializing green deployment:', error);
        throw error;
    }
}

module.exports = {
    blueGreenRouter,
    deploymentHealthCheck,
    getDeploymentConfig,
    updateDeploymentConfig,
    incrementRollout,
    completeRollout,
    rollbackToBlue,
    initializeGreenDeployment
};
