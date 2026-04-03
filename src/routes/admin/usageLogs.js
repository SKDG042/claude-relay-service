const express = require('express')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const usageLogService = require('../../services/usageLogService')

const router = express.Router()

// 分页查询使用日志
router.get('/usage-logs', authenticateAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      sort = 'timestamp',
      order = 'DESC',
      startTime,
      endTime,
      model,
      apiKeyId,
      apiKeyName,
      accountType,
      accountId,
      httpStatus,
      requestId
    } = req.query

    const filters = {}
    if (startTime) {
      filters.startTime = startTime
    }
    if (endTime) {
      filters.endTime = endTime
    }
    if (model) {
      filters.model = model
    }
    if (apiKeyId) {
      filters.apiKeyId = apiKeyId
    }
    if (apiKeyName) {
      filters.apiKeyName = apiKeyName
    }
    if (accountType) {
      filters.accountType = accountType
    }
    if (accountId) {
      filters.accountId = accountId
    }
    if (httpStatus) {
      filters.httpStatus = httpStatus
    }
    if (requestId) {
      filters.requestId = requestId
    }

    const result = await usageLogService.queryLogs({
      filters,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      sort,
      order
    })

    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Failed to query usage logs:', error)
    return res.status(500).json({ error: 'Failed to query usage logs', message: error.message })
  }
})

// 获取使用日志统计
router.get('/usage-logs/stats', authenticateAdmin, async (req, res) => {
  try {
    const { startTime, endTime, model, apiKeyId, accountType } = req.query

    const filters = {}
    if (startTime) {
      filters.startTime = startTime
    }
    if (endTime) {
      filters.endTime = endTime
    }
    if (model) {
      filters.model = model
    }
    if (apiKeyId) {
      filters.apiKeyId = apiKeyId
    }
    if (accountType) {
      filters.accountType = accountType
    }

    const result = await usageLogService.getLogStats({ filters })

    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Failed to get usage log stats:', error)
    return res.status(500).json({ error: 'Failed to get usage log stats', message: error.message })
  }
})

// CSV 导出使用日志
router.get('/usage-logs/export', authenticateAdmin, async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      model,
      apiKeyId,
      apiKeyName,
      accountType,
      accountId,
      httpStatus,
      requestId
    } = req.query

    const filters = {}
    if (startTime) {
      filters.startTime = startTime
    }
    if (endTime) {
      filters.endTime = endTime
    }
    if (model) {
      filters.model = model
    }
    if (apiKeyId) {
      filters.apiKeyId = apiKeyId
    }
    if (apiKeyName) {
      filters.apiKeyName = apiKeyName
    }
    if (accountType) {
      filters.accountType = accountType
    }
    if (accountId) {
      filters.accountId = accountId
    }
    if (httpStatus) {
      filters.httpStatus = httpStatus
    }
    if (requestId) {
      filters.requestId = requestId
    }

    const result = await usageLogService.queryLogs({
      filters,
      page: 1,
      pageSize: 10000,
      sort: 'timestamp',
      order: 'DESC'
    })

    const { logs } = result

    const csvHeaders = [
      'request_id',
      'timestamp',
      'http_method',
      'endpoint',
      'model',
      'client_ip',
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
      'service_tier'
    ]

    const escapeCSV = (val) => {
      if (val === null || val === undefined) {
        return ''
      }
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = [csvHeaders.join(',')]
    for (const log of logs) {
      rows.push(csvHeaders.map((h) => escapeCSV(log[h])).join(','))
    }

    const csv = rows.join('\n')
    const filename = `usage-logs-${new Date().toISOString().slice(0, 10)}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(csv)
  } catch (error) {
    logger.error('Failed to export usage logs:', error)
    return res.status(500).json({ error: 'Failed to export usage logs', message: error.message })
  }
})

// 手动清理过期日志
router.delete('/usage-logs/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const { retentionDays } = req.body

    if (!retentionDays || isNaN(Number(retentionDays)) || Number(retentionDays) < 1) {
      return res.status(400).json({
        error: 'Invalid retentionDays',
        message: 'retentionDays must be a positive number'
      })
    }

    const deletedCount = await usageLogService.cleanupOldLogs(Number(retentionDays))

    return res.json({ success: true, data: { deletedCount } })
  } catch (error) {
    logger.error('Failed to cleanup usage logs:', error)
    return res.status(500).json({ error: 'Failed to cleanup usage logs', message: error.message })
  }
})

module.exports = router
