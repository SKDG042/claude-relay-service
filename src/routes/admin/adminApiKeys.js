const express = require('express')
const { authenticateAdmin } = require('../../middleware/auth')
const adminApiKeyService = require('../../services/adminApiKeyService')
const logger = require('../../utils/logger')

const router = express.Router()

// GET /admin/admin-api-keys - List all Admin API Keys
router.get('/admin-api-keys', authenticateAdmin, async (req, res) => {
  try {
    const keys = await adminApiKeyService.list()
    res.json({ success: true, data: keys })
  } catch (error) {
    logger.error('Failed to list Admin API Keys:', error)
    res.status(500).json({ success: false, message: 'Failed to list Admin API Keys' })
  }
})

// POST /admin/admin-api-keys - Create a new Admin API Key
router.post('/admin-api-keys', authenticateAdmin, async (req, res) => {
  try {
    const { name, description } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Name is required' })
    }

    if (name.length > 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Name must be less than 100 characters' })
    }

    if (description && (typeof description !== 'string' || description.length > 500)) {
      return res
        .status(400)
        .json({ success: false, message: 'Description must be less than 500 characters' })
    }

    const result = await adminApiKeyService.generate({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: req.admin.username
    })

    res.status(201).json({ success: true, data: result })
  } catch (error) {
    logger.error('Failed to create Admin API Key:', error)
    res.status(500).json({ success: false, message: 'Failed to create Admin API Key' })
  }
})

// PUT /admin/admin-api-keys/:keyId - Update an Admin API Key
router.put('/admin-api-keys/:keyId', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const { name, description, isActive } = req.body

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'Name must be a non-empty string' })
    }

    if (name && name.length > 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Name must be less than 100 characters' })
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'Description must be a string' })
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean' })
    }

    const updates = {}
    if (name !== undefined) {
      updates.name = name.trim()
    }
    if (description !== undefined) {
      updates.description = description.trim()
    }
    if (isActive !== undefined) {
      updates.isActive = isActive
    }

    const result = await adminApiKeyService.update(keyId, updates)
    if (!result) {
      return res.status(404).json({ success: false, message: 'Admin API Key not found' })
    }

    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Failed to update Admin API Key:', error)
    res.status(500).json({ success: false, message: 'Failed to update Admin API Key' })
  }
})

// DELETE /admin/admin-api-keys/:keyId - Delete an Admin API Key
router.delete('/admin-api-keys/:keyId', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const deleted = await adminApiKeyService.delete(keyId)

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Admin API Key not found' })
    }

    res.json({ success: true, message: 'Admin API Key deleted' })
  } catch (error) {
    logger.error('Failed to delete Admin API Key:', error)
    res.status(500).json({ success: false, message: 'Failed to delete Admin API Key' })
  }
})

module.exports = router
