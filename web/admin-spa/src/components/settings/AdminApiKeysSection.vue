<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100">管理密钥</h4>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          用于程序化调用管理接口的 API Key，支持所有 /admin/* 端点
        </p>
      </div>
      <button
        class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        @click="showCreateModal = true"
      >
        <i class="fas fa-plus mr-2"></i>
        创建密钥
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center">
      <div class="loading-spinner mx-auto mb-4"></div>
      <p class="text-gray-500 dark:text-gray-400">正在加载...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="keys.length === 0"
      class="rounded-xl border-2 border-dashed border-gray-300 py-12 text-center dark:border-gray-600"
    >
      <i class="fas fa-key mb-4 text-4xl text-gray-400 dark:text-gray-500"></i>
      <p class="text-gray-500 dark:text-gray-400">暂无管理密钥</p>
      <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">
        创建一个 Admin API Key 来程序化管理服务
      </p>
    </div>

    <!-- Keys Table -->
    <div v-else class="table-container">
      <!-- Desktop -->
      <table class="hidden min-w-full sm:table">
        <thead>
          <tr
            class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            <th class="px-4 py-3">名称</th>
            <th class="px-4 py-3">描述</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">创建时间</th>
            <th class="px-4 py-3">最后使用</th>
            <th class="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200/50 dark:divide-gray-600/50">
          <tr v-for="key in keys" :key="key.id" class="table-row">
            <td class="whitespace-nowrap px-4 py-3">
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ key.name }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ key.description || '-' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <button
                :class="[
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                  key.isActive
                    ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                ]"
                :title="key.isActive ? '点击禁用' : '点击启用'"
                @click="toggleKey(key)"
              >
                <i :class="['fas mr-1', key.isActive ? 'fa-check-circle' : 'fa-times-circle']"></i>
                {{ key.isActive ? '启用' : '禁用' }}
              </button>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ formatTime(key.createdAt) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ key.lastUsedAt ? formatTime(key.lastUsedAt) : '从未使用' }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <button
                class="text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="删除"
                @click="confirmDelete(key)"
              >
                <i class="fas fa-trash-alt"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile -->
      <div class="space-y-3 sm:hidden">
        <div
          v-for="key in keys"
          :key="key.id"
          class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium text-gray-900 dark:text-gray-100">{{ key.name }}</span>
            <button
              :class="[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                key.isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              ]"
              @click="toggleKey(key)"
            >
              {{ key.isActive ? '启用' : '禁用' }}
            </button>
          </div>
          <p v-if="key.description" class="mb-2 text-sm text-gray-500 dark:text-gray-400">
            {{ key.description }}
          </p>
          <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{{ formatTime(key.createdAt) }}</span>
            <button class="text-red-500" @click="confirmDelete(key)">
              <i class="fas fa-trash-alt"></i> 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showCreateModal = false"
    >
      <div
        class="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
      >
        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">创建管理密钥</h3>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              名称 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="createForm.name"
              class="form-input w-full dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              maxlength="100"
              placeholder="例如：CI/CD Pipeline"
              type="text"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              描述
            </label>
            <textarea
              v-model="createForm.description"
              class="form-input w-full dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              maxlength="500"
              placeholder="用途说明（可选）"
              rows="2"
            ></textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end space-x-3">
          <button
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showCreateModal = false"
          >
            取消
          </button>
          <button
            :disabled="!createForm.name.trim() || creating"
            class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="createKey"
          >
            <i v-if="creating" class="fas fa-spinner fa-spin mr-2"></i>
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- Show Key Modal (one-time display) -->
    <div
      v-if="showKeyModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        class="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
      >
        <div class="mb-4 flex items-center">
          <div
            class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
          >
            <i class="fas fa-check text-green-600 dark:text-green-400"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">密钥创建成功</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">请立即复制，此密钥仅显示一次</p>
          </div>
        </div>

        <div
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <div class="flex items-start">
            <i
              class="fas fa-exclamation-triangle mr-2 mt-0.5 text-amber-500 dark:text-amber-400"
            ></i>
            <p class="text-sm text-amber-700 dark:text-amber-300">
              关闭此对话框后将无法再次查看完整密钥，请确保已安全保存。
            </p>
          </div>
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Admin API Key
          </label>
          <div class="flex items-center space-x-2">
            <code
              class="flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              {{ newKeyValue }}
            </code>
            <button
              class="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
              @click="copyKey"
            >
              <i :class="['fas', copied ? 'fa-check' : 'fa-copy']"></i>
            </button>
          </div>
        </div>

        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
          使用方式：在请求头中添加
          <code class="rounded bg-gray-100 px-1 dark:bg-gray-700"
            >Authorization: Bearer {{ newKeyValue.substring(0, 8) }}...</code
          >
        </p>

        <div class="flex justify-end">
          <button
            class="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            @click="closeKeyModal"
          >
            我已安全保存
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showDeleteModal = false"
    >
      <div
        class="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
      >
        <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">确认删除</h3>
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
          确定要删除密钥 <strong>{{ deleteTarget?.name }}</strong> 吗？此操作不可恢复。
        </p>
        <div class="flex justify-end space-x-3">
          <button
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showDeleteModal = false"
          >
            取消
          </button>
          <button
            :disabled="deleting"
            class="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            @click="deleteKey"
          >
            <i v-if="deleting" class="fas fa-spinner fa-spin mr-2"></i>
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast, copyText } from '@/utils/tools'
import {
  getAdminApiKeysApi,
  createAdminApiKeyApi,
  updateAdminApiKeyApi,
  deleteAdminApiKeyApi
} from '@/utils/http_apis'

