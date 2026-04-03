<template>
  <div class="tab-content">
    <!-- 统计概览卡片 -->
    <div class="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              总请求数
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ statsLoading ? '-' : formatNumber(stats?.totalRequests) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
            <i class="fas fa-paper-plane" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              总 Token
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ statsLoading ? '-' : formatNumber(stats?.totalTokens) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-purple-500 to-purple-600">
            <i class="fas fa-coins" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              总费用
            </p>
            <p class="text-2xl font-bold text-yellow-600 dark:text-yellow-400 sm:text-3xl">
              {{ statsLoading ? '-' : formatCost(stats?.totalCost) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-yellow-500 to-orange-500">
            <i class="fas fa-dollar-sign" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              平均延迟
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ statsLoading ? '-' : formatDuration(stats?.avgLatency) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-green-500 to-emerald-600">
            <i class="fas fa-tachometer-alt" />
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="glass-strong mb-4 rounded-2xl p-4 shadow-sm sm:mb-6 sm:p-5">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <!-- 时间范围 -->
          <el-date-picker
            v-model="dateRange"
            class="!w-auto"
            clearable
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            style="width: 340px"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss.000Z"
            @change="onDateRangeChange"
          />

          <!-- 模型 -->
          <el-input v-model="filters.model" clearable placeholder="模型名称" style="width: 180px">
            <template #prefix>
              <i class="fas fa-cube text-gray-400" />
            </template>
          </el-input>

          <!-- API Key 名称 -->
          <el-input
            v-model="filters.apiKeyName"
            clearable
            placeholder="API Key 名称"
            style="width: 180px"
          >
            <template #prefix>
              <i class="fas fa-key text-gray-400" />
            </template>
          </el-input>

          <!-- 账户类型 -->
          <el-select
            v-model="filters.accountType"
            clearable
            placeholder="账户类型"
            style="width: 180px"
          >
            <el-option label="Claude Official" value="claude-official" />
            <el-option label="Claude Console" value="claude-console" />
            <el-option label="Gemini" value="gemini" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="Bedrock" value="bedrock" />
            <el-option label="Azure OpenAI" value="azure-openai" />
            <el-option label="Droid" value="droid" />
            <el-option label="CCR" value="ccr" />
          </el-select>

          <!-- 状态码 -->
          <el-select
            v-model="filters.httpStatus"
            clearable
            placeholder="状态码"
            style="width: 130px"
          >
            <el-option label="200" value="200" />
            <el-option label="400" value="400" />
            <el-option label="401" value="401" />
            <el-option label="429" value="429" />
            <el-option label="500" value="500" />
            <el-option label="502" value="502" />
            <el-option label="503" value="503" />
          </el-select>

          <!-- Request ID -->
          <el-input
            v-model="filters.requestId"
            clearable
            placeholder="Request ID"
            style="width: 200px"
          >
            <template #prefix>
              <i class="fas fa-fingerprint text-gray-400" />
            </template>
          </el-input>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <el-button :loading="loading" type="primary" @click="handleSearch">
            <i class="fas fa-search mr-2" />
            查询
          </el-button>
          <el-button @click="handleReset">
            <i class="fas fa-undo mr-2" />
            重置
          </el-button>
          <div class="ml-auto flex items-center gap-2">
            <el-button :loading="exporting" @click="handleExport">
              <i class="fas fa-file-export mr-2" />
              导出 CSV
            </el-button>
            <el-button plain type="danger" @click="showCleanupDialog = true">
              <i class="fas fa-trash-alt mr-2" />
              清理日志
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="glass-strong rounded-2xl shadow-sm">
      <el-table
        :data="logs"
        :default-sort="{ prop: 'timestamp', order: 'descending' }"
        :loading="loading"
        row-class-name="cursor-pointer"
        style="width: 100%; background: transparent"
        @row-click="openDetail"
        @sort-change="handleSortChange"
      >
        <!-- 时间 -->
        <el-table-column label="时间" min-width="160" prop="timestamp" sortable="custom">
          <template #default="{ row }">
            <span class="whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
              {{ formatTime(row.timestamp) }}
            </span>
          </template>
        </el-table-column>

        <!-- 模型 -->
        <el-table-column label="模型" min-width="160" prop="model">
          <template #default="{ row }">
            <span
              class="max-w-[140px] truncate text-sm text-gray-700 dark:text-gray-200"
              :title="row.model"
            >
              {{ row.model || '-' }}
            </span>
          </template>
        </el-table-column>

        <!-- API Key -->
        <el-table-column label="API Key" min-width="140">
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ row.apiKeyName || '-' }}
              </span>
              <span v-if="row.apiKeyId" class="text-xs text-gray-400 dark:text-gray-500">
                {{ row.apiKeyId }}
              </span>
            </div>
          </template>
        </el-table-column>

        <!-- 账户类型 -->
        <el-table-column class-name="hidden sm:table-cell" label="账户类型" min-width="110">
          <template #default="{ row }">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ row.accountType || '-' }}
            </span>
          </template>
        </el-table-column>

        <!-- 输入 Token -->
        <el-table-column
          class-name="hidden md:table-cell"
          label="输入 Token"
          min-width="100"
          prop="inputTokens"
        >
          <template #default="{ row }">
            <span class="text-sm text-blue-600 dark:text-blue-400">
              {{ formatNumber(row.inputTokens) }}
            </span>
          </template>
        </el-table-column>

        <!-- 输出 Token -->
        <el-table-column
          class-name="hidden md:table-cell"
          label="输出 Token"
          min-width="100"
          prop="outputTokens"
        >
          <template #default="{ row }">
            <span class="text-sm text-green-600 dark:text-green-400">
              {{ formatNumber(row.outputTokens) }}
            </span>
          </template>
        </el-table-column>

        <!-- 缓存 Token -->
        <el-table-column class-name="hidden lg:table-cell" label="缓存 Token" min-width="110">
          <template #default="{ row }">
            <span class="text-sm text-purple-600 dark:text-purple-400">
              {{ formatNumber(row.cacheReadTokens) }}
            </span>
          </template>
        </el-table-column>

        <!-- 总 Token -->
        <el-table-column label="总 Token" min-width="100" prop="totalTokens" sortable="custom">
          <template #default="{ row }">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
              {{ formatNumber(row.totalTokens) }}
            </span>
          </template>
        </el-table-column>

        <!-- 费用 -->
        <el-table-column label="费用" min-width="110" prop="cost" sortable="custom">
          <template #default="{ row }">
            <span class="text-sm text-yellow-600 dark:text-yellow-400">
              {{ formatCost(row.cost) }}
            </span>
          </template>
        </el-table-column>

        <!-- 延迟 -->
        <el-table-column
          class-name="hidden sm:table-cell"
          label="延迟"
          min-width="90"
          prop="latency"
          sortable="custom"
        >
          <template #default="{ row }">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ formatDuration(row.latency) }}
            </span>
          </template>
        </el-table-column>

        <!-- 状态码 -->
        <el-table-column label="状态码" min-width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusType(row.httpStatus)">
              {{ row.httpStatus || '-' }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 请求方式 -->
        <el-table-column class-name="hidden lg:table-cell" label="方式" min-width="80">
          <template #default="{ row }">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ row.method || '-' }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div
        class="flex flex-col items-center justify-between gap-3 border-t border-gray-200/50 p-4 dark:border-gray-700/50 sm:flex-row"
      >
        <span class="text-sm text-gray-500 dark:text-gray-400">
          共 {{ pagination.total }} 条记录
        </span>
        <el-pagination
          background
          :current-page="pagination.page"
          layout="prev, pager, next, sizes"
          :page-size="pagination.pageSize"
          :page-sizes="[20, 50, 100, 200]"
          :total="pagination.total"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      size="480px"
      :title="'请求详情'"
      :with-header="true"
    >
      <div v-if="activeLog" class="space-y-6 p-2">
        <!-- 请求信息 -->
        <div>
          <h4
            class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            请求信息
          </h4>
          <dl class="space-y-2">
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">时间</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ formatTime(activeLog.timestamp) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Request ID</dt>
              <dd
                class="max-w-[280px] break-all text-right text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                {{ activeLog.requestId || '-' }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">模型</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ activeLog.model || '-' }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">API Key</dt>
              <dd class="text-right text-sm font-medium text-gray-700 dark:text-gray-200">
                <div>{{ activeLog.apiKeyName || '-' }}</div>
                <div v-if="activeLog.apiKeyId" class="text-xs text-gray-400 dark:text-gray-500">
                  {{ activeLog.apiKeyId }}
                </div>
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">账户类型</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ activeLog.accountType || '-' }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">请求方式</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ activeLog.method || '-' }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="border-t border-gray-200/50 dark:border-gray-700/50" />

        <!-- Token 用量 -->
        <div>
          <h4
            class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Token 用量
          </h4>
          <dl class="space-y-2">
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">输入 Token</dt>
              <dd class="text-sm font-medium text-blue-600 dark:text-blue-400">
                {{ formatNumber(activeLog.inputTokens) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">输出 Token</dt>
              <dd class="text-sm font-medium text-green-600 dark:text-green-400">
                {{ formatNumber(activeLog.outputTokens) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">缓存创建 Token</dt>
              <dd class="text-sm font-medium text-purple-600 dark:text-purple-400">
                {{ formatNumber(activeLog.cacheCreateTokens) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">缓存读取 Token</dt>
              <dd class="text-sm font-medium text-purple-600 dark:text-purple-400">
                {{ formatNumber(activeLog.cacheReadTokens) }}
              </dd>
            </div>
            <div
              class="flex justify-between gap-4 border-t border-gray-200/50 pt-2 dark:border-gray-700/50"
            >
              <dt class="text-sm font-semibold text-gray-700 dark:text-gray-200">总 Token</dt>
              <dd class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ formatNumber(activeLog.totalTokens) }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="border-t border-gray-200/50 dark:border-gray-700/50" />

        <!-- 费用信息 -->
        <div>
          <h4
            class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            费用信息
          </h4>
          <dl class="space-y-2">
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">费用 (rated)</dt>
              <dd class="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                {{ formatCost(activeLog.cost) }}
              </dd>
            </div>
            <div v-if="activeLog.inputCost != null" class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">输入费用</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ formatCost(activeLog.inputCost) }}
              </dd>
            </div>
            <div v-if="activeLog.outputCost != null" class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">输出费用</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ formatCost(activeLog.outputCost) }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="border-t border-gray-200/50 dark:border-gray-700/50" />

        <!-- 响应信息 -->
        <div>
          <h4
            class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            响应信息
          </h4>
          <dl class="space-y-2">
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">状态码</dt>
              <dd>
                <el-tag size="small" :type="getStatusType(activeLog.httpStatus)">
                  {{ activeLog.httpStatus || '-' }}
                </el-tag>
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">延迟</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ formatDuration(activeLog.latency) }}
              </dd>
            </div>
            <div v-if="activeLog.streaming != null" class="flex justify-between gap-4">
              <dt class="text-sm text-gray-500 dark:text-gray-400">流式响应</dt>
              <dd class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ activeLog.streaming ? '是' : '否' }}
              </dd>
            </div>
            <div v-if="activeLog.errorMessage" class="flex flex-col gap-1">
              <dt class="text-sm text-gray-500 dark:text-gray-400">错误信息</dt>
              <dd
                class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {{ activeLog.errorMessage }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </el-drawer>

    <!-- 清理对话框 -->
    <el-dialog v-model="showCleanupDialog" title="清理日志" width="400px">
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          将删除指定天数之前的日志记录，此操作不可撤销。
        </p>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-700 dark:text-gray-200">保留最近</span>
          <el-input-number v-model="cleanupDays" :max="365" :min="1" style="width: 120px" />
          <span class="text-sm text-gray-700 dark:text-gray-200">天</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCleanupDialog = false">取消</el-button>
        <el-button :loading="cleaning" type="danger" @click="handleCleanup">确认清理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useUsageLogsStore } from '@/stores/usageLogs'

const store = useUsageLogsStore()
const { logs, pagination, stats, loading, statsLoading, filters, sort, order } = storeToRefs(store)
const { fetchLogs, fetchStats, exportLogs, cleanupLogs, resetFilters } = store

// 本地状态
const dateRange = ref(null)
const drawerVisible = ref(false)
const activeLog = ref(null)
const exporting = ref(false)
const cleaning = ref(false)
const showCleanupDialog = ref(false)
const cleanupDays = ref(30)

// 格式化工具函数
function formatNumber(n) {
  if (n == null || n === '') return '-'
  return Number(n).toLocaleString('zh-CN')
}

function formatCost(n) {
  if (n == null || n === '') return '-'
  const v = Number(n)
  if (isNaN(v)) return '-'
  return '$' + v.toFixed(6)
}

function formatDuration(ms) {
  if (ms == null || ms === '') return '-'
  const v = Number(ms)
  if (isNaN(v)) return '-'
  return v.toLocaleString('zh-CN') + 'ms'
}

function formatTime(iso) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds())
    )
  } catch {
    return iso
  }
}

