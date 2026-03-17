/**
 * EcoDigital - Vertex AI Service
 * Real-time integration with Google Cloud Vertex AI (Gemini)
 */

const { VertexAI } = require('@google-cloud/vertexai');

class VertexAiService {
    constructor() {
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        this.location = process.env.VERTEX_AI_LOCATION || 'us-central1';
        // User requested "Gemini 2.5 thinking". Mapping to the most capable reasoning model available in Vertex AI: generic thinking experimental.
        this.modelName = process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash-thinking-exp-1219';

        this.vertexAi = null;
        this.generativeModel = null;
        this.chatSessions = new Map();

        this.initialize();
    }

    /**
     * Initialize Vertex AI client
     */
    initialize() {
        try {
            if (!this.projectId) {
                console.warn('VertexAI: GOOGLE_CLOUD_PROJECT_ID not set. Service running in limited mode.');
                return;
            }

            this.vertexAi = new VertexAI({
                project: this.projectId,
                location: this.location,
            });

            this.generativeModel = this.vertexAi.getGenerativeModel({
                model: this.modelName,
                generationConfig: {
                    maxOutputTokens: 4096, // Increased for deeper thinking/reasoning outputs
                    temperature: 0.3, // Low temperature for precision
                    topP: 0.85,
                    topK: 40,
                },
                systemInstruction: {
                    role: 'system',
                    parts: [{"text": `Eres AVI (Asistente Virtual Inteligente), una IA médica avanzada potenciada por arquitectura de razonamiento profundo (Thinking Model).
Tu objetivo es asistir a cirujanos y personal administrativo en "EcoDigital" con máxima coherencia, lógica y precisión.

CAPACIDADES DE RAZONAMIENTO Y PROCESAMIENTO:
- Antes de responder, ANALIZA profundamente el contexto del usuario y la intención detrás de la consulta.
- Estructura tus respuestas de forma lógica, paso a paso si es necesario (Chain of Thought), pero entrega solo la respuesta final pulida al usuario.
- Tienes capacidad ("Tool Use" simulado por ahora) para estructurar datos para:
  1. Redacción de Correos: Genera asuntos y cuerpos de correo profesionales y empáticos.
  2. Generación de Archivos: Si el usuario pide crear un documento (PDF, Nota, Resumen), confirma los datos y ofrece la estructura del contenido listo para ser procesado por el sistema.
  3. Análisis de Documentos: Extrae diagnósticos, tratamientos y puntos clave con alta fidelidad clínica.

DIRECTRICES DE COMPORTAMIENTO (ESTRICTAS):
1. **Coherencia Total**: Tus respuestas deben tener un hilo conductor claro. Si el usuario cambia de tema, adáptate sin perder el contexto histórico relevante.
2. **Cero Alucinaciones**: Si te falta un dato vital (ej. fecha de nacimiento, nombre del paciente) para una tarea, PÍDELO. No lo inventes.
3. **Estilo de Respuesta**: Directo, profesional, clínico pero accesible. Usa Markdown para legibilidad.
4. **Integración Funcional**:
   - Si detectas intención de enviar un correo -> Ofrece: "Puedo redactar el borrador para ti. ¿Te parece bien este asunto...?"
   - Si detectas intención de crear un archivo -> Ofrece: "Puedo generar el documento con la siguiente estructura..."

Recuerda: Eres una herramienta de apoyo crítico. La precisión y la utilidad son tu prioridad.`}]
                }
            });

            console.log(`VertexAI Service initialized (Project: ${this.projectId}, Model: ${this.modelName})`);
        } catch (error) {
            console.error('VertexAI Initialization Error:', error);
        }
    }

    /**
     * Ensure model is initialized
     */
    checkInitialization() {
        if (!this.generativeModel) {
            this.initialize();
            if (!this.generativeModel) {
                throw new Error('Vertex AI service not initialized. Check configuration.');
            }
        }
    }

    /**
     * Virtual Assistant Chat
     */
    async virtualAssistantChat(message, userId, context = {}) {
        try {
            this.checkInitialization();

            // Prepare context string
            const contextString = JSON.stringify(context);
            const prompt = `Contexto actual del usuario y sistema: ${contextString}\n\nConsulta del usuario: ${message}`;

            // Get or create chat session
            let chatSession = this.chatSessions.get(userId);
            
            // If no session exists or it's old, start a new one
            if (!chatSession) {
                chatSession = this.generativeModel.startChat({
                    history: [],
                });
                this.chatSessions.set(userId, chatSession);
            }

            const result = await chatSession.sendMessage(prompt);
            const responseText = result.response.candidates[0].content.parts[0].text;

            // Simple action detection logic based on response content keywords
            // Ideally, you'd use function calling, but this is a robust text-based approach
            const actions = this.detectRequiredActions(message, responseText);

            return {
                success: true,
                response: responseText,
                conversationId: `vertex_${userId}_${Date.now()}`,
                actions,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Vertex AI Chat Error:', error);
            // Fallback to a safe error message if Vertex fails
            return {
                success: false,
                response: "Lo siento, actualmente no tengo conexión con mis servidores cognitivos (Vertex AI). Por favor, intenta de nuevo en un momento o verifica tu red.",
                actions: [],
                error: error.message
            };
        }
    }

    /**
     * Generate email draft
     */
    async generateEmailDraft(emailData) {
        try {
            this.checkInitialization();

            const prompt = `
            Genera un borrador de correo electrónico médico PROFESIONAL.
            Destinatario: ${emailData.recipient || 'A quien corresponda'}
            Asunto deseado: ${emailData.subject || 'Información Médica'}
            Contexto/Mensaje clave: ${emailData.context}
            Tono: ${emailData.tone || 'formally professional'}

            El correo debe ser claro, cortés y directo. Incluye espacios para firma.
            Solo devuelve el cuerpo del correo y el asunto sugerido, en formato JSON: { "subject": "...", "body": "..." }
            `;

            const result = await this.generativeModel.generateContent(prompt);
            const textResponse = result.response.candidates[0].content.parts[0].text;
            
            // Attempt to parse JSON from the response (handling potential markdown cleanups)
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonContent = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    subject: jsonContent.subject,
                    body: jsonContent.body,
                    recipient: emailData.recipient,
                    timestamp: new Date().toISOString()
                };
            }

            // Fallback if not JSON
            return {
                success: true,
                subject: emailData.subject || 'Comunicado EcoDigital',
                body: textResponse,
                recipient: emailData.recipient,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Email Generation Error:', error);
            throw error;
        }
    }

