/**
 * EcoDigital - User Notes Routes
 * Routes for personal user notes management
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/v1/notes/user/:userId
 * @desc Get notes for a specific user
 * @access Private
 */
router.get('/user/:userId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUserId = req.user.id_usuario;
        const { 
            page = 1, 
            limit = 20, 
            patientId, 
            tags, 
            search,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        // Users can only access their own notes unless they're admin
        if (parseInt(userId) !== requestingUserId && req.user.id_role !== 1) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only view your own notes.'
            });
        }

        // Build dynamic query
        let whereConditions = ['user_id = $1'];
        let queryParams = [userId];
        let paramIndex = 2;

        // Add patient filter
        if (patientId) {
            whereConditions.push(`patient_id = $${paramIndex}`);
            queryParams.push(patientId);
            paramIndex++;
        }

        // Add tags filter
        if (tags) {
            const tagArray = Array.isArray(tags) ? tags : [tags];
            whereConditions.push(`tags && $${paramIndex}`);
            queryParams.push(tagArray);
            paramIndex++;
        }

        // Add search filter
        if (search) {
            whereConditions.push(`content ILIKE $${paramIndex}`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        // Validate sort parameters
        const validSortColumns = ['created_at', 'updated_at', 'content'];
        const validSortOrders = ['ASC', 'DESC'];
        
        const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM user_notes 
            WHERE ${whereClause}
        `;

        const countResult = await query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);

        // Get notes with patient information
        const notesQuery = `
            SELECT 
                n.id,
                n.content,
                n.patient_id,
                n.is_private,
                n.tags,
                n.created_at,
                n.updated_at,
                CASE 
                    WHEN n.patient_id IS NOT NULL THEN 
                        CONCAT(p.nombre, ' ', p.apellido)
                    ELSE NULL 
                END as patient_name
            FROM user_notes n
            LEFT JOIN PACIENTES p ON n.patient_id = p.id
            WHERE ${whereClause}
            ORDER BY ${safeSortBy} ${safeSortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        queryParams.push(parseInt(limit), offset);

        const notesResult = await query(notesQuery, queryParams);

        res.status(200).json({
            success: true,
            data: {
                notes: notesResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            },
            message: 'Notes retrieved successfully'
        });

    } catch (error) {
        console.error('Get user notes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve notes',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/notes/:noteId
 * @desc Get a specific note by ID
 * @access Private
 */
router.get('/:noteId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.user.id_usuario;

        const noteQuery = `
            SELECT 
                n.id,
                n.content,
                n.patient_id,
                n.is_private,
                n.tags,
                n.created_at,
                n.updated_at,
                CASE 
                    WHEN n.patient_id IS NOT NULL THEN 
                        CONCAT(p.nombre, ' ', p.apellido)
                    ELSE NULL 
                END as patient_name
            FROM user_notes n
            LEFT JOIN PACIENTES p ON n.patient_id = p.id
            WHERE n.id = $1 AND n.user_id = $2
        `;

        const result = await query(noteQuery, [noteId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note not found or access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0],
            message: 'Note retrieved successfully'
        });

    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve note',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/notes
 * @desc Create a new note
 * @access Private
 */
router.post('/', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { content, patientId, isPrivate = true, tags = [] } = req.body;
        const userId = req.user.id_usuario;

        // Validate input
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Note content is required'
            });
        }

        if (content.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Note content is too long (maximum 10,000 characters)'
            });
        }

        // Validate patient exists if patientId provided
        if (patientId) {
            const patientCheck = await query(
                'SELECT id FROM PACIENTES WHERE id = $1 AND activo = TRUE',
                [patientId]
            );

            if (patientCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found or inactive'
                });
            }
        }

        // Validate tags
        if (!Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                error: 'Tags must be an array'
            });
        }

        const insertQuery = `
            INSERT INTO user_notes (user_id, content, patient_id, is_private, tags)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, created_at, updated_at
        `;

        const result = await query(insertQuery, [
            userId,
            content.trim(),
            patientId || null,
            isPrivate,
            tags
        ]);

        const newNote = result.rows[0];

        res.status(201).json({
            success: true,
            data: {
                id: newNote.id,
                content: content.trim(),
                patientId: patientId || null,
                isPrivate,
                tags,
                createdAt: newNote.created_at,
                updatedAt: newNote.updated_at
            },
            message: 'Note created successfully'
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create note',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route PUT /api/v1/notes/:noteId
 * @desc Update an existing note
 * @access Private
 */
router.put('/:noteId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { noteId } = req.params;
        const { content, patientId, isPrivate, tags } = req.body;
        const userId = req.user.id_usuario;

        // Validate input
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Note content is required'
            });
        }

        if (content.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Note content is too long (maximum 10,000 characters)'
            });
        }

        // Check if note exists and belongs to user
        const noteCheck = await query(
            'SELECT id FROM user_notes WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note not found or access denied'
            });
        }

        // Validate patient exists if patientId provided
        if (patientId) {
            const patientCheck = await query(
                'SELECT id FROM PACIENTES WHERE id = $1 AND activo = TRUE',
                [patientId]
            );

            if (patientCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found or inactive'
                });
            }
        }

        // Build update query dynamically
        const updateFields = [];
        const updateParams = [];
        let paramIndex = 1;

        updateFields.push(`content = $${paramIndex++}`);
        updateParams.push(content.trim());

        if (patientId !== undefined) {
            updateFields.push(`patient_id = $${paramIndex++}`);
            updateParams.push(patientId);
        }

        if (isPrivate !== undefined) {
            updateFields.push(`is_private = $${paramIndex++}`);
            updateParams.push(isPrivate);
        }

        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                return res.status(400).json({
                    success: false,
                    error: 'Tags must be an array'
                });
            }
            updateFields.push(`tags = $${paramIndex++}`);
            updateParams.push(tags);
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add WHERE conditions
        updateParams.push(noteId, userId);

        const updateQuery = `
            UPDATE user_notes 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
            RETURNING id, content, patient_id, is_private, tags, created_at, updated_at
        `;

        const result = await query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note not found or update failed'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0],
            message: 'Note updated successfully'
        });

    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update note',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route DELETE /api/v1/notes/:noteId
 * @desc Delete a note
 * @access Private
 */
