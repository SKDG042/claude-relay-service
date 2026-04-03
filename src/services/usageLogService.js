const logger = require('../utils/logger')

/**
 * 使用日志服务 - 将详细的请求日志记录到 PostgreSQL
 * 采用批量缓冲 + fire-and-forget 模式，不影响 API 响应性能
 */
class UsageLogService {
  constructor() {
    this.postgres = null
    this.buffer = []
    this.flushTimer = null
    this.maxBufferSize = 50
    this.flushIntervalMs = 2000
    this.isShuttingDown = false
  }

  /**
   * 初始化服务
   */
  initialize(postgres) {
    this.postgres = postgres
    this.startFlushTimer()
    logger.info('📊 UsageLogService initialized')
  }

  /**
   * 启动定时刷新
   */
  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        logger.error('❌ UsageLogService flush error:', err.message)
      })
    }, this.flushIntervalMs)
  }

  /**
   * 记录使用日志（fire-and-forget，不阻塞调用方）
   */
  logUsage(data) {
    if (!this.postgres || !this.postgres.isAvailable()) {
      return
    }

    this.buffer.push({
      request_id: data.requestId || null,
      timestamp: data.timestamp || new Date().toISOString(),
      http_method: data.httpMethod || null,
      endpoint: this._truncate(data.endpoint, 255),
      model: data.model || 'unknown',
      client_ip: data.clientIp || null,
      user_agent: this._truncate(data.userAgent, 512),
      is_stream: data.isStream || false,
      api_key_id: data.apiKeyId,
      api_key_name: this._truncate(data.apiKeyName, 128),
      account_id: data.accountId || null,
      account_type: data.accountType || null,
      input_tokens: data.inputTokens || 0,
      output_tokens: data.outputTokens || 0,
      cache_creation_tokens: data.cacheCreationTokens || 0,
      cache_read_tokens: data.cacheReadTokens || 0,
      total_tokens: data.totalTokens || 0,
      real_cost: data.realCost || 0,
      rated_cost: data.ratedCost || 0,
      http_status: data.httpStatus || null,
      request_duration_ms: data.requestDurationMs || null,
      stop_reason: data.stopReason || null,
      is_long_context: data.isLongContext || false,
      service_tier: data.serviceTier || null,
      extra: data.extra ? JSON.stringify(data.extra) : null
    })

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        logger.error('❌ UsageLogService buffer flush error:', err.message)
      })
    }
  }

  /**
   * 将缓冲区数据批量写入 PG
   */
  async flush() {
    if (this.buffer.length === 0 || !this.postgres || !this.postgres.isAvailable()) {
      return
    }

    const batch = this.buffer.splice(0, this.maxBufferSize)
    const columns = [
      'request_id',
      'timestamp',
      'http_method',
      'endpoint',
      'model',
      'client_ip',
      'user_agent',
      'is_stream',
      'api_key_id',
      'api_key_name',
      'account_id',
      'account_type',
      'input_tokens',
      'output_tokens',
      'cache_creation_tokens',
      'cache_read_tokens',
      'total_tokens',
      'real_cost',
      'rated_cost',
      'http_status',
      'request_duration_ms',
      'stop_reason',
      'is_long_context',
      'service_tier',
      'extra'
    ]

    const values = []
    const placeholders = []
    let paramIndex = 1

    for (const row of batch) {
      const rowPlaceholders = columns.map(() => `$${paramIndex++}`)
      placeholders.push(`(${rowPlaceholders.join(', ')})`)
      for (const col of columns) {
        values.push(row[col])
      }
    }

    const sql = `INSERT INTO usage_logs (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`

    try {
      await this.postgres.query(sql, values)
      logger.debug(`📊 Flushed ${batch.length} usage logs to PostgreSQL`)
    } catch (err) {
      logger.error(`❌ Failed to flush ${batch.length} usage logs:`, err.message)
      // 失败的日志不回填缓冲区，避免无限重试
    }
  }

  /**
   * 查询使用日志（管理员用）
   */
  async queryLogs({ filters = {}, page = 1, pageSize = 20, sort = 'timestamp', order = 'DESC' }) {
    if (!this.postgres || !this.postgres.isAvailable()) {
      return { logs: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }
    }

    const allowedSorts = [
      'timestamp',
      'total_tokens',
      'rated_cost',
      'real_cost',
      'request_duration_ms',
      'input_tokens',
      'output_tokens'
    ]
    const safeSort = allowedSorts.includes(sort) ? sort : 'timestamp'
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC'

    const { whereClause, params } = this._buildWhereClause(filters)
    const offset = (page - 1) * pageSize

    const countSql = `SELECT COUNT(*) as total FROM usage_logs ${whereClause}`
    const countResult = await this.postgres.query(countSql, params)
    const total = parseInt(countResult.rows[0].total)

    const dataSql = `SELECT * FROM usage_logs ${whereClause} ORDER BY ${safeSort} ${safeOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    const dataResult = await this.postgres.query(dataSql, [...params, pageSize, offset])

    return {
      logs: dataResult.rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }

  /**
   * 查询指定 API Key 的使用日志（用户用）
   */
  async queryLogsByApiKey(apiKeyId, { filters = {}, page = 1, pageSize = 20 }) {
    return this.queryLogs({
      filters: { ...filters, apiKeyId },
      page,
      pageSize
    })
  }

  /**
   * 获取使用日志统计
   */
  async getLogStats({ filters = {} } = {}) {
    if (!this.postgres || !this.postgres.isAvailable()) {
      return null
    }

    const { whereClause, params } = this._buildWhereClause(filters)

    const sql = `
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(rated_cost), 0) as total_rated_cost,
        COALESCE(SUM(real_cost), 0) as total_real_cost,
        COALESCE(AVG(request_duration_ms), 0) as avg_duration_ms,
        COUNT(DISTINCT api_key_id) as unique_api_keys,
        COUNT(DISTINCT model) as unique_models
      FROM usage_logs ${whereClause}
    `
    const result = await this.postgres.query(sql, params)

    // 按模型分组统计
    const modelSql = `
      SELECT
        model,
        COUNT(*) as request_count,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(rated_cost), 0) as total_cost
      FROM usage_logs ${whereClause}
      GROUP BY model
      ORDER BY total_cost DESC
      LIMIT 20
    `
    const modelResult = await this.postgres.query(modelSql, params)

    return {
      summary: result.rows[0],
      byModel: modelResult.rows
    }
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(retentionDays) {
    if (!this.postgres || !this.postgres.isAvailable()) {
      return 0
    }

    const sql = `DELETE FROM usage_logs WHERE timestamp < NOW() - INTERVAL '${parseInt(retentionDays)} days'`
    try {
      const result = await this.postgres.query(sql)
      const deletedCount = result.rowCount
      if (deletedCount > 0) {
        logger.info(`🧹 Cleaned up ${deletedCount} usage logs older than ${retentionDays} days`)
      }
      return deletedCount
    } catch (err) {
      logger.error('❌ Failed to cleanup old logs:', err.message)
      return 0
    }
  }

  /**
   * 构建 WHERE 子句
   */
  _buildWhereClause(filters) {
    const conditions = []
    const params = []
    let paramIndex = 1

    if (filters.apiKeyId) {
      conditions.push(`api_key_id = $${paramIndex++}`)
      params.push(filters.apiKeyId)
    }

    if (filters.model) {
      conditions.push(`model ILIKE $${paramIndex++}`)
      params.push(`%${filters.model}%`)
    }

    if (filters.accountType) {
      conditions.push(`account_type = $${paramIndex++}`)
      params.push(filters.accountType)
    }

    if (filters.accountId) {
      conditions.push(`account_id = $${paramIndex++}`)
      params.push(filters.accountId)
    }

    if (filters.httpStatus) {
      conditions.push(`http_status = $${paramIndex++}`)
      params.push(parseInt(filters.httpStatus))
    }

    if (filters.requestId) {
      conditions.push(`request_id = $${paramIndex++}`)
      params.push(filters.requestId)
    }

    if (filters.startTime) {
      conditions.push(`timestamp >= $${paramIndex++}`)
      params.push(filters.startTime)
    }

    if (filters.endTime) {
      conditions.push(`timestamp <= $${paramIndex++}`)
      params.push(filters.endTime)
    }

    if (filters.minCost) {
      conditions.push(`rated_cost >= $${paramIndex++}`)
      params.push(parseFloat(filters.minCost))
    }

    if (filters.apiKeyName) {
      conditions.push(`api_key_name ILIKE $${paramIndex++}`)
      params.push(`%${filters.apiKeyName}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return { whereClause, params }
  }

  /**
   * 截断字符串
   */
  _truncate(str, maxLen) {
    if (!str) {
      return null
    }
    return str.length > maxLen ? str.substring(0, maxLen) : str
  }

  /**
   * 关闭服务
   */
  async shutdown() {
    this.isShuttingDown = true
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    // 刷新剩余缓冲区
    await this.flush()
    logger.info('📊 UsageLogService shut down')
  }
}

module.exports = new UsageLogService()
