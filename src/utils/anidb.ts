import type { AnidbSearchResult } from '../types'

const ANIDB_API_BASE = 'http://api.anidb.net:9001/httpapi'

// AniDB 客户端配置
// 注意：使用 AniDB API 需要注册客户端
// 请访问 https://anidb.net/software/add 注册您的客户端
// 这里使用一个示例客户端 ID，实际使用时需要替换为注册的客户端信息
const ANIDB_CLIENT = 'tier'
const ANIDB_CLIENTVER = 1
const ANIDB_PROTOVER = 1

// 本地缓存键
const ANIDB_CACHE_KEY = 'anidb-api-cache'
const ANIDB_CACHE_TIMESTAMP_KEY = 'anidb-api-cache-timestamp'

// 请求频率限制：每 10 秒最多一次请求
const REQUEST_INTERVAL = 10000 // 10 秒
let lastRequestTime = 0
let requestQueue: Array<() => void> = []

export class AnidbError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnidbError'
  }
}

/**
 * AniDB API 响应格式（XML）
 */
interface AnidbAnimeData {
  id: string
  restricted: string
  type?: string
  episodecount?: string
  startdate?: string
  enddate?: string
  titles?: {
    title?: Array<{
      _lang?: string
      _type?: string
      __text?: string
    }>
  }
  picture?: string
  ratings?: {
    permanent?: {
      _count?: string
      __text?: string
    }
    temporary?: {
      _count?: string
      __text?: string
    }
  }
}

/**
 * 解析 XML 响应
 */
function parseXML(xmlText: string): any {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  
  // 检查解析错误
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new AnidbError('XML 解析失败')
  }
  
  return xmlDoc
}

/**
 * 从 XML 中提取动画数据
 */
