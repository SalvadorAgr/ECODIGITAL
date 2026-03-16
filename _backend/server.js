// Import required modules
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config(); // To use environment variables from a .env file locally

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const patientRoutes = require('./routes/patientRoutes');
const clinicalHistoryRoutes = require('./routes/clinicalHistoryRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const appointmentCalendarRoutes = require('./routes/appointmentCalendarRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const recurringAppointmentRoutes = require('./routes/recurringAppointmentRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const scheduleManagementRoutes = require('./routes/scheduleManagementRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const optimizationRoutes = require('./routes/optimizationRoutes');
const enhancedAppointmentRoutes = require('./routes/enhancedAppointmentRoutes');
const virtualAssistantRoutes = require('./routes/virtualAssistantRoutes');
const documentRoutes = require('./routes/documentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notesRoutes = require('./routes/notesRoutes');
const fileViewerRoutes = require('./routes/fileViewerRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Import enhanced middleware
const enhancedErrorHandler = require('./middleware/enhancedErrorHandler');
const tracingMiddleware = require('./middleware/tracing');
const { blueGreenRouter } = require('./middleware/blueGreenDeployment');
const deploymentRoutes = require('./routes/deploymentRoutes');

// Initialize Express app
const app = express();

// Enhanced middleware
app.use(enhancedErrorHandler.requestId()); // Add request ID tracking
app.use(tracingMiddleware); // Add OpenTelemetry tracing
app.use(blueGreenRouter()); // Add Blue-Green routing middleware

// Configure CORS to allow the ecosystem ports
const corsOptions = {
  origin: [
    'http://localhost:3001',
    'http://localhost:3004',
    'http://localhost:3006',
    'http://localhost:3007',
    'http://localhost:3008',
    'http://localhost:3009',
    'http://localhost:4567',
    'http://localhost:5173',
    'https://understanding-presentation-383281.framer.app',
    'https://framer.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-locale',
    'x-app-version',
    'x-schema-version',
    'apollo-require-preflight',
  ]
};

app.use(cors(corsOptions)); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter); // Apply rate limiting to API routes

// --- Health Check Routes ---
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EcoDigital Backend Service is running!',
    service: 'ecodigital-backend-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const { checkConnection } = require('./db');
    const isConnected = await checkConnection();

    if (isConnected) {
      res.status(200).json({
        success: true,
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'not ready',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// --- API Routes ---
app.use('/api/v1/auth', authRoutes); // Use the authentication routes
app.use('/api/v1/users', userRoutes); // Use the user management routes
app.use('/api/v1/patients', patientRoutes); // Use the patient management routes
app.use('/api/v1/clinical-history', clinicalHistoryRoutes); // Use the clinical history routes
app.use('/api/v1/appointments', appointmentRoutes); // Use the appointment management routes
app.use('/api/v1/appointments', enhancedAppointmentRoutes); // Use the enhanced appointment routes
app.use('/api/v1/appointments/calendar', appointmentCalendarRoutes); // Use the appointment calendar routes
app.use('/api/v1/waitlist', waitlistRoutes); // Use the waitlist management routes
app.use('/api/v1/recurring-appointments', recurringAppointmentRoutes); // Use the recurring appointment routes
app.use('/api/v1/resources', resourceRoutes); // Use the resource management routes
app.use('/api/v1/communications', communicationRoutes); // Use the communication management routes
app.use('/api/v1/schedule-management', scheduleManagementRoutes); // Use the schedule management routes
app.use('/api/v1/analytics', analyticsRoutes); // Use the analytics routes
app.use('/api/v1/optimization', optimizationRoutes); // Use the optimization engine routes
app.use('/api/v1/virtual-assistant', virtualAssistantRoutes); // Use the virtual assistant routes
app.use('/api/v1/documents', documentRoutes); // Use the document management routes
app.use('/api/v1/dashboard', dashboardRoutes); // Use the dashboard context routes
app.use('/api/v1/notes', notesRoutes); // Use the user notes routes
app.use('/api/v1/file-viewer', fileViewerRoutes); // Use the file viewer routes
app.use('/api/v1/notifications', notificationRoutes); // Use the notification routes
app.use('/api/v1/deployment', deploymentRoutes); // Use the deployment management routes

// --- Twenty Frontend Compatibility Shims ---
// These routes are required for Twenty frontend to initialize correctly
const getWorkspaceOrigin = (rawOrigin) => {
  if (typeof rawOrigin !== 'string' || !rawOrigin.trim()) {
    return 'http://localhost:3001';
  }

  try {
    const parsed = new URL(rawOrigin);
    return parsed.origin;
  } catch {
    return 'http://localhost:3001';
  }
};

const createPublicWorkspaceData = (rawOrigin) => {
  const origin = getWorkspaceOrigin(rawOrigin);

  return {
    __typename: 'PublicWorkspaceData',
    id: 'ecodigital-local-workspace',
    logo: null,
    displayName: 'EcoDigital Workspace',
    workspaceUrls: {
      __typename: 'WorkspaceUrls',
      subdomainUrl: origin,
      customUrl: null,
    },
    authProviders: {
      __typename: 'AuthProviders',
      google: true,
      magicLink: false,
      password: true,
      microsoft: false,
      sso: [],
    },
    authBypassProviders: {
      __typename: 'AuthBypassProviders',
      google: false,
      password: false,
      microsoft: false,
    },
  };
};

const getMetadataShimResponse = (body = {}) => {
  const operationName = body.operationName;
  const query = typeof body.query === 'string' ? body.query : '';
  const origin = body.variables?.origin;

  if (
    operationName === 'GetPublicWorkspaceDataByDomain'
    || query.includes('getPublicWorkspaceDataByDomain')
  ) {
    return {
      data: {
        getPublicWorkspaceDataByDomain: createPublicWorkspaceData(origin),
      },
    };
  }

  if (operationName === 'TrackAnalytics' || query.includes('trackAnalytics')) {
    return {
      data: {
        trackAnalytics: {
          __typename: 'Analytics',
          success: true,
        },
      },
    };
  }

  if (operationName === 'GetCurrentUser' || query.includes('currentUser')) {
    return {
      data: {
        currentUser: null,
      },
    };
  }

  if (query.includes('serverConfig')) {
    return {
      data: {
        serverConfig: {
          __typename: 'ServerConfig',
          appVersion: '1.0.0',
        },
      },
    };
  }

  return {
    data: {
      serverConfig: {
        __typename: 'ServerConfig',
        appVersion: '1.0.0',
      },
    },
  };
};

app.get('/client-config', (req, res) => {
  res.json({
    aiModels: [],
    signInPrefilled: true,
    isMultiWorkspaceEnabled: false,
    isEmailVerificationRequired: false,
    authProviders: { google: true, magicLink: false, password: true, microsoft: false, sso: [] },
    frontDomain: 'localhost',
    defaultSubdomain: 'app',
    analyticsEnabled: false,
    support: { supportDriver: 'NONE', supportFrontChatId: null },
    sentry: { dsn: '', release: '', environment: '' },
    billing: { isBillingEnabled: false, billingUrl: '', trialPeriods: [] },
    captcha: { provider: 'NONE', siteKey: '' },
    api: { mutationMaximumAffectedRecords: 1000 },
    canManageFeatureFlags: false,
    publicFeatureFlags: [],
    isMicrosoftMessagingEnabled: false,
    isMicrosoftCalendarEnabled: false,
    isGoogleMessagingEnabled: false,
    isGoogleCalendarEnabled: false,
    isAttachmentPreviewEnabled: false,
    isConfigVariablesInDbEnabled: false,
    isImapSmtpCaldavEnabled: false,
    isTwoFactorAuthenticationEnabled: false,
    isEmailingDomainsEnabled: false,
    allowRequestsToTwentyIcons: true,
    isCloudflareIntegrationEnabled: false,
    isClickHouseConfigured: false,
  });
});

app.post('/metadata', (req, res) => {
  res.json(getMetadataShimResponse(req.body));
});

app.post('/graphql', (req, res) => {
  // Minimal GraphQL response to satisfy initial queries
  res.json({ data: { currentUser: null, workspace: null } });
});

// --- Custom Error Pages ---
const path = require('path');
const fs = require('fs');

// 404 Handler - Must be after all routes
app.use((req, res, next) => {
  // If it's an API route, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    });
  }

  // For all other routes, serve the 404 HTML
  const html404Path = path.join(__dirname, 'views', '404.html');
  if (fs.existsSync(html404Path)) {
    return res.status(404).sendFile(html404Path);
  }

  // Fallback if file doesn't exist
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware (must be last)
app.use(enhancedErrorHandler.handleError());

// 500 Handler - Catch-all for unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // If it's an API route, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  // For all other routes, serve the 500 HTML
  const html500Path = path.join(__dirname, 'views', '500.html');
  if (fs.existsSync(html500Path)) {
    return res.status(500).sendFile(html500Path);
  }

  // Fallback if file doesn't exist
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
});

// --- Server Initialization ---
const PORT = process.env.PORT || 8080;

// Start the server and check database connection
const startServer = async () => {
  try {
    // Check database connection
    const { checkConnection } = require('./db');
    console.log('Checking database connection...');

    const isConnected = await checkConnection();

    if (isConnected) {
      console.log('Database connected successfully');
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log('Database: Connected');
      });
    } else {
      console.log('Database connection failed, starting in demo mode...');
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log('Demo mode: Database connection failed');
      });
    }
  } catch (err) {
    console.error("Database connection error:", err.message);
    console.log('Starting server in demo mode...');

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log('Demo mode: Database connection error');
    });
  }
};

startServer();
