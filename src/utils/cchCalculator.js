const logger = require('./logger')

const CCH_SEED = 0x6e52736ac806831en // BigInt for xxhash-wasm

let xxhash = null
let initPromise = null

/**
 * 初始化 xxhash-wasm（只初始化一次）
 */
const ensureInitialized = async () => {
  if (xxhash) {
    return xxhash
  }
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      const xxhashWasm = require('xxhash-wasm')
      xxhash = await xxhashWasm()
      logger.info('✅ xxhash-wasm initialized for cch calculation')
      return xxhash
    } catch (err) {
      logger.error('❌ Failed to initialize xxhash-wasm:', err.message)
      initPromise = null
      return null
    }
  })()

  return initPromise
}

/**
 * 计算 cch 值
 * @param {string} bodyStr - 包含 cch=00000 的紧凑 JSON 字符串
 * @returns {string|null} 5位 hex 字符串，或 null 表示计算失败
 */
const computeCch = async (bodyStr) => {
  const hasher = await ensureInitialized()
  if (!hasher) {
    return null
  }

  try {
    const bytes = Buffer.from(bodyStr, 'utf-8')
    const hash = hasher.h64Raw(bytes, CCH_SEED)
    const cch = (hash & 0xfffffn).toString(16).padStart(5, '0')
    return cch
  } catch (err) {
    logger.error('❌ cch computation failed:', err.message)
    return null
  }
}

/**
 * 对请求 body 对象计算并注入 cch
 * 1. 找到 system 中的 billing header，确保 cch=00000
 * 2. 紧凑序列化 body
 * 3. 计算 xxh64 hash
 * 4. 替换 cch=00000 为计算值
 * @param {object} body - 请求 body 对象
 * @returns {string|null} 注入 cch 后的 JSON 字符串，或 null（无需/无法计算）
 */
const injectCch = async (body) => {
  if (!body || !body.system) {
    return null
  }

  // 查找 billing header 元素
  let hasBillingHeader = false

  if (typeof body.system === 'string') {
    if (body.system.trim().startsWith('x-anthropic-billing-header')) {
      hasBillingHeader = true
    }
  } else if (Array.isArray(body.system)) {
    hasBillingHeader = body.system.some(
      (item) =>
        item &&
        item.type === 'text' &&
        typeof item.text === 'string' &&
        item.text.trim().startsWith('x-anthropic-billing-header')
    )
  }

  if (!hasBillingHeader) {
    return null
  }

  // 确保 billing header 中的 cch 为 00000（重置已有值）
  const resetCchInSystem = (system) => {
    if (typeof system === 'string') {
      return system.replace(/cch=[0-9a-fA-F]{5}/, 'cch=00000')
    }
    if (Array.isArray(system)) {
      return system.map((item) => {
        if (
          item &&
          item.type === 'text' &&
          typeof item.text === 'string' &&
          item.text.trim().startsWith('x-anthropic-billing-header')
        ) {
          return { ...item, text: item.text.replace(/cch=[0-9a-fA-F]{5}/, 'cch=00000') }
        }
        return item
      })
    }
    return system
  }

  const bodyWithPlaceholder = { ...body, system: resetCchInSystem(body.system) }
  const bodyStr = JSON.stringify(bodyWithPlaceholder)

  const cch = await computeCch(bodyStr)
  if (!cch) {
    return null
  }

  const result = bodyStr.replace('cch=00000', `cch=${cch}`)
  logger.debug(`🔑 Computed cch=${cch}`)
  return result
}

module.exports = {
  ensureInitialized,
  computeCch,
  injectCch
}