router.delete('/:noteId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.user.id_usuario;

        const deleteQuery = `
            DELETE FROM user_notes 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;

        const result = await query(deleteQuery, [noteId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note not found or access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: { deletedId: result.rows[0].id },
            message: 'Note deleted successfully'
        });

    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete note',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/notes/tags/popular
 * @desc Get popular tags for user
 * @access Private
 */
router.get('/tags/popular', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        const { limit = 10 } = req.query;

        const tagsQuery = `
            SELECT 
                unnest(tags) as tag,
                COUNT(*) as usage_count
            FROM user_notes 
            WHERE user_id = $1 AND array_length(tags, 1) > 0
            GROUP BY tag
            ORDER BY usage_count DESC, tag ASC
            LIMIT $2
        `;

        const result = await query(tagsQuery, [userId, parseInt(limit)]);

        res.status(200).json({
            success: true,
            data: result.rows,
            message: 'Popular tags retrieved successfully'
        });

    } catch (error) {
        console.error('Get popular tags error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve popular tags',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/notes/bulk-delete
 * @desc Delete multiple notes
 * @access Private
 */
router.post('/bulk-delete', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { noteIds } = req.body;
        const userId = req.user.id_usuario;

        if (!Array.isArray(noteIds) || noteIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Note IDs array is required'
            });
        }

        if (noteIds.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete more than 100 notes at once'
            });
        }

        const placeholders = noteIds.map((_, index) => `$${index + 2}`).join(',');
        
        const deleteQuery = `
            DELETE FROM user_notes 
            WHERE user_id = $1 AND id IN (${placeholders})
            RETURNING id
        `;

        const result = await query(deleteQuery, [userId, ...noteIds]);

        res.status(200).json({
            success: true,
            data: {
                deletedIds: result.rows.map(row => row.id),
                deletedCount: result.rows.length,
                requestedCount: noteIds.length
            },
            message: `${result.rows.length} notes deleted successfully`
        });

    } catch (error) {
        console.error('Bulk delete notes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete notes',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;