function extractAnimeData(xmlDoc: Document): AnidbAnimeData | null {
  const animeElement = xmlDoc.querySelector('anime')
  if (!animeElement) {
    // 检查是否有错误信息
    const errorElement = xmlDoc.querySelector('error')
    if (errorElement) {
      const errorText = errorElement.textContent || 'AniDB API 返回错误'
      // 特殊处理 "banned" 错误
      if (errorText.toLowerCase().includes('banned')) {
        throw new AnidbError(
          `AniDB API 封禁错误: ${errorText}\n` +
          '可能的原因：\n' +
          '1. 请求频率过高，IP 或客户端被临时封禁\n' +
          '2. 客户端 ID 未正确注册或已被封禁\n' +
          '3. 违反了 AniDB API 使用协议\n\n' +
          '建议：\n' +
          '1. 等待一段时间后重试（通常封禁是临时的）\n' +
          '2. 检查客户端 ID 是否正确注册\n' +
          '3. 确保遵守 API 频率限制（每 10 秒最多一次请求）\n' +
          '4. 使用本地缓存的数据（如果可用）'
        )
      }
      throw new AnidbError(errorText)
    }
    return null
  }
  
  const id = animeElement.getAttribute('id') || ''
  const restricted = animeElement.getAttribute('restricted') || 'false'
  
  const type = animeElement.querySelector('type')?.textContent || undefined
  const episodecount = animeElement.querySelector('episodecount')?.textContent || undefined
  const startdate = animeElement.querySelector('startdate')?.textContent || undefined
  const enddate = animeElement.querySelector('enddate')?.textContent || undefined
  
  // 提取图片文件名（picture 字段）
  // 注意：picture 字段格式通常是 "295082.jpg"
  // XML 格式：<picture>295082.jpg</picture>
  // 注意：picture 元素可能包含其他子元素（如 <SCRIPT>），需要正确提取文本内容
  const pictureElement = animeElement.querySelector('picture')
  let picture: string | undefined = undefined
  
  if (pictureElement) {
    // 方法1：直接获取 textContent（会自动忽略子元素，只获取文本）
    let pictureText = pictureElement.textContent
    
    // 如果 textContent 为空或只包含空白，尝试其他方法
    if (!pictureText || !pictureText.trim()) {
      // 方法2：获取 innerHTML 并清理（移除可能的子元素标签）
      const innerHTML = pictureElement.innerHTML || ''
      // 移除所有 HTML 标签，只保留文本内容
      pictureText = innerHTML.replace(/<[^>]*>/g, '').trim()
    }
    
    // 清理提取的文本（去除首尾空白和换行符）
    if (pictureText) {
      picture = pictureText.trim().replace(/[\r\n]+/g, ' ').trim()
    }
    
    // 调试：输出提取过程
    if (id) {
      console.debug(`AniDB AID ${id}: picture 元素提取过程`, {
        hasElement: !!pictureElement,
        textContent: pictureElement.textContent,
        innerHTML: pictureElement.innerHTML,
        extracted: picture,
      })
    }
  }
  
  // 调试：记录 picture 字段信息
  if (id) {
    console.debug(`AniDB AID ${id}: picture 元素存在 =`, !!pictureElement)
    console.debug(`AniDB AID ${id}: picture 字段值 =`, picture || '(空)')
    if (pictureElement) {
      console.debug(`AniDB AID ${id}: picture 元素 HTML =`, pictureElement.outerHTML)
      console.debug(`AniDB AID ${id}: picture textContent =`, pictureElement.textContent)
      console.debug(`AniDB AID ${id}: picture innerHTML =`, pictureElement.innerHTML)
      console.debug(`AniDB AID ${id}: picture 提取结果 =`, picture)
    }
  }
  
  // 提取标题
  const titleElements = animeElement.querySelectorAll('titles title')
  const titles: any[] = []
  titleElements.forEach((el) => {
    const lang = el.getAttribute('xml:lang') || el.getAttribute('lang') || ''
    const type = el.getAttribute('type') || ''
    const text = el.textContent || ''
    if (text) {
      titles.push({
        _lang: lang,
        _type: type,
        __text: text,
      })
    }
  })
  
  // 提取评分
  const permanentEl = animeElement.querySelector('ratings permanent')
  const temporaryEl = animeElement.querySelector('ratings temporary')
  
  const ratings: any = {}
  if (permanentEl) {
    ratings.permanent = {
      _count: permanentEl.getAttribute('count') || '',
      __text: permanentEl.textContent || '',
    }
  }
  if (temporaryEl) {
    ratings.temporary = {
      _count: temporaryEl.getAttribute('count') || '',
      __text: temporaryEl.textContent || '',
    }
  }
  
  return {
    id,
    restricted,
    type,
    episodecount,
    startdate,
    enddate,
    titles: titles.length > 0 ? { title: titles } : undefined,
    picture,
    ratings: Object.keys(ratings).length > 0 ? ratings : undefined,
  }
}

/**
 * 从本地存储加载缓存
 */
function loadCache(): Map<number, AnidbAnimeData> {
  try {
    const cacheData = localStorage.getItem(ANIDB_CACHE_KEY)
    if (cacheData) {
      const parsed = JSON.parse(cacheData)
      const cache = new Map<number, AnidbAnimeData>()
      for (const [aid, data] of Object.entries(parsed)) {
        cache.set(Number(aid), data as AnidbAnimeData)
      }
      return cache
    }
  } catch (error) {
    console.warn('加载 AniDB 缓存失败:', error)
  }
  return new Map()
}

/**
 * 保存数据到本地缓存
 */
function saveToCache(aid: number, data: AnidbAnimeData): void {
  try {
    const cache = loadCache()
    cache.set(aid, data)
    
    // 调试：验证保存的数据
    console.debug(`AniDB AID ${aid}: 保存到缓存，picture 字段 =`, data.picture)
    
    // 转换为普通对象以便存储
    const cacheObj: Record<string, AnidbAnimeData> = {}
    cache.forEach((value, key) => {
      cacheObj[String(key)] = value
    })
    
    localStorage.setItem(ANIDB_CACHE_KEY, JSON.stringify(cacheObj))
    localStorage.setItem(ANIDB_CACHE_TIMESTAMP_KEY, String(Date.now()))
    
    // 验证保存后的数据
    const savedData = localStorage.getItem(ANIDB_CACHE_KEY)
    if (savedData) {
      const parsed = JSON.parse(savedData)
      const savedItem = parsed[String(aid)]
      if (savedItem) {
        console.debug(`AniDB AID ${aid}: 缓存验证，保存的 picture =`, savedItem.picture)
      }
    }
  } catch (error) {
    console.warn('保存 AniDB 缓存失败:', error)
  }
}

