import type { Tier } from '../types'

const STORAGE_KEY = 'tier-list-data'
const TIER_CONFIG_KEY = 'tier-config'
const BGM_TOKEN_KEY = 'bgm-access-token'
const TITLE_KEY = 'tier-list-title'

/**
 * 默认评分等级配置
 */
export const DEFAULT_TIER_CONFIGS = [
  { id: 'S', label: 'S', color: '#000000', order: 0 },
  { id: 'A', label: 'A', color: '#333333', order: 1 },
  { id: 'B', label: 'B', color: '#666666', order: 2 },
  { id: 'C', label: 'C', color: '#999999', order: 3 },
  { id: 'D', label: 'D', color: '#CCCCCC', order: 4 },
]

/**
 * 保存 Tier 数据到本地存储
 */
export function saveTierData(tiers: Tier[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers))
  } catch (error) {
    console.error('保存数据失败:', error)
  }
}

/**
 * 从本地存储加载 Tier 数据
 */
export function loadTierData(): Tier[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
  
  // 返回默认数据
  return DEFAULT_TIER_CONFIGS.map(config => ({
    id: config.id,
    rows: [{
      id: `${config.id}-row-0`,
      items: [],
    }],
  }))
}

/**
 * 保存评分等级配置
 */
export function saveTierConfigs(configs: typeof DEFAULT_TIER_CONFIGS): void {
  try {
    localStorage.setItem(TIER_CONFIG_KEY, JSON.stringify(configs))
  } catch (error) {
    console.error('保存配置失败:', error)
  }
}

/**
 * 加载评分等级配置
 */
export function loadTierConfigs(): typeof DEFAULT_TIER_CONFIGS {
  try {
    const data = localStorage.getItem(TIER_CONFIG_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
  
  return DEFAULT_TIER_CONFIGS
}

/**
 * 保存用户自定义的 Bangumi Access Token
 */
export function saveBgmToken(token: string | null): void {
  try {
    if (token && token.trim()) {
      localStorage.setItem(BGM_TOKEN_KEY, token.trim())
    } else {
      localStorage.removeItem(BGM_TOKEN_KEY)
    }
  } catch (error) {
    console.error('保存 Token 失败:', error)
  }
}

/**
 * 加载用户自定义的 Bangumi Access Token
 * 返回 null 表示用户未设置自定义 Token
 */
export function loadBgmToken(): string | null {
  try {
    return localStorage.getItem(BGM_TOKEN_KEY)
  } catch (error) {
    console.error('加载 Token 失败:', error)
    return null
  }
}

/**
 * 保存标题
 */
export function saveTitle(title: string): void {
  try {
    if (title && title.trim()) {
      localStorage.setItem(TITLE_KEY, title.trim())
    } else {
      localStorage.removeItem(TITLE_KEY)
    }
  } catch (error) {
    console.error('保存标题失败:', error)
  }
}

/**
 * 加载标题
 * 返回默认标题 "极简 Tier List" 如果未设置
 */
export function loadTitle(): string {
  try {
    const title = localStorage.getItem(TITLE_KEY)
    return title || '极简 Tier List'
  } catch (error) {
    console.error('加载标题失败:', error)
    return '极简 Tier List'
  }
}

/**
 * 导出所有数据（包括 tiers、configs、title）
 */
export interface ExportData {
  tiers: Tier[]
  tierConfigs: typeof DEFAULT_TIER_CONFIGS
  title: string
  exportDate: string
  version: string
}

export function exportAllData(): ExportData {
  return {
    tiers: loadTierData(),
    tierConfigs: loadTierConfigs(),
    title: loadTitle(),
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  }
}

/**
 * 导入数据
 */
export function importAllData(data: ExportData): {
  success: boolean
  error?: string
} {
  try {
    if (!data.tiers || !data.tierConfigs) {
      return { success: false, error: '数据格式不正确' }
    }
    
    saveTierData(data.tiers)
    saveTierConfigs(data.tierConfigs)
    if (data.title) {
      saveTitle(data.title)
    }
    
    return { success: true }
  } catch (error) {
    console.error('导入数据失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

