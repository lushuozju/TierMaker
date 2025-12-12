/**
 * AniDB Anime Titles 数据解析和搜索工具
 * 基于 anime-titles.dat 文件实现本地搜索功能
 */

export interface AnimeTitleEntry {
  aid: number
  type: number // 1=primary, 2=synonyms, 3=shorttitles, 4=official
  lang: string
  title: string
}

export interface AnimeTitleIndex {
  // 按 AID 索引，每个 AID 对应多个标题
  byAid: Map<number, AnimeTitleEntry[]>
  // 按标题文本索引，用于快速搜索
  byTitle: Map<string, Set<number>>
}

let titleIndex: AnimeTitleIndex | null = null
let isLoading = false
let loadPromise: Promise<AnimeTitleIndex> | null = null

/**
 * 解析 anime-titles.dat 文件内容
 */
function parseAnimeTitles(content: string): AnimeTitleIndex {
  const byAid = new Map<number, AnimeTitleEntry[]>()
  const byTitle = new Map<string, Set<number>>()
  
  const lines = content.split('\n')
  
  for (const line of lines) {
    // 跳过注释和空行
    if (!line.trim() || line.startsWith('#')) {
      continue
    }
    
    // 格式：AID|TYPE|LANG|TITLE
    const parts = line.split('|')
    if (parts.length < 4) {
      continue
    }
    
    const aid = parseInt(parts[0])
    const type = parseInt(parts[1])
    const lang = parts[2]
    const title = parts.slice(3).join('|') // 处理标题中可能包含 | 的情况
    
    if (isNaN(aid) || !title) {
      continue
    }
    
    const entry: AnimeTitleEntry = { aid, type, lang, title }
    
    // 添加到 byAid 索引
    if (!byAid.has(aid)) {
      byAid.set(aid, [])
    }
    byAid.get(aid)!.push(entry)
    
    // 添加到 byTitle 索引（不区分大小写）
    const titleLower = title.toLowerCase()
    if (!byTitle.has(titleLower)) {
      byTitle.set(titleLower, new Set())
    }
    byTitle.get(titleLower)!.add(aid)
  }
  
  return { byAid, byTitle }
}

/**
 * 加载 anime-titles.dat 文件
 */
async function loadAnimeTitles(): Promise<AnimeTitleIndex> {
  if (titleIndex) {
    return titleIndex
  }
  
  if (isLoading && loadPromise) {
    return loadPromise
  }
  
  isLoading = true
  loadPromise = (async () => {
    try {
      // 从 public 目录加载文件
      const response = await fetch('/anime-titles.dat')
      if (!response.ok) {
        throw new Error(`无法加载 anime-titles.dat: ${response.status}`)
      }
      
      const content = await response.text()
      titleIndex = parseAnimeTitles(content)
      isLoading = false
      return titleIndex
    } catch (error) {
      isLoading = false
      loadPromise = null
      throw error
    }
  })()
  
  return loadPromise
}

/**
 * 初始化标题索引（在应用启动时调用）
 */
export async function initAnimeTitles(): Promise<void> {
  try {
    await loadAnimeTitles()
  } catch (error) {
    console.warn('无法加载 anime-titles.dat，AniDB 搜索功能将不可用:', error)
  }
}

/**
 * 搜索动画标题
 * @param keyword 搜索关键词
 * @param limit 返回结果数量限制
 * @returns 匹配的 AID 列表
 */
export async function searchAnimeTitles(
  keyword: string,
  limit = 50
): Promise<number[]> {
  if (!keyword.trim()) {
    return []
  }
  
  try {
    const index = await loadAnimeTitles()
    const keywordLower = keyword.toLowerCase().trim()
    const matchedAids = new Set<number>()
    
    // 精确匹配
    if (index.byTitle.has(keywordLower)) {
      index.byTitle.get(keywordLower)!.forEach(aid => matchedAids.add(aid))
    }
    
    // 模糊匹配：标题包含关键词
    for (const [title, aids] of index.byTitle.entries()) {
      if (title.includes(keywordLower)) {
        aids.forEach(aid => matchedAids.add(aid))
      }
      
      // 限制结果数量
      if (matchedAids.size >= limit * 2) {
        break
      }
    }
    
    // 转换为数组并限制数量
    const result = Array.from(matchedAids).slice(0, limit)
    
    // 按标题相关性排序（优先显示主标题匹配的）
    result.sort((aid1, aid2) => {
      const titles1 = index.byAid.get(aid1) || []
      const titles2 = index.byAid.get(aid2) || []
      
      // 检查是否有主标题匹配
      const hasPrimary1 = titles1.some(t => 
        t.type === 1 && t.title.toLowerCase().includes(keywordLower)
      )
      const hasPrimary2 = titles2.some(t => 
        t.type === 1 && t.title.toLowerCase().includes(keywordLower)
      )
      
      if (hasPrimary1 && !hasPrimary2) return -1
      if (!hasPrimary1 && hasPrimary2) return 1
      
      // 检查是否有中文标题匹配（优先显示中文结果）
      const hasChinese1 = titles1.some(t => 
        (t.lang === 'zh' || t.lang === 'zh-Hans' || t.lang === 'zh-Hant') &&
        t.title.toLowerCase().includes(keywordLower)
      )
      const hasChinese2 = titles2.some(t => 
        (t.lang === 'zh' || t.lang === 'zh-Hans' || t.lang === 'zh-Hant') &&
        t.title.toLowerCase().includes(keywordLower)
      )
      
      if (hasChinese1 && !hasChinese2) return -1
      if (!hasChinese1 && hasChinese2) return 1
      
      return 0
    })
    
    return result.slice(0, limit)
  } catch (error) {
    console.error('搜索动画标题失败:', error)
    return []
  }
}

/**
 * 获取指定 AID 的所有标题
 */
export async function getAnimeTitles(aid: number): Promise<AnimeTitleEntry[]> {
  try {
    const index = await loadAnimeTitles()
    return index.byAid.get(aid) || []
  } catch (error) {
    console.error('获取动画标题失败:', error)
    return []
  }
}

/**
 * 获取指定 AID 的主标题
 */
export async function getMainTitle(aid: number): Promise<string | null> {
  const titles = await getAnimeTitles(aid)
  const mainTitle = titles.find(t => t.type === 1)
  return mainTitle?.title || null
}

/**
 * 获取指定 AID 的中文标题（优先简体中文）
 */
export async function getChineseTitle(aid: number): Promise<string | null> {
  const titles = await getAnimeTitles(aid)
  
  // 优先简体中文
  const zhHans = titles.find(t => t.lang === 'zh-Hans')
  if (zhHans) return zhHans.title
  
  // 其次繁体中文
  const zhHant = titles.find(t => t.lang === 'zh-Hant')
  if (zhHant) return zhHant.title
  
  // 最后通用中文
  const zh = titles.find(t => t.lang === 'zh')
  if (zh) return zh.title
  
  return null
}

