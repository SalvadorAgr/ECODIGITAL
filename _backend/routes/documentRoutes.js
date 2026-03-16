/**
 * EcoDigital - Document Management Routes
 * Routes for file upload, download, and document management with Cloud Storage
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const cloudStorageService = require('../services/cloudStorageService');
const authMiddleware = require('../middleware/authMiddleware');
const { query } = require('../db');

// Configure multer for file uploads (memory storage for Cloud Storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow medical document formats
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/csv'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'), false);
        }
    }
});

/**
 * @route POST /api/v1/documents/upload
 * @desc Upload document to Cloud Storage
 * @access Private
 */
router.post('/upload', authMiddleware.authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        const { patientId, category, description } = req.body;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                error: 'Patient ID is required'
            });
        }

        // Upload to Cloud Storage
        const uploadResult = await cloudStorageService.uploadPatientDocument(
            req.file.buffer,
            patientId,
            category || 'general',
            req.file.originalname,
            {
                uploadedBy: req.user.id,
                description: description || '',
                contentType: req.file.mimetype
            }
        );

        res.status(200).json({
            success: true,
            data: uploadResult,
            message: 'Document uploaded successfully'
        });

    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload document',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/documents/upload-multiple
 * @desc Upload multiple documents to Cloud Storage
 * @access Private
 */
