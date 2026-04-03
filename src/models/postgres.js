const { Pool } = require('pg')
const config = require('../../config/config')
const logger = require('../utils/logger')

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(64),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_method VARCHAR(10),
  endpoint VARCHAR(255),
  model VARCHAR(128),
  client_ip VARCHAR(64),
  user_agent VARCHAR(512),
  is_stream BOOLEAN DEFAULT false,
  api_key_id VARCHAR(64) NOT NULL,
  api_key_name VARCHAR(128),
  account_id VARCHAR(128),
  account_type VARCHAR(32),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  real_cost NUMERIC(12,6) DEFAULT 0,
  rated_cost NUMERIC(12,6) DEFAULT 0,
  http_status SMALLINT,
  request_duration_ms INTEGER,
  stop_reason VARCHAR(64),
  is_long_context BOOLEAN DEFAULT false,
  service_tier VARCHAR(32),
  extra JSONB
)
`

const CREATE_INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs (timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key_timestamp ON usage_logs (api_key_id, timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_usage_logs_model_timestamp ON usage_logs (model, timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_usage_logs_account_timestamp ON usage_logs (account_id, timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_usage_logs_request_id ON usage_logs (request_id)'
]

class PostgresClient {
  constructor() {
    this.pool = null
    this.isConnected = false
  }

  async connect() {
    const pgConfig = config.postgres
    if (!pgConfig || !pgConfig.enabled) {
      logger.info('PostgreSQL disabled, skipping connection')
      return
    }

    try {
      this.pool = new Pool({
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user,
        password: pgConfig.password,
        max: pgConfig.maxPoolSize,
        idleTimeoutMillis: pgConfig.idleTimeoutMs,
        connectionTimeoutMillis: pgConfig.connectionTimeoutMs
      })

      this.pool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', err.message)
      })

      // 测试连接
      const client = await this.pool.connect()
      client.release()

      this.isConnected = true
      logger.info('PostgreSQL connected successfully')

      await this.ensureSchema()
    } catch (err) {
      logger.error('PostgreSQL connection failed:', err.message)
      this.isConnected = false
    }
  }

  async ensureSchema() {
    try {
      await this.pool.query(CREATE_TABLE_SQL)
      for (const sql of CREATE_INDEXES_SQL) {
        await this.pool.query(sql)
      }
      logger.info('PostgreSQL schema ensured')
    } catch (err) {
      logger.error('PostgreSQL ensureSchema failed:', err.message)
      throw err
    }
  }

  async query(sql, params) {
    if (!this.pool || !this.isConnected) {
      throw new Error('PostgreSQL is not connected')
    }
    try {
      return await this.pool.query(sql, params)
    } catch (err) {
      logger.error('PostgreSQL query error:', err.message)
      throw err
    }
  }

  isAvailable() {
    return this.isConnected && this.pool !== null
  }

  async disconnect() {
    if (this.pool) {
      try {
        await this.pool.end()
        this.isConnected = false
        this.pool = null
        logger.info('PostgreSQL disconnected')
      } catch (err) {
        logger.error('PostgreSQL disconnect error:', err.message)
      }
    }
  }

  getStats() {
    if (!this.pool) {
      return { available: false }
    }
    return {
      available: this.isConnected,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    }
  }
}

const postgresClient = new PostgresClient()

module.exports = postgresClient
