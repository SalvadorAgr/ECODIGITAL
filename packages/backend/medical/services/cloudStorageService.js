/**
 * EcoDigital - Cloud Storage Service
 * Google Cloud Storage integration for document management
 */

const { Storage } = require('@google-cloud/storage');

/**
 * Cloud Storage service for document management
 */
class CloudStorageService {
    constructor() {
        this.storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        });
        this.bucketName = process.env.STORAGE_BUCKET_NAME || 'ecodigital-storage-bucket';
        this.bucket = this.storage.bucket(this.bucketName);
    }

    /**
     * Upload file to Cloud Storage
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} fileName - File name
     * @param {string} folder - Folder path (optional)
     * @param {Object} metadata - File metadata
     * @returns {Promise<Object>} Upload result
     */
    async uploadFile(fileBuffer, fileName, folder = '', metadata = {}) {
        try {
            const filePath = folder ? `${folder}/${fileName}` : fileName;
            const file = this.bucket.file(filePath);

            const stream = file.createWriteStream({
                metadata: {
                    contentType: metadata.contentType || 'application/octet-stream',
                    metadata: {
                        ...metadata,
                        uploadedAt: new Date().toISOString(),
                        uploadedBy: metadata.userId || 'system'
                    }
                },
                resumable: false
            });

            return new Promise((resolve, reject) => {
                stream.on('error', (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                });

                stream.on('finish', async () => {
                    try {
                        // Make file publicly readable if specified
                        if (metadata.public) {
                            await file.makePublic();
                        }

                        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

                        resolve({
                            success: true,
                            fileName: filePath,
                            publicUrl: metadata.public ? publicUrl : null,
                            size: fileBuffer.length,
                            contentType: metadata.contentType
                        });
                    } catch (error) {
                        reject(error);
                    }
                });

                stream.end(fileBuffer);
            });

        } catch (error) {
            console.error('Cloud Storage upload error:', error);
            throw error;
        }
    }

    /**
     * Download file from Cloud Storage
     * @param {string} fileName - File name/path
     * @returns {Promise<Buffer>} File buffer
     */
    async downloadFile(fileName) {
        try {
            const file = this.bucket.file(fileName);
            const [buffer] = await file.download();
            return buffer;
        } catch (error) {
            console.error('Cloud Storage download error:', error);
            throw error;
        }
    }

    /**
     * Delete file from Cloud Storage
     * @param {string} fileName - File name/path
     * @returns {Promise<boolean>} Success status
     */
    async deleteFile(fileName) {
        try {
            const file = this.bucket.file(fileName);
            await file.delete();
            return true;
        } catch (error) {
            console.error('Cloud Storage delete error:', error);
            throw error;
        }
    }

    /**
     * Get file metadata
     * @param {string} fileName - File name/path
     * @returns {Promise<Object>} File metadata
     */
    async getFileMetadata(fileName) {
        try {
            const file = this.bucket.file(fileName);
            const [metadata] = await file.getMetadata();
            return metadata;
        } catch (error) {
            console.error('Cloud Storage metadata error:', error);
            throw error;
        }
    }

    /**
     * List files in a folder
     * @param {string} prefix - Folder prefix
     * @param {Object} options - List options
     * @returns {Promise<Array>} List of files
     */
    async listFiles(prefix = '', options = {}) {
        try {
            const [files] = await this.bucket.getFiles({
                prefix,
                maxResults: options.limit || 100,
                pageToken: options.pageToken
            });

            return files.map(file => ({
                name: file.name,
                size: parseInt(file.metadata.size),
                contentType: file.metadata.contentType,
                created: file.metadata.timeCreated,
                updated: file.metadata.updated
            }));
        } catch (error) {
            console.error('Cloud Storage list error:', error);
            throw error;
        }
    }

    /**
     * Generate signed URL for temporary access
     * @param {string} fileName - File name/path
     * @param {Object} options - URL options
     * @returns {Promise<string>} Signed URL
     */
    async generateSignedUrl(fileName, options = {}) {
        try {
            const file = this.bucket.file(fileName);

            const [url] = await file.getSignedUrl({
                version: 'v4',
                action: options.action || 'read',
                expires: Date.now() + (options.expiresIn || 15 * 60 * 1000), // 15 minutes default
                contentType: options.contentType
            });

            return url;
        } catch (error) {
            console.error('Cloud Storage signed URL error:', error);
            throw error;
        }
    }

    /**
     * Upload patient document
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} patientId - Patient ID
     * @param {string} documentType - Document type
     * @param {string} originalName - Original file name
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Upload result
     */
    async uploadPatientDocument(fileBuffer, patientId, documentType, originalName, metadata = {}) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = originalName.split('.').pop();
        const fileName = `${timestamp}-${originalName}`;
        const folder = `patients/${patientId}/documents/${documentType}`;

        return this.uploadFile(fileBuffer, fileName, folder, {
            ...metadata,
            patientId,
            documentType,
            originalName,
            contentType: this.getContentType(extension)
        });
    }

    /**
     * Get content type from file extension
     * @param {string} extension - File extension
     * @returns {string} Content type
     */
    getContentType(extension) {
        const contentTypes = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'csv': 'text/csv'
        };

        return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
}

module.exports = new CloudStorageService();