router.post('/upload-multiple', authMiddleware.authenticateToken, upload.array('documents', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided'
            });
        }

        const { patientId, category, description } = req.body;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                error: 'Patient ID is required'
            });
        }

        // Upload all files
        const uploadPromises = req.files.map(file =>
            cloudStorageService.uploadPatientDocument(
                file.buffer,
                patientId,
                category || 'general',
                file.originalname,
                {
                    uploadedBy: req.user.id,
                    description: description || '',
                    contentType: file.mimetype
                }
            )
        );

        const uploadResults = await Promise.all(uploadPromises);

        // Save file metadata to database
        const { query } = require('../db');
        
        for (let i = 0; i < uploadResults.length; i++) {
            const uploadResult = uploadResults[i];
            const file = req.files[i];
            
            try {
                const fileType = file.mimetype.startsWith('image/') ? 'image' : 
                               file.mimetype.startsWith('video/') ? 'video' : 'document';

                await query(`
                    INSERT INTO file_metadata (
                        file_id, patient_id, file_name, file_type, source_type,
                        mime_type, file_size, file_path, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    uploadResult.fileName || uploadResult.name,
                    patientId,
                    file.originalname,
                    fileType,
                    'upload',
                    file.mimetype,
                    file.size,
                    uploadResult.filePath || uploadResult.url,
                    JSON.stringify({
                        originalName: file.originalname,
                        uploadedBy: req.user.id,
                        category: category || 'general',
                        description: description || '',
                        uploadDate: new Date().toISOString()
                    })
                ]);
            } catch (metadataError) {
                console.warn('Failed to save file metadata:', metadataError);
                // Don't fail the upload if metadata save fails
            }
        }

        res.status(200).json({
            success: true,
            data: uploadResults,
            message: `${uploadResults.length} documents uploaded successfully`
        });

    } catch (error) {
        console.error('Multiple document upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload documents',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/documents/patient/:patientId
 * @desc Get all documents for a patient
 * @access Private
 */
router.get('/patient/:patientId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const { category } = req.query;

        const files = await cloudStorageService.listFiles(
            `patients/${patientId}${category ? `/${category}` : ''}`,
            { limit: 100 }
        );

        res.status(200).json({
            success: true,
            data: files,
            message: 'Documents retrieved successfully'
        });

    } catch (error) {
        console.error('Get patient documents error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve documents',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/documents/download/:fileName
 * @desc Download document from Cloud Storage
 * @access Private
 */
router.get(/^\/download\/(.*)/, authMiddleware.authenticateToken, async (req, res) => {
    try {
        const fileName = req.params[0];

        // Get file metadata first
        const metadata = await cloudStorageService.getFileMetadata(fileName);

        // Generate signed URL for secure download
        const signedUrl = await cloudStorageService.generateSignedUrl(fileName, {
            action: 'read',
            expiresIn: 15 * 60 * 1000 // 15 minutes
        });

        res.status(200).json({
            success: true,
            data: {
                downloadUrl: signedUrl,
                fileName: metadata.name,
                size: metadata.size,
                contentType: metadata.contentType,
                expiresIn: 15 * 60 // 15 minutes in seconds
            },
            message: 'Download URL generated successfully'
        });

    } catch (error) {
        console.error('Document download error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate download URL',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route DELETE /api/v1/documents/:fileName
 * @desc Delete document from Cloud Storage (soft delete)
 * @access Private
 */
router.delete(/^\/(.*)/, authMiddleware.authenticateToken, async (req, res) => {
    try {
        const fileName = req.params[0];

        const success = await cloudStorageService.deleteFile(fileName);

        if (success) {
            res.status(200).json({
                success: true,
                message: 'Document deleted successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

    } catch (error) {
        console.error('Document delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete document',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/documents/metadata/:fileName
 * @desc Get document metadata
 * @access Private
 */
router.get(/^\/metadata\/(.*)/, authMiddleware.authenticateToken, async (req, res) => {
    try {
        const fileName = req.params[0];

        const metadata = await cloudStorageService.getFileMetadata(fileName);

        res.status(200).json({
            success: true,
            data: metadata,
            message: 'Metadata retrieved successfully'
        });

    } catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve metadata',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/documents/search
 * @desc Search documents by criteria
 * @access Private
 */
router.post('/search', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId, category, contentType, dateFrom, dateTo, query: textQuery } = req.body;

        let sqlQuery = `
            SELECT 
                file_id, patient_id, file_name, file_type, 
                mime_type, file_size, created_at, metadata
            FROM file_metadata
            WHERE is_active = TRUE
        `;
        const params = [];
        let paramIndex = 1;

        if (patientId) {
            sqlQuery += ` AND patient_id = $${paramIndex++}`;
            params.push(patientId);
        }

        if (category) {
            // Check metadata->>'category'
            sqlQuery += ` AND metadata->>'category' = $${paramIndex++}`;
            params.push(category);
        }

        if (textQuery) {
            sqlQuery += ` AND file_name ILIKE $${paramIndex++}`;
            params.push(`%${textQuery}%`);
        }
        
        // Add sorting
        sqlQuery += ` ORDER BY created_at DESC LIMIT 100`;

        const { rows } = await query(sqlQuery, params);

        res.status(200).json({
            success: true,
            data: rows.map(row => ({
                id: row.file_id,
                name: row.file_name,
                patientId: row.patient_id,
                size: row.file_size,
                type: row.file_type,
                mimeType: row.mime_type,
                date: row.created_at,
                metadata: row.metadata
            })),
            message: 'Search completed successfully'
        });

    } catch (error) {
        console.error('Document search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search documents',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/documents/categories
 * @desc Get available document categories
 * @access Private
 */
router.get('/categories', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const categories = [
            { id: 'general', name: 'General', description: 'Documentos generales' },
            { id: 'operations', name: 'Operaciones', description: 'Documentos de cirugías y procedimientos' },
            { id: 'consultas', name: 'Consultas', description: 'Documentos de consultas médicas' },
            { id: 'laboratorio', name: 'Laboratorio', description: 'Resultados de laboratorio y estudios' },
            { id: 'imagenes', name: 'Imágenes', description: 'Radiografías, ecografías, etc.' },
            { id: 'recetas', name: 'Recetas', description: 'Prescripciones médicas' }
        ];

        res.status(200).json({
            success: true,
            data: categories,
            message: 'Categories retrieved successfully'
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve categories',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;