    /**
     * Generate medical summary
     */
    async generateMedicalSummary(patientData, consultations) {
        try {
            this.checkInitialization();

            const prompt = `
            Genera un RESUMEN CLÍNICO CONCISO para el siguiente paciente:
            Datos Paciente: ${JSON.stringify(patientData)}
            Consultas/Historial reciente: ${JSON.stringify(consultations)}

            El resumen debe incluir:
            1. Identificación y Antecedentes relevantes.
            2. Evolución reciente basada en las consultas.
            3. Interpretación breve del estado actual.
            4. Recomendaciones generales sugeridas (si aplican según el contexto).
            
            Usa formato Markdown limpio con viñetas.
            `;

            const result = await this.generativeModel.generateContent(prompt);
            return result.response.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error('Medical Summary Error:', error);
            throw error;
        }
    }

    /**
     * Analyze document
     */
    async analyzeDocument(documentText, analysisType = 'summary') {
        try {
            this.checkInitialization();

            const prompt = `
            Analiza el siguiente texto de documento médico:
            "${documentText.substring(0, 10000)}" 
            (Texto truncado si es muy largo)

            Tarea: ${analysisType === 'summary' ? 'Resumir puntos clave' : 'Extraer ' + analysisType}
            
            Genera:
            1. Un análisis detallado.
            2. Hallazgos clave (lista).
            3. Términos médicos importantes encontrados.

            Responde en JSON: { "analysis": "...", "keyFindings": ["..."], "medicalTerms": ["..."] }
            `;

            const result = await this.generativeModel.generateContent(prompt);
            const textResponse = result.response.candidates[0].content.parts[0].text;

            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            let parsedData = {};
            
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            } else {
                parsedData = { 
                    analysis: textResponse, 
                    keyFindings: [], 
                    medicalTerms: [] 
                };
            }

            return {
                success: true,
                ...parsedData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Document Analysis Error:', error);
            throw error;
        }
    }

    /**
     * Generate actual file content (Document Creation)
     */
    async generateFile(fileData) {
        try {
            this.checkInitialization();

            const prompt = `
            Genera el CONTENIDO COMPLETO para un archivo de tipo "${fileData.type}".
            Título/Contexto: ${fileData.context}
            Datos del Paciente: ${JSON.stringify(fileData.patientData || {})}
            
            Salida esperada: Solo el contenido del texto del documento.
            - Si es receta, formato receta.
            - Si es constancia, formato formal.
            - Si es resumen, formato markdown limpio.
            `;

            const result = await this.generativeModel.generateContent(prompt);
            const content = result.response.candidates[0].content.parts[0].text;

            // In a real app, this might upload to Cloud Storage and return a link.
            // For now, we return the content so the frontend can trigger a download/preview.
            return {
                success: true,
                fileName: `${fileData.title || 'Documento'}.txt`,
                content: content,
                mimeType: 'text/plain',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('File Generation Error:', error);
            throw error;
        }
    }

    /**
     * Detect required actions from conversation
     */
    detectRequiredActions(userMessage, assistantResponse) {
        const actions = [];
        const lowerMessage = userMessage.toLowerCase();
        const lowerResponse = assistantResponse.toLowerCase();

        // Search Files
        if (lowerMessage.includes('buscar') && (lowerMessage.includes('archivo') || lowerMessage.includes('documento'))) {
            actions.push({
                type: 'search_files',
                description: 'Abrir búsqueda de archivos',
                priority: 'high'
            });
        }

        // Search Patients
        if (lowerMessage.includes('paciente') && (lowerMessage.includes('buscar') || lowerMessage.includes('ver'))) {
            actions.push({
                type: 'search_patients',
                description: 'Buscar paciente',
                priority: 'high'
            });
        }

        // Compose Email
        if (lowerMessage.includes('correo') && (lowerMessage.includes('redactar') || lowerMessage.includes('enviar'))) {
            actions.push({
                type: 'compose_email',
                description: 'Redactar correo',
                priority: 'medium'
            });
        }
        
        // Generate File (New)
        if (lowerMessage.includes('crear') && (lowerMessage.includes('archivo') || lowerMessage.includes('constancia') || lowerMessage.includes('receta'))) {
             actions.push({
                type: 'generate_file',
                description: 'Generar documento',
                priority: 'high'
            });
        }

        return actions;
    }

    /**
     * Clear conversation context
     */
    clearConversationContext(userId) {
        this.chatSessions.delete(userId);
    }

    /**
     * Get model status
     */
    getModelStatus() {
        return {
            isInitialized: !!this.generativeModel,
            model: this.modelName,
            project: this.projectId,
            location: this.location,
            activeSessions: this.chatSessions.size,
            provider: 'vertex-ai'
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            this.checkInitialization();
            // Simple prompt to verify connectivity
            const result = await this.generativeModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
                generationConfig: { maxOutputTokens: 5 }
            });
            return {
                status: 'healthy',
                latency: 'ok',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new VertexAiService();