function getStatusType(code) {
  if (!code) return 'info'
  const c = Number(code)
  if (c === 200 || c === 201) return 'success'
  if (c >= 400 && c < 500) return 'warning'
  if (c >= 500) return 'danger'
  return 'info'
}

// 日期范围变化
function onDateRangeChange(val) {
  if (val && val.length === 2) {
    filters.value.startTime = val[0]
    filters.value.endTime = val[1]
  } else {
    filters.value.startTime = ''
    filters.value.endTime = ''
  }
}

// 排序变化
function handleSortChange({ prop, order: elOrder }) {
  if (prop) {
    sort.value = prop
    order.value = elOrder === 'ascending' ? 'ASC' : 'DESC'
  }
  pagination.value.page = 1
  fetchLogs()
}

// 搜索
async function handleSearch() {
  pagination.value.page = 1
  await Promise.all([fetchLogs(), fetchStats()])
}

// 重置
async function handleReset() {
  dateRange.value = null
  resetFilters()
  await Promise.all([fetchLogs(), fetchStats()])
}

// 翻页
function handlePageChange(page) {
  pagination.value.page = page
  fetchLogs()
}

// 页大小变化
function handleSizeChange(size) {
  pagination.value.pageSize = size
  pagination.value.page = 1
  fetchLogs()
}

// 打开详情
function openDetail(row) {
  activeLog.value = row
  drawerVisible.value = true
}

// 导出
async function handleExport() {
  exporting.value = true
  try {
    const res = await exportLogs()
    if (res && res instanceof Blob) {
      const url = URL.createObjectURL(res)
      const a = document.createElement('a')
      a.href = url
      a.download = 'usage-logs-' + new Date().toISOString().slice(0, 10) + '.csv'
      a.click()
      URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
    } else if (res && !res.success) {
      ElMessage.error(res.message || '导出失败')
    }
  } catch {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// 清理日志
async function handleCleanup() {
  cleaning.value = true
  try {
    const res = await cleanupLogs(cleanupDays.value)
    if (res && res.success) {
      ElMessage.success(res.message || '清理成功')
      showCleanupDialog.value = false
      await fetchLogs()
    } else {
      ElMessage.error((res && res.message) || '清理失败')
    }
  } catch {
    ElMessage.error('清理失败')
  } finally {
    cleaning.value = false
  }
}

// 初始化
onMounted(() => {
  Promise.all([fetchLogs(), fetchStats()])
})
</script>
