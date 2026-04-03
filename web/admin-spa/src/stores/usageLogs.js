import { defineStore } from 'pinia'
import { ref } from 'vue'

import * as httpApis from '@/utils/http_apis'

export const useUsageLogsStore = defineStore('usageLogs', () => {
  const logs = ref([])
  const pagination = ref({ total: 0, page: 1, pageSize: 20, totalPages: 0 })
  const stats = ref(null)
  const loading = ref(false)
  const statsLoading = ref(false)
  const filters = ref({
    startTime: '',
    endTime: '',
    model: '',
    apiKeyId: '',
    apiKeyName: '',
    accountType: '',
    httpStatus: '',
    requestId: ''
  })
  const sort = ref('timestamp')
  const order = ref('DESC')

  const fetchLogs = async () => {
    loading.value = true
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      sort: sort.value,
      order: order.value
    }
    const f = filters.value
    if (f.startTime) params.startTime = f.startTime
    if (f.endTime) params.endTime = f.endTime
    if (f.model) params.model = f.model
    if (f.apiKeyId) params.apiKeyId = f.apiKeyId
    if (f.apiKeyName) params.apiKeyName = f.apiKeyName
    if (f.accountType) params.accountType = f.accountType
    if (f.httpStatus) params.httpStatus = f.httpStatus
    if (f.requestId) params.requestId = f.requestId
    const res = await httpApis.getUsageLogsApi(params)
    if (res.success) {
      logs.value = res.data || []
      if (res.pagination) pagination.value = { ...pagination.value, ...res.pagination }
    }
    loading.value = false
    return res
  }

  const fetchStats = async () => {
    statsLoading.value = true
    const params = {}
    const f = filters.value
    if (f.startTime) params.startTime = f.startTime
    if (f.endTime) params.endTime = f.endTime
    if (f.model) params.model = f.model
    if (f.apiKeyId) params.apiKeyId = f.apiKeyId
    if (f.apiKeyName) params.apiKeyName = f.apiKeyName
    if (f.accountType) params.accountType = f.accountType
    const res = await httpApis.getUsageLogsStatsApi(params)
    if (res.success) stats.value = res.data || res.stats || null
    statsLoading.value = false
    return res
  }

  const exportLogs = async () => {
    const params = {}
    const f = filters.value
    if (f.startTime) params.startTime = f.startTime
    if (f.endTime) params.endTime = f.endTime
    if (f.model) params.model = f.model
    if (f.apiKeyId) params.apiKeyId = f.apiKeyId
    if (f.apiKeyName) params.apiKeyName = f.apiKeyName
    if (f.accountType) params.accountType = f.accountType
    if (f.httpStatus) params.httpStatus = f.httpStatus
    if (f.requestId) params.requestId = f.requestId
    params.sort = sort.value
    params.order = order.value
    const res = await httpApis.exportUsageLogsApi(params)
    return res
  }

  const cleanupLogs = async (retentionDays) => {
    const res = await httpApis.cleanupUsageLogsApi({ retentionDays })
    return res
  }

  const resetFilters = () => {
    filters.value = {
      startTime: '',
      endTime: '',
      model: '',
      apiKeyId: '',
      apiKeyName: '',
      accountType: '',
      httpStatus: '',
      requestId: ''
    }
    pagination.value = { ...pagination.value, page: 1 }
  }

  return {
    logs,
    pagination,
    stats,
    loading,
    statsLoading,
    filters,
    sort,
    order,
    fetchLogs,
    fetchStats,
    exportLogs,
    cleanupLogs,
    resetFilters
  }
})
