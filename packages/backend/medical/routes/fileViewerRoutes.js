/**
 * EcoDigital - File Viewer Routes
 * Routes for visual file viewer functionality
 */

const express = require('express');
const router = express.Router();
const fileViewerService = require('../services/fileViewerService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/v1/file-viewer/patient/:patientId
 * @desc Get all files for a patient with filtering
 * @access Private
 */
router.get('/patient/:patientId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const {
            fileType,
            sourceType,
            dateFrom,
            dateTo,
            search,
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        // Validate patient ID
        if (!patientId || isNaN(parseInt(patientId))) {
            return res.status(400).json({
                success: false,
                error: 'Valid patient ID is required'
            });
        }

        const filters = {
            fileType,
            sourceType,
            dateFrom,
            dateTo,
            search
        };

        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        };

        const result = await fileViewerService.getPatientFiles(patientId, filters, pagination);

        res.status(200).json({
            success: true,
            ...result.data,
            message: `Retrieved ${result.data.files.length} files for patient`
        });

    } catch (error) {
        console.error('Get patient files error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve patient files',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/file-viewer/patient/:patientId/type/:type
 * @desc Get files by type (photos, videos, documents)
 * @access Private
 */
router.get('/patient/:patientId/type/:type', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId, type } = req.params;
        const {
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        // Validate patient ID
        if (!patientId || isNaN(parseInt(patientId))) {
            return res.status(400).json({
                success: false,
                error: 'Valid patient ID is required'
            });
        }

        // Validate type
        const validTypes = ['photos', 'videos', 'documents'];
        if (!validTypes.includes(type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: `Invalid file type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        };

        const result = await fileViewerService.getFilesByType(patientId, type, pagination);

        res.status(200).json({
            success: true,
            ...result.data,
            message: `Retrieved ${result.data.files.length} ${type} for patient`
        });

    } catch (error) {
        console.error(`Get files by type error (${req.params.type}):`, error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve ${req.params.type} files`,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/file-viewer/patient/:patientId/cloud-drives
 * @desc Get files from cloud drives
 * @access Private
 */
router.get('/patient/:patientId/cloud-drives', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const {
            driveType,
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        // Validate patient ID
        if (!patientId || isNaN(parseInt(patientId))) {
            return res.status(400).json({
                success: false,
                error: 'Valid patient ID is required'
            });
        }

        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        };

        const result = await fileViewerService.getCloudDriveFiles(patientId, driveType, pagination);

        res.status(200).json({
            success: true,
            ...result.data,
            message: `Retrieved ${result.data.files.length} cloud drive files for patient`
        });

    } catch (error) {
        console.error('Get cloud drive files error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve cloud drive files',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/file-viewer/patient/:patientId/stats
 * @desc Get file viewer statistics for patient
 * @access Private
 */
router.get('/patient/:patientId/stats', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;

        // Validate patient ID
        if (!patientId || isNaN(parseInt(patientId))) {
            return res.status(400).json({
                success: false,
                error: 'Valid patient ID is required'
            });
        }

        const result = await fileViewerService.getViewerStats(patientId);

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'File viewer statistics retrieved successfully'
        });

    } catch (error) {
        console.error('Get viewer stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve viewer statistics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route PUT /api/v1/file-viewer/file/:fileId/metadata
 * @desc Update file metadata
 * @access Private
 */
router.put('/file/:fileId/metadata', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { metadata } = req.body;
        const userId = req.user.id_usuario;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: 'File ID is required'
            });
        }

        if (!metadata || typeof metadata !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Valid metadata object is required'
            });
        }

        const result = await fileViewerService.updateFileMetadata(fileId, metadata, userId);

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'File metadata updated successfully'
        });

    } catch (error) {
        console.error('Update file metadata error:', error);

        if (error.message === 'File not found or inactive') {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to update file metadata',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route DELETE /api/v1/file-viewer/file/:fileId
 * @desc Delete file (soft delete)
 * @access Private
 */
router.delete('/file/:fileId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.id_usuario;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: 'File ID is required'
            });
        }

        const result = await fileViewerService.deleteFile(fileId, userId);

        res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Delete file error:', error);

        if (error.message === 'File not found or already deleted') {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to delete file',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/file-viewer/filters/types
 * @desc Get available file types for filtering
 * @access Private
 */
router.get('/filters/types', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const fileTypes = [
            {
                id: 'photos',
                name: 'Fotos',
                description: 'Imágenes médicas, radiografías, fotografías',
                icon: 'image',
                mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
            },
            {
                id: 'videos',
                name: 'Videos',
                description: 'Videos de procedimientos, endoscopias, cirugías',
                icon: 'video',
                mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov']
            },
            {
                id: 'documents',
                name: 'Documentos',
                description: 'PDFs, reportes médicos, documentos de Word',
                icon: 'file-text',
                mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
            }
        ];

        const sourceSources = [
            {
                id: 'cloud_drive',
                name: 'Cloud Drives',
                description: 'Archivos de Google Drive, OneDrive, etc.',
                icon: 'cloud'
            },
            {
                id: 'upload',
                name: 'Subidos',
                description: 'Archivos subidos directamente al sistema',
                icon: 'upload'
            },
            {
                id: 'local',
                name: 'Locales',
                description: 'Archivos almacenados localmente',
                icon: 'hard-drive'
            },
            {
                id: 'dicom',
                name: 'DICOM',
                description: 'Imágenes médicas en formato DICOM',
                icon: 'activity'
            }
        ];

        res.status(200).json({
            success: true,
            data: {
                fileTypes,
                sourceSources,
                sortOptions: [
                    { id: 'created_at', name: 'Fecha de creación', default: true },
                    { id: 'file_name', name: 'Nombre del archivo' },
                    { id: 'file_size', name: 'Tamaño del archivo' },
                    { id: 'file_type', name: 'Tipo de archivo' }
                ],
                sortOrders: [
                    { id: 'DESC', name: 'Descendente', default: true },
                    { id: 'ASC', name: 'Ascendente' }
                ]
            },
            message: 'Filter options retrieved successfully'
        });

    } catch (error) {
        console.error('Get filter types error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve filter options',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/file-viewer/search
 * @desc Advanced search across all patient files
 * @access Private
 */
router.post('/search', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const {
            query: searchQuery,
            patientId,
            fileTypes = [],
            sourceTypes = [],
            dateFrom,
            dateTo,
            minSize,
            maxSize,
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.body;

        if (!searchQuery || searchQuery.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        // Build advanced filters
        const filters = {
            search: searchQuery.trim(),
            dateFrom,
            dateTo
        };

        // Add file type filters
        if (fileTypes.length > 0) {
            filters.fileTypes = fileTypes;
        }

        // Add source type filters
        if (sourceTypes.length > 0) {
            filters.sourceTypes = sourceTypes;
        }

        // Add size filters
        if (minSize) filters.minSize = parseInt(minSize);
        if (maxSize) filters.maxSize = parseInt(maxSize);

        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        };

        // If patientId is provided, search within that patient's files
        let result;
        if (patientId) {
            result = await fileViewerService.getPatientFiles(patientId, filters, pagination);
        } else {
            // TODO: Implement global search across all patients (with proper permissions)
            return res.status(400).json({
                success: false,
                error: 'Global search not implemented yet. Please specify a patient ID.'
            });
        }

        res.status(200).json({
            success: true,
            ...result.data,
            searchQuery: searchQuery,
            message: `Found ${result.data.files.length} files matching search criteria`
        });

    } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform search',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;