const loading = ref(false)
const creating = ref(false)
const deleting = ref(false)
const keys = ref([])

const showCreateModal = ref(false)
const showKeyModal = ref(false)
const showDeleteModal = ref(false)

const createForm = ref({ name: '', description: '' })
const newKeyValue = ref('')
const copied = ref(false)
const deleteTarget = ref(null)

const formatTime = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { hour12: false })
}

const loadKeys = async () => {
  loading.value = true
  const res = await getAdminApiKeysApi()
  if (res.success) {
    keys.value = res.data
  } else {
    showToast(res.message || '加载失败', 'error')
  }
  loading.value = false
}

const createKey = async () => {
  creating.value = true
  const res = await createAdminApiKeyApi({
    name: createForm.value.name.trim(),
    description: createForm.value.description.trim()
  })
  creating.value = false

  if (res.success) {
    showCreateModal.value = false
    newKeyValue.value = res.data.apiKey
    showKeyModal.value = true
    createForm.value = { name: '', description: '' }
    await loadKeys()
  } else {
    showToast(res.message || '创建失败', 'error')
  }
}

const copyKey = async () => {
  await copyText(newKeyValue.value, '密钥已复制到剪贴板')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

const closeKeyModal = () => {
  showKeyModal.value = false
  newKeyValue.value = ''
  copied.value = false
}

const toggleKey = async (key) => {
  const res = await updateAdminApiKeyApi(key.id, { isActive: !key.isActive })
  if (res.success) {
    key.isActive = res.data.isActive
    showToast(key.isActive ? '已启用' : '已禁用', 'success')
  } else {
    showToast(res.message || '操作失败', 'error')
  }
}

const confirmDelete = (key) => {
  deleteTarget.value = key
  showDeleteModal.value = true
}

const deleteKey = async () => {
  deleting.value = true
  const res = await deleteAdminApiKeyApi(deleteTarget.value.id)
  deleting.value = false

  if (res.success) {
    showDeleteModal.value = false
    deleteTarget.value = null
    showToast('已删除', 'success')
    await loadKeys()
  } else {
    showToast(res.message || '删除失败', 'error')
  }
}

onMounted(() => {
  loadKeys()
})
</script>
