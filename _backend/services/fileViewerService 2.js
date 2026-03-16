/**
 * EcoDigital - File Viewer Service
 * Service for managing visual file viewer functionality
 */

const { query } = require('../db');
const cloudStorageService = require('./cloudStorageService');

class FileViewerService {
    constructor() {
        this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        this.supportedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];
        this.supportedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    }

    /**
     * Get files for patient with filtering and pagination
     */
    async getPatientFiles(patientId, filters = {}, pagination = {}) {
        try {
            const {
                fileType = null,
                sourceType = null,
                dateFrom = null,
                dateTo = null,
                search = null
            } = filters;

            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = pagination;

            // Build base query
            let baseQuery = `
                SELECT 
                    fm.id,
                    fm.file_id,
                    fm.file_name,
                    fm.file_type,
                    fm.source_type,
                    fm.thumbnail_url,
                    fm.file_size,
                    fm.mime_type,
                    fm.file_path,
                    fm.metadata,
                    fm.created_at,
                    fm.updated_at,
                    CONCAT(p.nombre, ' ', p.apellido) as patient_name
                FROM file_metadata fm
                JOIN PACIENTES p ON fm.patient_id = p.id
                WHERE fm.patient_id = $1 AND fm.is_active = TRUE
            `;

            const params = [patientId];
            let paramIndex = 2;

            // Apply filters
            if (fileType) {
                baseQuery += ` AND fm.file_type = $${paramIndex}`;
                params.push(fileType);
                paramIndex++;
            }

            if (sourceType) {
                baseQuery += ` AND fm.source_type = $${paramIndex}`;
                params.push(sourceType);
                paramIndex++;
            }

            if (dateFrom) {
                baseQuery += ` AND fm.created_at >= $${paramIndex}`;
                params.push(dateFrom);
                paramIndex++;
            }

            if (dateTo) {
                baseQuery += ` AND fm.created_at <= $${paramIndex}`;
                params.push(dateTo);
                paramIndex++;
            }

            if (search) {
                baseQuery += ` AND fm.file_name ILIKE $${paramIndex}`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            // Count total records
            const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_files`;
            const { rows: countRows } = await query(countQuery, params);
            const total = parseInt(countRows[0].total);

            // Add sorting
            const validSortColumns = ['created_at', 'file_name', 'file_size', 'file_type'];
            const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            baseQuery += ` ORDER BY fm.${safeSortBy} ${safeSortOrder}`;

            // Add pagination
            const offset = (page - 1) * limit;
            baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            // Execute query
            const { rows } = await query(baseQuery, params);

            // Process files and generate thumbnails/preview URLs
            const processedFiles = await Promise.all(
                rows.map(file => this.processFileForViewer(file))
            );

            // Calculate pagination info
            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: {
                    files: processedFiles,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages,
                        hasNext: page < totalPages,
                        hasPrev: page > 1
                    },
                    summary: {
                        totalFiles: total,
                        fileTypes: await this.getFileTypeSummary(patientId),
                        sourceSummary: await this.getSourceSummary(patientId)
                    }
                }
            };

        } catch (error) {
            console.error('Get patient files error:', error);
            throw new Error('Failed to retrieve patient files');
        }
    }

    /**
     * Get files by type (Photos, Videos, Documents)
     */
    async getFilesByType(patientId, type, pagination = {}) {
        const typeMapping = {
            'photos': this.supportedImageTypes,
            'videos': this.supportedVideoTypes,
            'documents': this.supportedDocumentTypes
        };

        if (!typeMapping[type.toLowerCase()]) {
            throw new Error(`Invalid file type: ${type}`);
        }

        const mimeTypes = typeMapping[type.toLowerCase()];

        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = pagination;

            // Build query with MIME type filter
            const placeholders = mimeTypes.map((_, index) => `$${index + 2}`).join(',');

            let filesQuery = `
                SELECT 
                    fm.id,
                    fm.file_id,
                    fm.file_name,
                    fm.file_type,
                    fm.source_type,
                    fm.thumbnail_url,
                    fm.file_size,
                    fm.mime_type,
                    fm.file_path,
                    fm.metadata,
                    fm.created_at,
                    fm.updated_at
                FROM file_metadata fm
                WHERE fm.patient_id = $1 
                AND fm.is_active = TRUE 
                AND fm.mime_type IN (${placeholders})
            `;

            const params = [patientId, ...mimeTypes];

            // Count total
            const countQuery = `SELECT COUNT(*) as total FROM (${filesQuery}) as type_files`;
            const { rows: countRows } = await query(countQuery, params);
            const total = parseInt(countRows[0].total);

            // Add sorting and pagination
            const validSortColumns = ['created_at', 'file_name', 'file_size'];
            const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            filesQuery += ` ORDER BY fm.${safeSortBy} ${safeSortOrder}`;

            const offset = (page - 1) * limit;
            filesQuery += ` LIMIT ${params.length + 1} OFFSET ${params.length + 2}`;
            params.push(limit, offset);

            const { rows } = await query(filesQuery, params);

            // Process files for viewer
            const processedFiles = await Promise.all(
                rows.map(file => this.processFileForViewer(file))
            );

            return {
                success: true,
                data: {
                    type: type,
                    files: processedFiles,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages: Math.ceil(total / limit),
                        hasNext: page < Math.ceil(total / limit),
                        hasPrev: page > 1
                    }
                }
            };

        } catch (error) {
            console.error(`Get files by type error (${type}):`, error);
            throw new Error(`Failed to retrieve ${type} files`);
        }
    }

    /**
     * Get files from cloud drives
     */
    async getCloudDriveFiles(patientId, driveType = null, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = pagination;

            let cloudQuery = `
                SELECT 
                    fm.id,
                    fm.file_id,
                    fm.file_name,
                    fm.file_type,
                    fm.source_type,
                    fm.thumbnail_url,
                    fm.file_size,
                    fm.mime_type,
                    fm.file_path,
                    fm.metadata,
                    fm.created_at,
                    fm.updated_at
                FROM file_metadata fm
                WHERE fm.patient_id = $1 
                AND fm.is_active = TRUE 
                AND fm.source_type = 'cloud_drive'
            `;

            const params = [patientId];
            let paramIndex = 2;

            // Filter by specific drive type if provided
            if (driveType) {
                cloudQuery += ` AND fm.metadata->>'driveType' = $${paramIndex}`;
                params.push(driveType);
                paramIndex++;
            }

            // Count total
            const countQuery = `SELECT COUNT(*) as total FROM (${cloudQuery}) as cloud_files`;
            const { rows: countRows } = await query(countQuery, params);
            const total = parseInt(countRows[0].total);

            // Add sorting and pagination
            const validSortColumns = ['created_at', 'file_name', 'file_size'];
            const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            cloudQuery += ` ORDER BY fm.${safeSortBy} ${safeSortOrder}`;

            const offset = (page - 1) * limit;
            cloudQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            const { rows } = await query(cloudQuery, params);

            // Process files for viewer
            const processedFiles = await Promise.all(
                rows.map(file => this.processFileForViewer(file))
            );

            return {
                success: true,
                data: {
                    source: 'cloud_drive',
                    driveType: driveType,
                    files: processedFiles,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages: Math.ceil(total / limit),
                        hasNext: page < Math.ceil(total / limit),
                        hasPrev: page > 1
                    }
                }
            };

        } catch (error) {
            console.error('Get cloud drive files error:', error);
            throw new Error('Failed to retrieve cloud drive files');
        }
    }

    /**
     * Process file for viewer (generate thumbnails, preview URLs, etc.)
     */
    async processFileForViewer(file) {
        try {
            const processedFile = {
                ...file,
                isImage: this.supportedImageTypes.includes(file.mime_type),
                isVideo: this.supportedVideoTypes.includes(file.mime_type),
                isDocument: this.supportedDocumentTypes.includes(file.mime_type),
                previewUrl: null,
                downloadUrl: null,
                thumbnailUrl: file.thumbnail_url
            };

            // Generate preview URL for supported file types
            if (processedFile.isImage || processedFile.isVideo) {
                try {
                    processedFile.previewUrl = await cloudStorageService.generateSignedUrl(
                        file.file_path,
                        { action: 'read', expiresIn: 60 * 60 * 1000 } // 1 hour
                    );
                } catch (error) {
                    console.warn(`Failed to generate preview URL for ${file.file_id}:`, error.message);
                }
            }

            // Generate download URL
            try {
                processedFile.downloadUrl = await cloudStorageService.generateSignedUrl(
                    file.file_path,
                    {
                        action: 'read',
                        expiresIn: 15 * 60 * 1000, // 15 minutes
                        responseDisposition: `attachment; filename="${file.file_name}"`
                    }
                );
            } catch (error) {
                console.warn(`Failed to generate download URL for ${file.file_id}:`, error.message);
            }

            // Generate thumbnail if not exists and file is image
            if (processedFile.isImage && !processedFile.thumbnailUrl) {
                try {
                    processedFile.thumbnailUrl = await this.generateThumbnail(file);
                } catch (error) {
                    console.warn(`Failed to generate thumbnail for ${file.file_id}:`, error.message);
                }
            }

            // Parse metadata
            if (file.metadata) {
                try {
                    processedFile.metadata = typeof file.metadata === 'string'
                        ? JSON.parse(file.metadata)
                        : file.metadata;
                } catch (error) {
                    console.warn(`Failed to parse metadata for ${file.file_id}:`, error.message);
                    processedFile.metadata = {};
                }
            }

            // Format file size
            processedFile.formattedSize = this.formatFileSize(file.file_size);

            return processedFile;

        } catch (error) {
            console.error(`Error processing file ${file.file_id}:`, error);
            return file; // Return original file if processing fails
        }
    }

    /**
     * Generate thumbnail for image files
     */
    async generateThumbnail(file) {
        // This is a placeholder for thumbnail generation
        // In a real implementation, you would use an image processing library
        // like Sharp or similar to generate thumbnails

        try {
            // For now, return the original image URL as thumbnail
            // TODO: Implement actual thumbnail generation
            return await cloudStorageService.generateSignedUrl(
                file.file_path,
                { action: 'read', expiresIn: 24 * 60 * 60 * 1000 } // 24 hours
            );
        } catch (error) {
            console.error('Thumbnail generation error:', error);
            return null;
        }
    }

    /**
     * Get file type summary for patient
     */
    async getFileTypeSummary(patientId) {
        try {
            const { rows } = await query(`
                SELECT 
                    file_type,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM file_metadata 
                WHERE patient_id = $1 AND is_active = TRUE
                GROUP BY file_type
                ORDER BY count DESC
            `, [patientId]);

            return rows.map(row => ({
                type: row.file_type,
                count: parseInt(row.count),
                totalSize: parseInt(row.total_size || 0),
                formattedSize: this.formatFileSize(row.total_size || 0)
            }));

        } catch (error) {
            console.error('Get file type summary error:', error);
            return [];
        }
    }

    /**
     * Get source summary for patient
     */
    async getSourceSummary(patientId) {
        try {
            const { rows } = await query(`
                SELECT 
                    source_type,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM file_metadata 
                WHERE patient_id = $1 AND is_active = TRUE
                GROUP BY source_type
                ORDER BY count DESC
            `, [patientId]);

            return rows.map(row => ({
                source: row.source_type,
                count: parseInt(row.count),
                totalSize: parseInt(row.total_size || 0),
                formattedSize: this.formatFileSize(row.total_size || 0)
            }));

        } catch (error) {
            console.error('Get source summary error:', error);
            return [];
        }
    }

    /**
     * Update file metadata
     */
    async updateFileMetadata(fileId, metadata, userId = null) {
        try {
            const updateQuery = `
                UPDATE file_metadata 
                SET 
                    metadata = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE file_id = $2 AND is_active = TRUE
                RETURNING *
            `;

            const { rows, rowCount } = await query(updateQuery, [
                JSON.stringify(metadata),
                fileId
            ]);

            if (rowCount === 0) {
                throw new Error('File not found or inactive');
            }

            // Log the update
            if (userId) {
                await query(`
                    INSERT INTO LOGS_AUDITORIA (
                        tabla_afectada, 
                        id_registro_afectado,
                        tipo_operacion, 
                        id_usuario_autor,
                        fecha_hora,
                        detalles
                    ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                    'FILE_METADATA',
                    rows[0].id,
                    'UPDATE',
                    userId,
                    JSON.stringify({
                        action: 'metadata_update',
                        fileId: fileId,
                        updatedFields: Object.keys(metadata)
                    })
                ]);
            }

            return {
                success: true,
                data: rows[0]
            };

        } catch (error) {
            console.error('Update file metadata error:', error);
            throw new Error('Failed to update file metadata');
        }
    }

    /**
     * Delete file (soft delete)
     */
    async deleteFile(fileId, userId = null) {
        try {
            const deleteQuery = `
                UPDATE file_metadata 
                SET 
                    is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE file_id = $1 AND is_active = TRUE
                RETURNING id, file_name, patient_id
            `;

            const { rows, rowCount } = await query(deleteQuery, [fileId]);

            if (rowCount === 0) {
                throw new Error('File not found or already deleted');
            }

            // Log the deletion
            if (userId) {
                await query(`
                    INSERT INTO LOGS_AUDITORIA (
                        tabla_afectada, 
                        id_registro_afectado,
                        tipo_operacion, 
                        id_usuario_autor,
                        fecha_hora,
                        detalles
                    ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                    'FILE_METADATA',
                    rows[0].id,
                    'DELETE',
                    userId,
                    JSON.stringify({
                        action: 'file_delete',
                        fileId: fileId,
                        fileName: rows[0].file_name,
                        patientId: rows[0].patient_id
                    })
                ]);
            }

            return {
                success: true,
                message: 'File deleted successfully'
            };

        } catch (error) {
            console.error('Delete file error:', error);
            throw new Error('Failed to delete file');
        }
    }

    /**
     * Format file size in human readable format
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get viewer statistics
     */
    async getViewerStats(patientId) {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_files,
                    COUNT(CASE WHEN file_type = 'image' THEN 1 END) as images,
                    COUNT(CASE WHEN file_type = 'video' THEN 1 END) as videos,
                    COUNT(CASE WHEN file_type = 'document' THEN 1 END) as documents,
                    COUNT(CASE WHEN source_type = 'cloud_drive' THEN 1 END) as cloud_files,
                    COUNT(CASE WHEN source_type = 'upload' THEN 1 END) as uploaded_files,
                    SUM(file_size) as total_size,
                    MAX(created_at) as last_upload
                FROM file_metadata 
                WHERE patient_id = $1 AND is_active = TRUE
            `;

            const { rows } = await query(statsQuery, [patientId]);
            const stats = rows[0];

            return {
                success: true,
                data: {
                    totalFiles: parseInt(stats.total_files),
                    images: parseInt(stats.images),
                    videos: parseInt(stats.videos),
                    documents: parseInt(stats.documents),
                    cloudFiles: parseInt(stats.cloud_files),
                    uploadedFiles: parseInt(stats.uploaded_files),
                    totalSize: parseInt(stats.total_size || 0),
                    formattedTotalSize: this.formatFileSize(stats.total_size || 0),
                    lastUpload: stats.last_upload
                }
            };

        } catch (error) {
            console.error('Get viewer stats error:', error);
            throw new Error('Failed to retrieve viewer statistics');
        }
    }
}

module.exports = new FileViewerService();