/**
 * 等待请求间隔（确保每 10 秒最多一次请求）
 */
function waitForRequestInterval(): Promise<void> {
  return new Promise((resolve) => {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    
    if (timeSinceLastRequest >= REQUEST_INTERVAL) {
      // 可以直接请求
      lastRequestTime = now
      resolve()
    } else {
      // 需要等待
      const waitTime = REQUEST_INTERVAL - timeSinceLastRequest
      setTimeout(() => {
        lastRequestTime = Date.now()
        resolve()
      }, waitTime)
    }
  })
}

/**
 * 通过 AID 获取动画信息（带缓存和频率限制）
 * 注意：即使有缓存，也会等待一个最小间隔，确保严格按顺序处理
 */
export async function getAnimeByAid(aid: number): Promise<AnidbAnimeData | null> {
  // 1. 先检查本地缓存
  const cache = loadCache()
  const cachedData = cache.get(aid)
  if (cachedData) {
    console.log(`📦 [缓存] AniDB AID ${aid}: 从本地缓存获取数据`, {
      id: cachedData.id,
      picture: cachedData.picture,
      hasPicture: !!cachedData.picture,
    })
    // 即使有缓存，也等待一个最小间隔（100ms），确保严格按顺序处理
    // 这样可以避免同时处理多个缓存结果，保持顺序性
    await new Promise(resolve => setTimeout(resolve, 100))
    return cachedData
  }
  
  // 2. 等待请求间隔（频率限制：10秒）
  console.log(`🌐 [API] AniDB AID ${aid}: 等待请求间隔后从 HTTP API 获取数据...`)
  await waitForRequestInterval()
  
  // 3. 从 API 获取数据
  try {
    const url = new URL(ANIDB_API_BASE)
    url.searchParams.set('request', 'anime')
    url.searchParams.set('client', ANIDB_CLIENT)
    url.searchParams.set('clientver', String(ANIDB_CLIENTVER))
    url.searchParams.set('protover', String(ANIDB_PROTOVER))
    url.searchParams.set('aid', String(aid))
    
    console.log(`🌐 [API] AniDB AID ${aid}: 正在请求 HTTP API...`, url.toString())
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/xml, text/xml, */*',
      },
      mode: 'cors', // 尝试 CORS，但可能仍会遇到问题
    })
    
    if (!response.ok) {
      if (response.status === 0 || response.type === 'opaque') {
        throw new AnidbError(
          'CORS 错误：AniDB API 使用 HTTP 协议，浏览器可能阻止了请求。\n' +
          '建议：1) 使用其他 API 源（Bangumi/VNDB）进行搜索；\n' +
          '      2) 配置 CORS 代理服务器；\n' +
          '      3) 使用 AniDB UDP API（需要服务器端支持）。'
        )
      }
      throw new AnidbError(`请求失败: ${response.status} ${response.statusText}`)
    }
    
    const xmlText = await response.text()
    
    // 调试：检查 picture 字段在 XML 中的位置
    const pictureMatch = xmlText.match(/<picture[^>]*>(.*?)<\/picture>/i)
    if (pictureMatch) {
      console.debug(`AniDB AID ${aid}: XML 中的 picture 字段 =`, pictureMatch[1])
    } else {
      console.debug(`AniDB AID ${aid}: XML 中未找到 picture 字段`)
      // 输出包含 picture 的 XML 片段以便调试
      const pictureIndex = xmlText.indexOf('<picture')
      if (pictureIndex >= 0) {
        const snippet = xmlText.substring(Math.max(0, pictureIndex - 100), pictureIndex + 200)
        console.debug(`AniDB AID ${aid}: picture 附近的 XML 片段:`, snippet)
      }
    }
    
    // 检查响应是否包含错误
    if (xmlText.includes('<error>')) {
      const errorMatch = xmlText.match(/<error[^>]*>(.*?)<\/error>/)
      if (errorMatch) {
        throw new AnidbError(`AniDB API 错误: ${errorMatch[1]}`)
      }
    }
    
    const xmlDoc = parseXML(xmlText)
    const animeData = extractAnimeData(xmlDoc)
    
    // 调试：输出提取的数据
    if (animeData) {
      console.log(`✅ [API] AniDB AID ${aid}: 成功从 HTTP API 获取数据`, {
        id: animeData.id,
        picture: animeData.picture,
        pictureType: typeof animeData.picture,
        pictureLength: animeData.picture?.length || 0,
        titles: animeData.titles?.title?.length || 0,
      })
      
      // 验证 picture 字段是否存在
      if (!animeData.picture) {
        console.warn(`⚠️ [API] AniDB AID ${aid}: 警告 - picture 字段为空，可能无法显示封面图`)
      }
      
      // 4. 保存到缓存
      saveToCache(aid, animeData)
      console.log(`💾 [API] AniDB AID ${aid}: 已保存到本地缓存`, {
        picture: animeData.picture,
      })
    } else {
      console.warn(`❌ [API] AniDB AID ${aid}: 未能提取数据`)
    }
    
    return animeData
  } catch (error: any) {
    if (error instanceof AnidbError) {
      throw error
    }
    // 检查是否是 CORS 错误
    if (error.message && (error.message.includes('CORS') || error.message.includes('fetch'))) {
      throw new AnidbError(
        '无法连接到 AniDB API。这可能是因为：\n' +
        '1. AniDB API 使用 HTTP 协议，浏览器安全策略可能阻止了请求\n' +
        '2. 需要配置 CORS 代理或使用服务器端 API\n' +
        '建议使用 Bangumi 或 VNDB API 进行搜索。'
      )
    }
    throw new AnidbError(`网络错误: ${error.message}`)
  }
}

/**
 * AniDB 搜索结果（包含分页信息）
 */
export interface AnidbSearchResponse {
  results: AnidbSearchResult[]
  more: boolean
}

/**
 * 搜索 AniDB 动画
 * 
 * 使用本地 anime-titles.dat 文件进行标题搜索，
 * 然后通过 AID 查询 AniDB API 获取详细信息
 */
export async function searchAnidbAnime(
  keyword: string,
  page = 1,
  results = 20
): Promise<AnidbSearchResponse> {
  if (!keyword.trim()) {
    return { results: [], more: false }
  }
  
  try {
    // 动态导入标题搜索工具（避免循环依赖）
    const { searchAnimeTitles, getMainTitle, getChineseTitle } = await import('./anidb-titles')
    
    // 检查是否是直接输入的 AID（纯数字）
    const keywordTrimmed = keyword.trim()
    const directAid = /^\d+$/.test(keywordTrimmed) ? parseInt(keywordTrimmed) : null
    
    let matchedAids: number[] = []
    
    if (directAid) {
      // 直接通过 AID 查询
      matchedAids = [directAid]
    } else {
      // 通过本地标题索引搜索匹配的 AID
      matchedAids = await searchAnimeTitles(keyword, results * page)
    }
    
    if (matchedAids.length === 0) {
      return { results: [], more: false }
    }
    
    // 计算分页
    const startIndex = (page - 1) * results
    const endIndex = startIndex + results
    const pageAids = matchedAids.slice(startIndex, endIndex)
    const hasMore = matchedAids.length > endIndex
    
    // 顺序查询每个 AID 的详细信息，确保每 10 秒最多一次请求
    // 严格按照顺序一个一个获取，每个结果获取后立即保存到缓存
    const searchResults: AnidbSearchResult[] = []
    
    console.log(`AniDB 搜索: 开始顺序获取 ${pageAids.length} 个结果，每个请求间隔 10 秒`)
    
    // 顺序执行每个请求，确保频率限制
    for (let i = 0; i < pageAids.length; i++) {
      const aid = pageAids[i]
      const progress = `[${i + 1}/${pageAids.length}]`
      
      try {
        console.log(`${progress} AniDB 正在获取 AID ${aid} 的详细信息...`)
        
        // 获取数据（严格按照顺序，有缓存时等待100ms，无缓存时等待10秒）
        const animeData = await getAnimeByAid(aid)
        
        if (animeData) {
          // 从本地标题索引获取更好的标题信息
          const mainTitle = await getMainTitle(aid) || animeData.titles?.title?.find((t: any) => t._type === 'main')?.__text || ''
          const chineseTitle = await getChineseTitle(aid) || animeData.titles?.title?.find((t: any) => 
            t._lang === 'zh' || t._lang === 'zh-Hans' || t._lang === 'zh-Hant'
          )?.__text || null
          
          const result = convertAnidbToSearchResult(animeData)
          // 使用本地索引的标题信息（更准确）
          result.name = mainTitle || result.name
          result.name_cn = chineseTitle || result.name_cn
          
          // 调试：检查转换后的结果
          console.debug(`${progress} AniDB AID ${aid}: 转换后的搜索结果`, {
            id: result.id,
            name: result.name,
            images: result.images,
            hasPictureUrl: !!(result.images.medium || result.images.grid || result.images.small || result.images.large),
          })
          
          // 立即添加到结果列表（逐步返回）
          searchResults.push(result)
          console.log(`${progress} AniDB AID ${aid} 获取完成: ${result.name}`)
          
          // 注意：数据已经在 getAnimeByAid 中保存到缓存了
        } else {
          console.warn(`${progress} AniDB AID ${aid}: 未能获取数据`)
        }
      } catch (error) {
        // 如果 API 查询失败，仍然尝试使用本地标题信息创建结果
        console.warn(`${progress} 无法获取 AID ${aid} 的详细信息:`, error)
        try {
          const { getAnimeTitles } = await import('./anidb-titles')
          const titles = await getAnimeTitles(aid)
          if (titles.length > 0) {
            const mainTitle = titles.find(t => t.type === 1)?.title || titles[0].title
            const chineseTitle = titles.find(t => 
              t.lang === 'zh' || t.lang === 'zh-Hans' || t.lang === 'zh-Hant'
            )?.title || null
            
            searchResults.push({
              id: `anidb_${aid}`,
              aid,
              name: mainTitle,
              name_cn: chineseTitle,
              date: null,
              images: {
                small: '',
                grid: '',
                large: '',
                medium: '',
              },
              score: undefined,
            } as AnidbSearchResult)
            console.log(`${progress} AniDB AID ${aid} 使用本地标题信息: ${mainTitle}`)
          }
        } catch (e) {
          // 忽略错误
        }
      }
      
      // 注意：getAnimeByAid 内部已经处理了请求间隔
      // - 如果有缓存：等待 100ms（保持顺序）
      // - 如果没有缓存：等待 10 秒（API 频率限制）
    }
    
    console.log(`AniDB 搜索完成: 共获取 ${searchResults.length} 个结果`)
    
    return {
      results: searchResults,
      more: hasMore,
    }
  } catch (error: any) {
    if (error instanceof AnidbError) {
      throw error
    }
    // 如果本地搜索失败，返回错误信息
    throw new AnidbError(
      `搜索失败: ${error.message}\n` +
      '请确保 anime-titles.dat 文件已正确放置在 public 目录中。'
    )
  }
}

/**
 * 将 AniDB 数据转换为统一格式
 */
export function convertAnidbToSearchResult(anime: AnidbAnimeData): AnidbSearchResult {
  // 查找主标题和中文标题
  const titles = anime.titles?.title || []
  const mainTitle = titles.find((t: any) => t._type === 'main') || titles[0]
  const chineseTitle = titles.find((t: any) => 
    t._lang === 'zh' || t._lang === 'zh-Hans' || t._lang === 'zh-Hant'
  )
  
  // 获取评分（优先使用 permanent，如果没有则使用 temporary）
  const rating = anime.ratings?.permanent?.__text 
    ? parseFloat(anime.ratings.permanent.__text) / 100 
    : anime.ratings?.temporary?.__text 
    ? parseFloat(anime.ratings.temporary.__text) / 100 
    : undefined
  
  // 构建图片 URL
  // AniDB 图片 URL 格式：https://cdn-eu.anidb.net/images/main/{image_id}.jpg
  // picture 字段格式通常是 "295082.jpg"，需要提取数字部分（295082）
  // 注意：只有在 API 返回 picture 字段时才构建 URL，否则返回空字符串
  let pictureUrl = ''
  const aid = anime.id
  
  if (anime.picture && anime.picture.trim()) {
    const pictureValue = anime.picture.trim()
    console.debug(`AniDB AID ${aid}: 处理 picture 字段 =`, pictureValue)
    
    // 如果 picture 字段包含完整 URL，直接使用
    if (pictureValue.startsWith('http://') || pictureValue.startsWith('https://')) {
      pictureUrl = pictureValue
      console.debug(`AniDB AID ${aid}: 使用完整 URL =`, pictureUrl)
    } else {
      // 提取图片 ID（去除扩展名和路径）
      // picture 字段格式通常是 "295082.jpg"
      let imageId = pictureValue
      
      // 如果包含路径分隔符，提取文件名
      if (imageId.includes('/')) {
        imageId = imageId.split('/').pop() || imageId
      }
      
      // 去除扩展名（.jpg, .png 等），只保留数字部分
      // 例如："295082.jpg" -> "295082"
      const imageIdWithoutExt = imageId.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
      
      console.debug(`AniDB AID ${aid}: 提取的图片 ID =`, imageIdWithoutExt, `(原始值: ${imageId})`)
      
      // 验证 imageId 是否为有效数字
      if (/^\d+$/.test(imageIdWithoutExt)) {
        // 构建完整的图片 URL
        // 使用 cdn-eu.anidb.net（欧洲 CDN）
        // 格式：https://cdn-eu.anidb.net/images/main/295082.jpg
        pictureUrl = `https://cdn-eu.anidb.net/images/main/${imageIdWithoutExt}.jpg`
        console.debug(`AniDB AID ${aid}: ✅ 构建的图片 URL =`, pictureUrl)
      } else {
        // 如果 imageId 不是纯数字，尝试直接使用（可能包含其他格式）
        pictureUrl = `https://cdn-eu.anidb.net/images/main/${pictureValue}`
        console.warn(`AniDB AID ${aid}: ⚠️ 图片 ID 不是纯数字，使用原始值构建 URL =`, pictureUrl)
      }
    }
  } else {
    // 如果 picture 字段为空，不构建图片 URL，返回空字符串
    // 前端会显示占位图
    console.debug(`AniDB AID ${aid}: picture 字段为空，不构建图片 URL`)
  }
  
  // 最终调试：输出构建的图片 URL
  console.debug(`AniDB AID ${aid}: 最终构建的图片 URL =`, pictureUrl || '(空 - 将显示占位图)')
  
  const result = {
    id: `anidb_${anime.id}`,
    aid: parseInt(anime.id),
    name: mainTitle?.__text || '',
    name_cn: chineseTitle?.__text || null,
    date: anime.startdate || null,
    images: {
      small: pictureUrl,
      grid: pictureUrl,
      large: pictureUrl,
      medium: pictureUrl,
    },
    score: rating,
    type: anime.type,
    episodecount: anime.episodecount ? parseInt(anime.episodecount) : undefined,
  }
  
  // 调试：输出最终结果中的图片 URL
  console.debug(`AniDB AID ${aid}: 结果中的图片 URLs:`, {
    small: result.images.small,
    grid: result.images.grid,
    large: result.images.large,
    medium: result.images.medium,
  })
  
  return result
}

