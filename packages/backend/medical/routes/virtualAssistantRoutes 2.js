/**
 * EcoDigital - Virtual Assistant Routes
 * Routes for AI-powered virtual assistant functionality
 */

const express = require('express');
const router = express.Router();
const vertexAiService = require('../services/vertexAiService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route POST /api/v1/virtual-assistant/chat
 * @desc Chat with virtual assistant
 * @access Private
 */
router.post('/chat', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { message, context, sessionId } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Add user context to the request
        const assistantContext = {
            userRole: req.user.rol,
            userId: userId,
            userName: req.user.nombre,
            ...context
        };

        // Use VertexAI (Gemini) service for chat
        // This replaces the local Gemma service for robust, real responses
        const response = await vertexAiService.virtualAssistantChat(
            message.trim(),
            userId,
            assistantContext
        );

        res.status(200).json({
            success: true,
            data: response.response, // Send just the text content as 'data' for the frontend
            actions: response.actions,
            conversationId: response.conversationId,
            message: 'Assistant response generated successfully'
        });

    } catch (error) {
        console.error('Virtual assistant chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process assistant request',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/virtual-assistant/analyze-document
 * @desc Analyze document with AI
 * @access Private
 */
router.post('/analyze-document', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { documentText, analysisType } = req.body;

        if (!documentText || documentText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Document text is required'
            });
        }

        const analysis = await vertexAiService.analyzeDocument(
            documentText.trim(),
            analysisType || 'summary'
        );

        res.status(200).json({
            success: true,
            data: analysis,
            message: 'Document analyzed successfully'
        });

    } catch (error) {
        console.error('Document analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze document',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/virtual-assistant/generate-email
 * @desc Generate email draft with AI
 * @access Private
 */
router.post('/generate-email', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { recipient, subject, context, tone } = req.body;

        if (!context || context.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Email context is required'
            });
        }

        const emailData = {
            recipient: recipient || 'Paciente',
            subject: subject,
            context: context.trim(),
            tone: tone || 'professional'
        };

        const emailDraft = await vertexAiService.generateEmailDraft(emailData);

        res.status(200).json({
            success: true,
            data: emailDraft,
            message: 'Email draft generated successfully'
        });

    } catch (error) {
        console.error('Email generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate email draft',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/virtual-assistant/create-file
 * @desc Generate file content with AI
 * @access Private
 */
router.post('/create-file', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { type, context, title, patientData } = req.body;

        if (!type || !context) {
            return res.status(400).json({
                success: false,
                error: 'File type and context are required'
            });
        }

        const fileResult = await vertexAiService.generateFile({
            type,
            context,
            title,
            patientData
        });

        res.status(200).json({
            success: true,
            data: fileResult,
            message: 'File content generated successfully'
        });

    } catch (error) {
        console.error('File generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate file content',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/virtual-assistant/generate-summary
 * @desc Generate medical summary for patient
 * @access Private
 */
router.post('/generate-summary', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.body;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                error: 'Patient ID is required'
            });
        }

        // Get patient data and consultations (you'll need to implement these queries)
        // This is a placeholder - implement actual database queries
        const patientData = {
            nombre: 'Paciente',
            apellido: 'Ejemplo',
            fecha_nacimiento: '1980-01-01',
            historial_medico: 'Historial médico del paciente'
        };

        const consultations = [
            {
                fecha_consulta: '2024-01-15',
                diagnostico: 'Consulta de rutina',
                tratamiento: 'Tratamiento recomendado',
                notas: 'Notas de la consulta'
            }
        ];

        const summary = await vertexAiService.generateMedicalSummary(
            patientData,
            consultations
        );

        res.status(200).json({
            success: true,
            data: {
                patientId,
                summary,
                generatedAt: new Date().toISOString()
            },
            message: 'Medical summary generated successfully'
        });

    } catch (error) {
        console.error('Medical summary generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate medical summary',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route DELETE /api/v1/virtual-assistant/clear-context
 * @desc Clear conversation context for user
 * @access Private
 */
router.delete('/clear-context', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // This method only clears by userId in the new service implementation
        vertexAiService.clearConversationContext(userId);

        res.status(200).json({
            success: true,
            message: 'Conversation context cleared successfully'
        });

    } catch (error) {
        console.error('Clear context error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear conversation context',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/virtual-assistant/status
 * @desc Get virtual assistant model status
 * @access Private
 */
router.get('/status', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const status = vertexAiService.getModelStatus();
        const health = await vertexAiService.healthCheck();

        res.status(200).json({
            success: true,
            data: {
                ...status,
                health
            },
            message: 'Virtual assistant status retrieved successfully'
        });

    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve assistant status',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/virtual-assistant/capabilities
 * @desc Get virtual assistant capabilities
 * @access Private
 */
router.get('/capabilities', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const capabilities = {
            chat: {
                description: 'Conversación natural con el asistente virtual',
                features: [
                    'Búsqueda de archivos y pacientes',
                    'Ayuda con gestión documental',
                    'Generación de correspondencia médica',
                    'Creación de recordatorios y notas',
                    'Resúmenes de información de pacientes'
                ]
            },
            documentAnalysis: {
                description: 'Análisis de documentos médicos',
                supportedTypes: ['summary', 'diagnosis', 'treatment', 'keywords']
            },
            emailGeneration: {
                description: 'Generación de borradores de correo',
                tones: ['professional', 'caring', 'formal', 'friendly']
            },
            medicalSummary: {
                description: 'Generación de resúmenes médicos',
                includes: ['Información del paciente', 'Estado de salud actual', 'Progreso del tratamiento', 'Recomendaciones']
            },
            limitations: [
                'Funciona únicamente con texto',
                'No puede generar archivos de ningún formato',
                'No accede directamente a sistemas externos',
                'Toda información médica se maneja con estricta confidencialidad'
            ]
        };

        res.status(200).json({
            success: true,
            data: capabilities,
            message: 'Virtual assistant capabilities retrieved successfully'
        });

    } catch (error) {
        console.error('Get capabilities error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve capabilities',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;