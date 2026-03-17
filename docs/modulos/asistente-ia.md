# Módulo de Asistente IA (AVI)

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de Asistente IA (AVI - Asistente Virtual Inteligente) integra Google Cloud Vertex AI con el modelo Gemini 2.0 Flash Thinking para proporcionar asistencia médica inteligente, generación de documentos y análisis de datos clínicos.

---

## Configuración del Servicio

### Inicialización

```javascript
// _backend/services/vertexAiService.js

const { VertexAI } = require('@google-cloud/vertexai');

class VertexAiService {
  constructor() {
    this.vertexAi = null;
    this.generativeModel = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.vertexAi = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      });

      this.generativeModel = this.vertexAi.getGenerativeModel({
        model: 'gemini-2.0-flash-thinking-exp',
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        },
        systemInstruction: {
          parts: [
            {
              text: `Eres AVI (Asistente Virtual Inteligente), una IA médica avanzada 
                               potenciada por arquitectura de razonamiento profundo (Thinking Model).
                               Tu propósito es asistir a profesionales de la salud en:
                               - Análisis de síntomas y diagnósticos diferenciales
                               - Interpretación de resultados de laboratorio
                               - Recomendaciones de tratamiento basadas en evidencia
                               - Generación de documentación médica
                               - Consultas sobre medicamentos y dosis
                               
                               IMPORTANTE:
                               - Siempre indica que tus respuestas son sugerencias y no sustituyen 
                                 el juicio clínico profesional
                               - Recomienda verificar información con fuentes actualizadas
                               - En casos de emergencia, indica que se debe contactar 
                                 inmediatamente al personal médico`,
            },
          ],
        },
      });

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error('Error initializing Vertex AI:', error);
      return { success: false, error: error.message };
    }
  }

  checkInitialization() {
    if (!this.initialized) {
      throw new Error('VertexAiService no ha sido inicializado. Llame a initialize() primero.');
    }
  }
}

module.exports = new VertexAiService();
```

---

## Funcionalidades Principales

### Chat Virtual

