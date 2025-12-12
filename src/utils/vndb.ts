import type { VndbSearchResult } from '../types'

const VNDB_API_BASE = 'https://api.vndb.org/kana'

export class VndbError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VndbError'
  }
}

/**
 * VNDB API 查询请求格式
 * filters 可以是：
 * - 简单过滤器：["field", "=", "value"]
 * - 复杂过滤器：["and", filter1, filter2, ...]
 * - 紧凑字符串格式
 */
interface VndbQuery {
  filters?: any[] | string
  fields?: string
  sort?: string
  reverse?: boolean
  results?: number
  page?: number
  count?: boolean
}

/**
 * VNDB API 响应格式
 */
interface VndbResponse {
  results: any[]
  more: boolean
  count?: number
}

/**
 * VNDB 搜索结果（包含分页信息）
 */
export interface VndbSearchResponse {
  results: VndbSearchResult[]
  more: boolean
}

/**
 * 搜索 VNDB 视觉小说
 */
export async function searchVndbVisualNovel(
  keyword: string,
  page = 1,
  results = 20
): Promise<VndbSearchResponse> {
  if (!keyword.trim()) {
    return { results: [], more: false }
  }

  try {
    const url = `${VNDB_API_BASE}/vn`
    
    const query: VndbQuery = {
      filters: ['search', '=', keyword],
      fields: 'id,title,alttitle,titles{lang,title,latin,main},released,image.url,image.thumbnail,rating',
      sort: 'searchrank',
      results: Math.min(results, 100), // VNDB API 最大支持 100 条
      page,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    })

    if (!response.ok) {
      if (response.status === 400) {
        let errorMessage = `请求格式错误: ${response.status}`
        try {
          const errorData = await response.json()
          // VNDB API 错误响应格式：{ "id": "error_id", "msg": "error message" }
          if (errorData.id) {
            errorMessage = `请求格式错误: ${errorData.id}${errorData.msg ? ` - ${errorData.msg}` : ''}`
          } else if (errorData.msg) {
            errorMessage = `请求格式错误: ${errorData.msg}`
          }
        } catch (e) {
          // 如果无法解析错误响应，使用默认消息
        }
        throw new VndbError(errorMessage)
      }
      if (response.status === 401) {
        throw new VndbError('API 认证失败')
      }
      throw new VndbError(`请求失败: ${response.status} ${response.statusText}`)
    }

    const result: VndbResponse = await response.json()
    
    // 转换 VNDB 结果格式为统一格式
    const searchResults = (result.results || []).map((vn: any) => {
      // 查找中文标题或主标题
      const mainTitle = vn.titles?.find((t: any) => t.main) || vn.titles?.[0]
      const chineseTitle = vn.titles?.find((t: any) => t.lang === 'zh' || t.lang === 'zh-Hans' || t.lang === 'zh-Hant')
      
      return {
        id: vn.id,
        name: vn.title || mainTitle?.latin || mainTitle?.title || '',
        name_cn: chineseTitle?.title || chineseTitle?.latin || vn.alttitle || null,
        date: vn.released || null,
        images: {
          small: vn.image?.thumbnail || vn.image?.url || '',
          grid: vn.image?.thumbnail || vn.image?.url || '',
          large: vn.image?.url || '',
          medium: vn.image?.thumbnail || vn.image?.url || '',
        },
        score: vn.rating ? vn.rating / 10 : undefined, // VNDB 评分是 10-100，转换为 1-10
      }
    }) as VndbSearchResult[]
    
    return {
      results: searchResults,
      more: result.more || false,
    }
  } catch (error: any) {
    if (error instanceof VndbError) {
      throw error
    }
    throw new VndbError(`网络错误: ${error.message}`)
  }
}

/**
 * 获取视觉小说详情
 */
export async function getVisualNovelDetail(id: string): Promise<any> {
  try {
    const url = `${VNDB_API_BASE}/vn`
    
    const query: VndbQuery = {
      filters: ['id', '=', id],
      fields: 'id,title,alttitle,titles{lang,title,latin,main},released,image.url,image.thumbnail,rating,description,length_minutes',
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    })

    if (!response.ok) {
      throw new VndbError(`获取详情失败: ${response.status}`)
    }

    const result: VndbResponse = await response.json()
    return result.results?.[0] || null
  } catch (error: any) {
    if (error instanceof VndbError) {
      throw error
    }
    throw new VndbError(`网络错误: ${error.message}`)
  }
}

