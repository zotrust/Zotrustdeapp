"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get all reviews (Admin)
router.get('/', auth_1.authenticateAdmin, async (req, res) => {
    try {
        console.log('Admin reviews endpoint called');
        const { status, limit = 50, offset = 0 } = req.query;
        let query = `
      SELECT r.*, 
             u1.name as reviewer_name,
             u2.name as reviewee_name,
             o.id as order_id,
             o.amount,
             o.token,
             o.state as order_state,
             a.username as approved_by_username
      FROM reviews r
      LEFT JOIN users u1 ON r.reviewer_address = u1.address
      LEFT JOIN users u2 ON r.reviewee_address = u2.address
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN admin_users a ON r.approved_by = a.id
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (status === 'pending') {
            query += ` AND r.is_approved = false`;
        }
        else if (status === 'approved') {
            query += ` AND r.is_approved = true`;
        }
        else if (status === 'hidden') {
            query += ` AND r.is_visible = false`;
        }
        query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        console.log('Admin reviews query result:', result.rows.length, 'reviews found');
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('Get admin reviews error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Approve review (Admin)
router.post('/:id/approve', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin?.id || null;
        const result = await database_1.default.query(`
      UPDATE reviews 
      SET is_approved = true, 
          approved_by = $1, 
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [adminId, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        res.json({
            success: true,
            data: result.rows[0],
            message: 'Review approved successfully'
        });
    }
    catch (error) {
        console.error('Approve review error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Hide/Show review (Admin)
router.post('/:id/toggle-visibility', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`
      UPDATE reviews 
      SET is_visible = NOT is_visible,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        const review = result.rows[0];
        res.json({
            success: true,
            data: review,
            message: `Review ${review.is_visible ? 'shown' : 'hidden'} successfully`
        });
    }
    catch (error) {
        console.error('Toggle review visibility error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Delete review (Admin)
router.delete('/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`
      DELETE FROM reviews 
      WHERE id = $1
      RETURNING *
    `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        res.json({
            success: true,
            message: 'Review deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update review (Admin)
router.put('/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin?.id || null;
        const body = req.body;
        // Validate at least one field is provided
        const allowedFields = ['reviewer_address', 'reviewee_address', 'reviewer_name', 'reviewee_name', 'rating', 'comment', 'is_visible', 'is_approved', 'order_id'];
        const hasValidField = allowedFields.some(field => body.hasOwnProperty(field));
        if (!hasValidField) {
            return res.status(400).json({
                success: false,
                error: 'At least one field must be provided for update'
            });
        }
        // Validation errors array
        const errors = [];
        // Validate reviewer_address
        if (body.reviewer_address !== undefined) {
            if (typeof body.reviewer_address !== 'string') {
                errors.push('reviewer_address must be a string');
            }
            else {
                body.reviewer_address = body.reviewer_address.trim().toLowerCase();
                if (body.reviewer_address.length === 0) {
                    errors.push('reviewer_address cannot be empty');
                }
            }
        }
        // Validate reviewee_address
        if (body.reviewee_address !== undefined) {
            if (typeof body.reviewee_address !== 'string') {
                errors.push('reviewee_address must be a string');
            }
            else {
                body.reviewee_address = body.reviewee_address.trim().toLowerCase();
                if (body.reviewee_address.length === 0) {
                    errors.push('reviewee_address cannot be empty');
                }
            }
        }
        // Validate rating
        if (body.rating !== undefined) {
            if (typeof body.rating !== 'number' || !Number.isInteger(body.rating)) {
                errors.push('rating must be an integer');
            }
            else if (body.rating < 1 || body.rating > 5) {
                errors.push('rating must be between 1 and 5');
            }
        }
        // Validate comment
        if (body.comment !== undefined && body.comment !== null && typeof body.comment !== 'string') {
            errors.push('comment must be a string or null');
        }
        // Validate is_visible
        if (body.is_visible !== undefined && typeof body.is_visible !== 'boolean') {
            errors.push('is_visible must be a boolean');
        }
        // Validate is_approved
        if (body.is_approved !== undefined && typeof body.is_approved !== 'boolean') {
            errors.push('is_approved must be a boolean');
        }
        // Validate order_id
        if (body.order_id !== undefined && body.order_id !== null) {
            if (typeof body.order_id !== 'number' || !Number.isInteger(body.order_id)) {
                errors.push('order_id must be an integer or null');
            }
        }
        // Validate reviewer_name
        if (body.reviewer_name !== undefined && body.reviewer_name !== null) {
            if (typeof body.reviewer_name !== 'string') {
                errors.push('reviewer_name must be a string or null');
            }
            else {
                body.reviewer_name = body.reviewer_name.trim();
            }
        }
        // Validate reviewee_name
        if (body.reviewee_name !== undefined && body.reviewee_name !== null) {
            if (typeof body.reviewee_name !== 'string') {
                errors.push('reviewee_name must be a string or null');
            }
            else {
                body.reviewee_name = body.reviewee_name.trim();
            }
        }
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: errors.join(', ')
            });
        }
        const value = body;
        const fields = [];
        const params = [];
        let paramIndex = 1;
        const setField = (column, val) => {
            fields.push(`${column} = $${paramIndex}`);
            params.push(val);
            paramIndex++;
        };
        if (value.reviewer_address !== undefined) {
            setField('reviewer_address', value.reviewer_address);
        }
        if (value.reviewee_address !== undefined) {
            setField('reviewee_address', value.reviewee_address);
        }
        if (value.rating !== undefined) {
            setField('rating', value.rating);
        }
        if (value.comment !== undefined) {
            setField('comment', value.comment);
        }
        if (value.order_id !== undefined) {
            setField('order_id', value.order_id);
        }
        if (value.is_visible !== undefined) {
            setField('is_visible', value.is_visible);
        }
        if (value.is_approved !== undefined) {
            setField('is_approved', value.is_approved);
            // Don't update approved_by or approved_at when editing - only update the flag
            // approved_by and approved_at should only be set when explicitly approving via approve endpoint
        }
        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        // First, update the review
        const query = `
      UPDATE reviews
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        params.push(id);
        const result = await database_1.default.query(query, params);
        // Update user names if provided
        if (value.reviewer_name !== undefined || value.reviewer_address !== undefined) {
            const reviewerAddress = value.reviewer_address || result.rows[0].reviewer_address;
            if (value.reviewer_name !== undefined) {
                // Update or insert user for reviewer
                await database_1.default.query(`
          INSERT INTO users (address, name, updated_at)
          VALUES (LOWER($1), $2, CURRENT_TIMESTAMP)
          ON CONFLICT (address) 
          DO UPDATE SET name = $2, updated_at = CURRENT_TIMESTAMP
        `, [reviewerAddress, value.reviewer_name || null]);
            }
        }
        if (value.reviewee_name !== undefined || value.reviewee_address !== undefined) {
            const revieweeAddress = value.reviewee_address || result.rows[0].reviewee_address;
            if (value.reviewee_name !== undefined) {
                // Update or insert user for reviewee
                await database_1.default.query(`
          INSERT INTO users (address, name, updated_at)
          VALUES (LOWER($1), $2, CURRENT_TIMESTAMP)
          ON CONFLICT (address) 
          DO UPDATE SET name = $2, updated_at = CURRENT_TIMESTAMP
        `, [revieweeAddress, value.reviewee_name || null]);
            }
        }
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        // Fetch updated review with names
        const updatedReview = await database_1.default.query(`
      SELECT r.*, 
             u1.name as reviewer_name,
             u2.name as reviewee_name,
             o.id as order_id,
             o.amount,
             o.token,
             o.state as order_state,
             a.username as approved_by_username
      FROM reviews r
      LEFT JOIN users u1 ON LOWER(r.reviewer_address) = LOWER(u1.address)
      LEFT JOIN users u2 ON LOWER(r.reviewee_address) = LOWER(u2.address)
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN admin_users a ON r.approved_by = a.id
      WHERE r.id = $1
    `, [id]);
        res.json({
            success: true,
            data: updatedReview.rows[0],
            message: 'Review updated successfully'
        });
    }
    catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get review statistics (Admin)
router.get('/stats', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const result = await database_1.default.query(`
      SELECT 
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN is_approved = false THEN 1 END) as pending_reviews,
        COUNT(CASE WHEN is_visible = false THEN 1 END) as hidden_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
      FROM reviews
    `);
        const stats = result.rows[0];
        res.json({
            success: true,
            data: {
                total_reviews: parseInt(stats.total_reviews),
                approved_reviews: parseInt(stats.approved_reviews),
                pending_reviews: parseInt(stats.pending_reviews),
                hidden_reviews: parseInt(stats.hidden_reviews),
                average_rating: parseFloat(stats.average_rating || 0).toFixed(1),
                rating_breakdown: {
                    5: parseInt(stats.five_star_count),
                    4: parseInt(stats.four_star_count),
                    3: parseInt(stats.three_star_count),
                    2: parseInt(stats.two_star_count),
                    1: parseInt(stats.one_star_count)
                }
            }
        });
    }
    catch (error) {
        console.error('Get review stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