```javascript
async virtualAssistantChat(message, userId, context = {}) {
    this.checkInitialization();

    try {
        // Obtener historial de chat
        const chatHistory = await this.getChatHistory(userId);

        // Construir contexto del paciente si está disponible
        let systemPrompt = this.getSystemPrompt(context);
        if (context.patientId) {
            const patientContext = await this.getPatientContext(context.patientId);
            systemPrompt += `\n\nContexto del paciente:\n${patientContext}`;
        }

        // Generar respuesta
        const result = await this.generativeModel.generateContent({
            contents: [
                ...chatHistory,
                { role: 'user', parts: [{ text: message }] }
            ],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            }
        });

        const response = result.response.candidates[0].content.parts[0].text;

        // Guardar en historial
        await this.saveChatHistory(userId, message, response);

        // Detectar acciones requeridas
        const actions = this.detectRequiredActions(message, response);

        return {
            success: true,
            response: response,
            actions: actions
        };
    } catch (error) {
        console.error('Error in virtualAssistantChat:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

### Generación de Borradores de Email

```javascript
async generateEmailDraft(emailData) {
    this.checkInitialization();

    const prompt = `Genera un borrador de email médico profesional con los siguientes datos:
        - Destinatario: ${emailData.recipient}
        - Asunto: ${emailData.subject}
        - Contexto: ${emailData.context}
        - Tono: ${emailData.tone || 'profesional'}

        El email debe ser claro, conciso y mantener confidencialidad médica.
        Incluye:
        1. Saludo apropiado
        2. Cuerpo del mensaje
        3. Despedida profesional
        4. Firma con datos de contacto`;

    try {
        const result = await this.generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        return {
            success: true,
            draft: result.response.candidates[0].content.parts[0].text
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
```

### Resumen Médico

```javascript
async generateMedicalSummary(patientData, consultations) {
    this.checkInitialization();

    const prompt = `Genera un resumen médico profesional basado en:
        - Datos del paciente: ${JSON.stringify(patientData)}
        - Consultas: ${JSON.stringify(consultations)}

        Incluye:
        1. Antecedentes relevantes
        2. Diagnósticos principales
        3. Tratamientos actuales
        4. Recomendaciones de seguimiento

        Formato: Markdown con secciones claras`;

    try {
        const result = await this.generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        return {
            success: true,
            summary: result.response.candidates[0].content.parts[0].text
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
```

### Análisis de Documentos

```javascript
async analyzeDocument(documentText, analysisType = 'summary') {
    this.checkInitialization();

    const analysisPrompts = {
        summary: 'Genera un resumen conciso del siguiente documento médico:',
        extraction: 'Extrae los datos clínicos relevantes del siguiente documento:',
        diagnosis: 'Identifica posibles diagnósticos basados en el siguiente documento:',
        medications: 'Lista todos los medicamentos mencionados en el siguiente documento:'
    };

    const prompt = `${analysisPrompts[analysisType]}\n\n${documentText}\n\n
        Responde en formato estructurado y claro.`;

    try {
        const result = await this.generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        let parsedData;
        if (analysisType === 'extraction') {
            parsedData = {
                extractedData: result.response.candidates[0].content.parts[0].text
            };
        } else {
            parsedData = {
                analysis: result.response.candidates[0].content.parts[0].text
            };
        }

        return {
            success: true,
            ...parsedData
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
```

### Generación de Archivos

```javascript
async generateFile(fileData) {
    this.checkInitialization();

    const prompt = `Genera contenido para un archivo médico con los siguientes parámetros:
        - Tipo: ${fileData.type}
        - Formato: ${fileData.format}
        - Contenido requerido: ${fileData.content}

        Estructura el contenido de manera profesional y completa.`;

    try {
        const result = await this.generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        return {
            success: true,
            content: result.response.candidates[0].content.parts[0].text
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
```

---

## Detección de Acciones Requeridas

```javascript
detectRequiredActions(userMessage, assistantResponse) {
    const actions = [];

    // Detectar si se necesita crear una cita
    if (assistantResponse.includes('programar cita') ||
        assistantResponse.includes('agendar consulta') ||
        userMessage.toLowerCase().includes('cita') ||
        userMessage.toLowerCase().includes('consulta')) {
        actions.push({
            type: 'CREATE_APPOINTMENT',
            confidence: 0.85,
            data: this.extractAppointmentData(assistantResponse)
        });
    }

    // Detectar si se necesita crear un paciente
    if (assistantResponse.includes('registrar paciente') ||
        assistantResponse.includes('nuevo paciente') ||
        userMessage.toLowerCase().includes('nuevo paciente')) {
        actions.push({
            type: 'CREATE_PATIENT',
            confidence: 0.90,
            data: this.extractPatientData(assistantResponse)
        });
    }

    // Detectar si se necesita generar un documento
    if (assistantResponse.includes('generar documento') ||
        assistantResponse.includes('crear receta') ||
        userMessage.toLowerCase().includes('receta')) {
        actions.push({
            type: 'GENERATE_DOCUMENT',
            confidence: 0.88,
            data: this.extractDocumentData(assistantResponse)
        });
    }

    // Detectar si se necesita crear un recordatorio
    if (assistantResponse.includes('recordatorio') ||
        assistantResponse.includes('seguimiento')) {
        actions.push({
            type: 'CREATE_REMINDER',
            confidence: 0.75,
            data: this.extractReminderData(assistantResponse)
        });
    }

    return actions;
}

extractAppointmentData(text) {
    // Extraer datos de cita del texto
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(AM|PM)?)/i);

    return {
        fecha: dateMatch ? dateMatch[1] : null,
        hora: timeMatch ? timeMatch[1] : null,
        tipo: 'CONSULTA_GENERAL'
    };
}

extractPatientData(text) {
    // Extraer datos del paciente del texto
    return {
        nombre: null,
        apellido: null,
        telefono: null,
        email: null
    };
}

extractDocumentData(text) {
    // Extraer datos del documento del texto
    return {
        tipo: 'RECETA_MEDICA',
        contenido: text
    };
}

extractReminderData(text) {
    // Extraer datos del recordatorio del texto
    return {
        fecha: null,
        mensaje: text
    };
}
```

---

## Estado del Modelo

```javascript
getModelStatus() {
    return {
        initialized: this.initialized,
        model: 'gemini-2.0-flash-thinking-exp',
        provider: 'Google Cloud Vertex AI',
        capabilities: [
            'chat',
            'email_draft',
            'medical_summary',
            'document_analysis',
            'file_generation'
        ],
        maxTokens: 8192,
        temperature: 0.7
    };
}
```

---

## Health Check

```javascript
async healthCheck() {
    try {
        this.checkInitialization();

        const result = await this.generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'Health check' }] }]
        });

        return {
            status: 'healthy',
            model: 'gemini-2.0-flash-thinking-exp',
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
```

---

## Endpoints de la API

### Chat con AVI

```http
POST /api/ai/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "¿Cuáles son los síntomas de la hipertensión arterial?",
  "patient_id": 1,
  "context": {
    "conversation_id": "abc123"
  }
}

Response 200:
{
  "success": true,
  "response": "La hipertensión arterial es una condición médica...",
  "actions": [
    {
      "type": "CREATE_APPOINTMENT",
      "confidence": 0.85,
      "data": {}
    }
  ]
}
```

### Generar Borrador de Email

```http
POST /api/ai/email-draft
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipient": "paciente@email.com",
  "subject": "Resultados de laboratorio",
  "context": "Paciente con resultados de hemograma normales",
  "tone": "profesional"
}

Response 200:
{
  "success": true,
  "draft": "Estimado paciente,\n\nLe informamos que los resultados..."
}
```

### Generar Resumen Médico

```http
POST /api/ai/medical-summary
Authorization: Bearer {token}
Content-Type: application/json

{
  "patient_id": 1,
  "consultations": [1, 2, 3]
}

Response 200:
{
  "success": true,
  "summary": "## Resumen Médico\n\n### Antecedentes\n..."
}
```

### Analizar Documento

```http
POST /api/ai/analyze-document
Authorization: Bearer {token}
Content-Type: application/json

{
  "document_id": 1,
  "analysis_type": "extraction"
}

Response 200:
{
  "success": true,
  "extractedData": {
    "patient_name": "Juan Pérez",
    "date": "2026-03-20",
    "diagnosis": "Hipertensión arterial"
  }
}
```

---

## Configuración de Variables de Entorno

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=tu-proyecto-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_KEYFILE=/path/to/service-account.json

# Vertex AI
VERTEX_AI_MODEL=gemini-2.0-flash-thinking-exp
VERTEX_AI_MAX_TOKENS=8192
VERTEX_AI_TEMPERATURE=0.7
VERTEX_AI_TOP_P=0.95
VERTEX_AI_TOP_K=40
```

---

## Manejo de Errores

```javascript
// Errores comunes y su manejo
const errorHandling = {
  UNINITIALIZED: {
    code: 500,
    message: 'El servicio de IA no ha sido inicializado',
  },
  QUOTA_EXCEEDED: {
    code: 429,
    message: 'Se ha excedido la cuota de solicitudes a la API',
  },
  INVALID_REQUEST: {
    code: 400,
    message: 'La solicitud contiene parámetros inválidos',
  },
  MODEL_UNAVAILABLE: {
    code: 503,
    message: 'El modelo de IA no está disponible temporalmente',
  },
  CONTENT_FILTERED: {
    code: 400,
    message: 'El contenido fue filtrado por políticas de seguridad',
  },
};

function handleAIError(error) {
  const errorType = Object.keys(errorHandling).find(key => error.message.includes(key));

  if (errorType) {
    return errorHandling[errorType];
  }

  return {
    code: 500,
    message: 'Error desconocido en el servicio de IA',
  };
}
```

---

## Rate Limiting

```javascript
// Configuración de rate limiting para IA
const aiRateLimit = {
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 solicitudes por minuto
  message: {
    error: 'Demasiadas solicitudes al servicio de IA. Intente más tarde.',
  },
};

// Aplicar rate limiting
app.use('/api/ai/', rateLimit(aiRateLimit));
```

---

## Logging y Auditoría

```javascript
// Registrar uso de IA
async function logAIUsage(userId, action, input, output, duration) {
  await pool.query(
    `
        INSERT INTO LOGS_AUDITORIA (
            tipo_evento, categoria, nivel_criticidad,
            usuario_id, modulo, accion, descripcion,
            metadatos_adicionales, duracion_ms, resultado
        ) VALUES (
            'CONSULTAR_REGISTRO', 'SISTEMA', 'BAJO',
            $1, 'ai_assistant', $2, $3,
            $4, $5, 'EXITOSO'
        )
    `,
    [userId, action, `Consulta de IA: ${action}`, JSON.stringify({ input: input.substring(0, 500), output: output.substring(0, 500) }), duration]
  );
}
```

---

## Notas de Implementación

1. **Inicialización**: El servicio debe inicializarse antes de usar
2. **Rate Limiting**: Límite de 30 solicitudes por minuto
3. **Contexto**: Se puede incluir contexto del paciente para respuestas más precisas
4. **Acciones**: El sistema detecta automáticamente acciones requeridas
5. **Auditoría**: Todas las consultas se registran en logs de auditoría
6. **Errores**: Manejo robusto de errores con mensajes descriptivos
7. **Seguridad**: El contenido se filtra por políticas de seguridad de Google
8. **Confidencialidad**: Las respuestas incluyen disclaimer sobre juicio clínico
