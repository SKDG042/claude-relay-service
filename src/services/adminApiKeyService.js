const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const config = require('../../config/config')
const redis = require('../models/redis')
const logger = require('../utils/logger')

const REDIS_PREFIX = 'admin_apikey:'
const HASH_MAP_KEY = 'admin_apikey:hash_map'
const KEY_PREFIX = 'cra_'

class AdminApiKeyService {
  // Generate a new Admin API Key
  async generate({ name, description = '', createdBy = 'admin' }) {
    const id = uuidv4()
    const rawKey = `${KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`
    const hashedKey = this._hash(rawKey)

    const keyData = {
      id,
      name,
      description,
      hashedKey,
      isActive: 'true',
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      createdBy
    }

    const client = redis.getClientSafe()
    await client.hset(`${REDIS_PREFIX}${id}`, keyData)
    await client.hset(HASH_MAP_KEY, hashedKey, id)

    logger.success(`Admin API Key created: ${name} (${id}) by ${createdBy}`)

    return {
      id,
      apiKey: rawKey, // plaintext, shown only once
      name,
      description,
      isActive: true,
      createdAt: keyData.createdAt,
      createdBy
    }
  }

  // Validate a raw key for authentication
  async validate(rawKey) {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
      return null
    }

    const hashedKey = this._hash(rawKey)
    const client = redis.getClientSafe()

    const id = await client.hget(HASH_MAP_KEY, hashedKey)
    if (!id) {
      return null
    }

    const keyData = await client.hgetall(`${REDIS_PREFIX}${id}`)
    if (!keyData || !keyData.id) {
      return null
    }

    if (keyData.isActive !== 'true') {
      logger.security(`Disabled Admin API Key used: ${keyData.name} (${id})`)
      return null
    }

    // Update lastUsedAt asynchronously
    client.hset(`${REDIS_PREFIX}${id}`, 'lastUsedAt', new Date().toISOString()).catch((err) => {
      logger.warn('Failed to update Admin API Key lastUsedAt:', err.message)
    })

    return keyData
  }

  // List all Admin API Keys
  async list() {
    const client = redis.getClientSafe()
    const keys = []
    let cursor = '0'

    do {
      const [nextCursor, results] = await client.scan(
        cursor,
        'MATCH',
        `${REDIS_PREFIX}*`,
        'COUNT',
        100
      )
      cursor = nextCursor

      for (const key of results) {
        // Skip hash_map
        if (key === HASH_MAP_KEY) {
          continue
        }

        const data = await client.hgetall(key)
        if (data && data.id) {
          keys.push({
            id: data.id,
            name: data.name,
            description: data.description || '',
            isActive: data.isActive === 'true',
            createdAt: data.createdAt,
            lastUsedAt: data.lastUsedAt || null,
            createdBy: data.createdBy || 'admin'
          })
        }
      }
    } while (cursor !== '0')

    // Sort by creation time descending
    keys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return keys
  }

  // Get a single Admin API Key by ID
  async get(id) {
    const client = redis.getClientSafe()
    const data = await client.hgetall(`${REDIS_PREFIX}${id}`)
    if (!data || !data.id) {
      return null
    }
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      isActive: data.isActive === 'true',
      createdAt: data.createdAt,
      lastUsedAt: data.lastUsedAt || null,
      createdBy: data.createdBy || 'admin'
    }
  }

  // Update an Admin API Key
  async update(id, updates) {
    const client = redis.getClientSafe()
    const existing = await client.hgetall(`${REDIS_PREFIX}${id}`)
    if (!existing || !existing.id) {
      return null
    }

    const fields = {}
    if (updates.name !== undefined) {
      fields.name = updates.name
    }
    if (updates.description !== undefined) {
      fields.description = updates.description
    }
    if (updates.isActive !== undefined) {
      fields.isActive = String(updates.isActive)
    }

    if (Object.keys(fields).length > 0) {
      await client.hset(`${REDIS_PREFIX}${id}`, fields)
    }

    logger.info(`Admin API Key updated: ${existing.name} (${id})`)
    return await this.get(id)
  }

  // Delete an Admin API Key
  async delete(id) {
    const client = redis.getClientSafe()
    const existing = await client.hgetall(`${REDIS_PREFIX}${id}`)
    if (!existing || !existing.id) {
      return false
    }

    // Remove hash mapping
    if (existing.hashedKey) {
      await client.hdel(HASH_MAP_KEY, existing.hashedKey)
    }

    // Remove key data
    await client.del(`${REDIS_PREFIX}${id}`)

    logger.info(`Admin API Key deleted: ${existing.name} (${id})`)
    return true
  }

  // Hash a raw key using SHA-256 + salt (same pattern as apiKeyService)
  _hash(rawKey) {
    return crypto
      .createHash('sha256')
      .update(rawKey + config.security.encryptionKey)
      .digest('hex')
  }
}

module.exports = new AdminApiKeyService()
