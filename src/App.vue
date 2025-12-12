<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import html2canvas from 'html2canvas'
import TierList from './components/TierList.vue'
import SearchModal from './components/SearchModal.vue'
import ConfigModal from './components/ConfigModal.vue'
import EditItemModal from './components/EditItemModal.vue'
import type { Tier, AnimeItem, TierConfig } from './types'
import { loadTierData, saveTierData, loadTierConfigs, saveTierConfigs, loadTitle, saveTitle, exportAllData, importAllData, type ExportData } from './utils/storage'

const tiers = ref<Tier[]>([])
const tierConfigs = ref<TierConfig[]>([])
const showSearch = ref(false)
const showConfig = ref(false)
const showEditItem = ref(false)
const currentTierId = ref<string | null>(null)
const currentRowId = ref<string | null>(null)
const currentIndex = ref<number | null>(null)
const currentEditItem = ref<AnimeItem | null>(null)
const title = ref<string>('极简 Tier List')
const isDragging = ref(false) // 全局拖动状态

// 加载数据
onMounted(() => {
  title.value = loadTitle()
  tierConfigs.value = loadTierConfigs()
  tiers.value = loadTierData()
  
  // 设置标题的初始内容
  nextTick(() => {
    if (titleRef.value) {
      titleRef.value.textContent = title.value
    }
  })
  
  // 确保 tiers 和 tierConfigs 同步
  const configIds = new Set(tierConfigs.value.map(c => c.id))
  
  // 移除配置中不存在的等级
  tiers.value = tiers.value.filter(t => configIds.has(t.id))
  
  // 添加配置中存在但 tiers 中不存在的等级
  tierConfigs.value.forEach(config => {
    if (!tiers.value.find(t => t.id === config.id)) {
      tiers.value.push({
        id: config.id,
        rows: [{
          id: `${config.id}-row-0`,
          items: [],
        }],
      })
    }
  })
  
  // 按配置顺序排序
  tiers.value.sort((a, b) => {
    const aOrder = tierConfigs.value.find(c => c.id === a.id)?.order ?? 999
    const bOrder = tierConfigs.value.find(c => c.id === b.id)?.order ?? 999
    return aOrder - bOrder
  })
  
  // 保存同步后的数据
  saveTierData(tiers.value)
})

// 监听数据变化，自动保存
watch(tiers, () => {
  saveTierData(tiers.value)
}, { deep: true })

function handleAddItem(tierId: string, rowId: string, index: number) {
  currentTierId.value = tierId
  currentRowId.value = rowId
  currentIndex.value = index
  showSearch.value = true
}

function handleSelectAnime(anime: AnimeItem) {
  if (currentTierId.value && currentRowId.value && currentIndex.value !== null) {
    const tier = tiers.value.find(t => t.id === currentTierId.value)
    if (tier) {
      const row = tier.rows.find(r => r.id === currentRowId.value)
      if (row) {
        // 确保数组长度足够
        while (row.items.length <= currentIndex.value) {
          row.items.push({} as AnimeItem)
        }
        row.items[currentIndex.value] = anime
      }
    }
  }
  showSearch.value = false
  currentTierId.value = null
  currentRowId.value = null
  currentIndex.value = null
}

function handleAddRow(tierId: string) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (tier) {
    const newRowId = `${tierId}-row-${tier.rows.length}`
    tier.rows.push({
      id: newRowId,
      items: [],
    })
  }
}

function handleDeleteRow(tierId: string, rowId: string) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (tier && tier.rows.length > 1) {
    const index = tier.rows.findIndex(r => r.id === rowId)
    if (index !== -1) {
      tier.rows.splice(index, 1)
    }
  }
}

function handleDeleteItem(tierId: string, rowId: string, index: number) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (tier) {
    const row = tier.rows.find(r => r.id === rowId)
    if (row) {
      row.items.splice(index, 1)
    }
  }
}

function handleMoveItem(data: {
  fromTierId: string
  fromRowId: string
  toTierId: string
  toRowId: string
  fromIndex: number
  toIndex: number
  item: AnimeItem
}) {
  // 找到源行和目标行
  const fromTier = tiers.value.find(t => t.id === data.fromTierId)
  const toTier = tiers.value.find(t => t.id === data.toTierId)
  
  if (!fromTier || !toTier) return
  
  const fromRow = fromTier.rows.find(r => r.id === data.fromRowId)
  const toRow = toTier.rows.find(r => r.id === data.toRowId)
  
  if (!fromRow || !toRow) return
  
  // 确保源索引有效
  if (data.fromIndex < 0 || data.fromIndex >= fromRow.items.length) {
    return
  }
  
  // 获取要移动的项目
  const itemToMove = fromRow.items[data.fromIndex]
  
  // 如果是跨等级拖动或跨行拖动
  if (data.fromTierId !== data.toTierId || data.fromRowId !== data.toRowId) {
    // 从源行移除
    fromRow.items.splice(data.fromIndex, 1)
    
    // 添加到目标行（确保索引有效，排除空位）
    const targetIndex = Math.min(data.toIndex, toRow.items.length)
    toRow.items.splice(targetIndex, 0, itemToMove)
    
    saveTierData(tiers.value)
  }
}

function handleReorder(tierId: string, rowId: string, newItems: AnimeItem[]) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (!tier) return
  
  const row = tier.rows.find(r => r.id === rowId)
  if (!row) return
  
  row.items = newItems
  saveTierData(tiers.value)
}

function handleEditItem(tierId: string, rowId: string, item: AnimeItem, index: number) {
  currentTierId.value = tierId
  currentRowId.value = rowId
  currentIndex.value = index
  currentEditItem.value = { ...item } // 创建副本
  showEditItem.value = true
}

function handleSaveEditItem(updatedItem: AnimeItem) {
  if (currentTierId.value && currentRowId.value && currentIndex.value !== null) {
    const tier = tiers.value.find(t => t.id === currentTierId.value)
    if (tier) {
      const row = tier.rows.find(r => r.id === currentRowId.value)
      if (row) {
        row.items[currentIndex.value] = updatedItem
      }
    }
  }
  showEditItem.value = false
  currentTierId.value = null
  currentRowId.value = null
  currentIndex.value = null
  currentEditItem.value = null
}

function handleCloseEditItem() {
  showEditItem.value = false
  currentTierId.value = null
  currentRowId.value = null
  currentIndex.value = null
  currentEditItem.value = null
}

function handleUpdateConfigs(newConfigs: TierConfig[]) {
  tierConfigs.value = newConfigs
  saveTierConfigs(newConfigs)
  
  // 更新 tiers 结构
  const existingTierIds = new Set(tiers.value.map(t => t.id))
  const newTierIds = new Set(newConfigs.map(c => c.id))
  
  // 添加新的等级
  newConfigs.forEach(config => {
    if (!existingTierIds.has(config.id)) {
      tiers.value.push({
        id: config.id,
        rows: [{
          id: `${config.id}-row-0`,
          items: [],
        }],
      })
    }
  })
  
  // 移除不存在的等级（确保显示内容与配置完全一致）
  tiers.value = tiers.value.filter(t => newTierIds.has(t.id))
  
  // 按配置顺序排序
  tiers.value.sort((a, b) => {
    const aOrder = newConfigs.find(c => c.id === a.id)?.order ?? 999
    const bOrder = newConfigs.find(c => c.id === b.id)?.order ?? 999
    return aOrder - bOrder
  })
}

const titleRef = ref<HTMLHeadingElement | null>(null)
const isEditingTitle = ref(false)
const appContentRef = ref<HTMLElement | null>(null)
const isExportingImage = ref(false)

function handleTitleInput(e: Event) {
  const target = e.target as HTMLHeadingElement
  // 总是更新 title，即使内容为空（允许删除）
  const newTitle = target.textContent?.trim() || ''
  title.value = newTitle || '极简 Tier List'
  saveTitle(title.value)
}

function handleTitleBlur(e: Event) {
  const target = e.target as HTMLHeadingElement
  isEditingTitle.value = false
  
  // 先保存当前内容
  const newTitle = target.textContent?.trim() || ''
  if (newTitle) {
    title.value = newTitle
    saveTitle(title.value)
  } else {
    // 如果为空，恢复为默认值
    const defaultTitle = '极简 Tier List'
    title.value = defaultTitle
    target.textContent = defaultTitle
    saveTitle(defaultTitle)
  }
}

function handleTitleFocus() {
  isEditingTitle.value = true
}

// 监听 title 变化，只在非编辑状态下更新 DOM
watch(title, (newTitle) => {
  if (!isEditingTitle.value && titleRef.value) {
    titleRef.value.textContent = newTitle
  }
})

// 导出数据
function handleExport() {
  try {
    const data = exportAllData()
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tier-list-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败，请重试')
  }
}

// 导入数据
const fileInputRef = ref<HTMLInputElement | null>(null)

function handleImportClick() {
  fileInputRef.value?.click()
}

function handleFileImport(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const jsonStr = event.target?.result as string
      const data: ExportData = JSON.parse(jsonStr)
      
      // 验证数据格式
      if (!data.tiers || !data.tierConfigs) {
        alert('文件格式不正确')
        return
      }
      
      // 确认导入
      if (confirm('导入数据将覆盖当前所有数据，是否继续？')) {
        const result = importAllData(data)
        if (result.success) {
          // 重新加载数据
          title.value = loadTitle()
          tierConfigs.value = loadTierConfigs()
          tiers.value = loadTierData()
          
          // 同步数据
          const configIds = new Set(tierConfigs.value.map(c => c.id))
          tiers.value = tiers.value.filter(t => configIds.has(t.id))
          
          tierConfigs.value.forEach(config => {
            if (!tiers.value.find(t => t.id === config.id)) {
              tiers.value.push({
                id: config.id,
                rows: [{
                  id: `${config.id}-row-0`,
                  items: [],
                }],
              })
            }
          })
          
          tiers.value.sort((a, b) => {
            const aOrder = tierConfigs.value.find(c => c.id === a.id)?.order ?? 999
            const bOrder = tierConfigs.value.find(c => c.id === b.id)?.order ?? 999
            return aOrder - bOrder
          })
          
          // 更新标题显示
          nextTick(() => {
            if (titleRef.value) {
              titleRef.value.textContent = title.value
            }
          })
          
          alert('导入成功！')
        } else {
          alert(`导入失败: ${result.error || '未知错误'}`)
        }
      }
    } catch (error) {
      console.error('导入失败:', error)
      alert('文件格式不正确或已损坏')
    }
    
    // 清空文件输入
    if (target) {
      target.value = ''
    }
  }
  reader.readAsText(file)
}

// 保存为高清图片
async function handleExportImage() {
  if (!appContentRef.value) {
    alert('无法找到要导出的内容')
    return
  }
  
  if (isExportingImage.value) {
    return // 防止重复点击
  }
  
  isExportingImage.value = true
  
  try {
    // 等待DOM更新，确保empty slot已隐藏
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 保存当前滚动位置
    const originalScrollX = window.scrollX
    const originalScrollY = window.scrollY
    
    // 滚动到顶部
    window.scrollTo(0, 0)
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 获取完整页面的尺寸
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      appContentRef.value.scrollWidth
    )
    const scrollHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      appContentRef.value.scrollHeight
    )
    
    // 创建一个图片URL到base64的映射，用于在onclone中使用
    const imageUrlToBase64 = new Map<string, string>()
    
    // 预先转换所有图片为base64
    const allImages = Array.from(document.querySelectorAll('img')) as HTMLImageElement[]
    const conversionPromises = allImages.map(async (img) => {
      // 优先使用data-original-src，如果没有则使用src
      const originalUrl = img.getAttribute('data-original-src') || img.src
      
      if (!originalUrl || originalUrl === '') {
        return
      }
      
      // 如果已经是base64，直接保存
      if (originalUrl.startsWith('data:')) {
        imageUrlToBase64.set(originalUrl, originalUrl)
        // 同时保存src的映射（如果src不同）
        if (img.src && img.src !== originalUrl) {
          imageUrlToBase64.set(img.src, originalUrl)
        }
        return
      }
      
      // 方法1: 尝试从已加载的图片元素中直接获取base64（绕过CORS）
      try {
        // 检查图片是否已完全加载
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const base64 = await convertLoadedImageToBase64(img)
          if (base64) {
            imageUrlToBase64.set(originalUrl, base64)
            if (img.src && img.src !== originalUrl) {
              imageUrlToBase64.set(img.src, base64)
            }
            console.log('✅ 从已加载图片获取base64:', originalUrl.substring(0, 50) + '...')
            return
          }
        }
      } catch (error) {
        console.debug('从已加载图片获取失败，尝试其他方法:', error)
      }
      
      // 方法2: 如果是URL，尝试通过网络转换（可能因CORS失败）
      try {
        const base64 = await convertImageToBase64ForExport(originalUrl)
        if (base64) {
          // 保存原始URL到base64的映射
          imageUrlToBase64.set(originalUrl, base64)
          // 同时保存src的映射（如果src不同）
          if (img.src && img.src !== originalUrl) {
            imageUrlToBase64.set(img.src, base64)
          }
          console.log('✅ 通过网络转换成功:', originalUrl.substring(0, 50) + '...')
        } else {
          console.warn('⚠️ 图片转换返回null:', originalUrl)
        }
      } catch (error) {
        console.warn('❌ 无法转换图片:', originalUrl, error)
      }
    })
    
    // 等待所有图片转换完成
    const results = await Promise.allSettled(conversionPromises)
    
    // 统计转换结果
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.filter(r => r.status === 'rejected').length
    console.log(`图片转换完成: 成功 ${successCount}, 失败 ${failCount}, 总计 ${allImages.length}`)
    console.log('已转换的图片URL:', Array.from(imageUrlToBase64.keys()).slice(0, 5))
    
    // 额外等待确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 使用 html2canvas 截图，捕获完整页面
    const canvas = await html2canvas(appContentRef.value, {
      scale: 2, // 2倍缩放，提高清晰度
      useCORS: false, // 禁用CORS，因为我们已经在onclone中处理了所有图片
      allowTaint: false, // 不允许污染画布（确保所有图片都已转换为base64）
      logging: true, // 启用日志以便调试
      backgroundColor: '#ffffff',
      width: scrollWidth,
      height: scrollHeight,
      windowWidth: scrollWidth,
      windowHeight: scrollHeight,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 30000, // 增加图片加载超时时间
      removeContainer: false, // 保留容器
      foreignObjectRendering: false, // 禁用 foreignObject，使用传统渲染
      onclone: async (clonedDoc) => {
        // 在克隆的文档中，将所有URL图片替换为base64
        const clonedImages = clonedDoc.querySelectorAll('img')
        console.log(`开始处理 ${clonedImages.length} 张图片`)
        
        for (const clonedImg of clonedImages) {
          // 优先使用data-original-src获取原始URL
          const dataOriginalSrc = clonedImg.getAttribute('data-original-src')
          const currentSrc = clonedImg.getAttribute('src')
          
          // 确定要查找的URL（优先使用data-original-src）
          const urlToLookup = dataOriginalSrc || currentSrc
          
          if (!urlToLookup) {
            continue
          }
          
          // 如果已经是base64，跳过
          if (urlToLookup.startsWith('data:')) {
            continue
          }
          
          // 查找对应的base64数据
          let base64Data = imageUrlToBase64.get(urlToLookup)
          
          // 如果通过原始URL没找到，尝试通过当前src查找
          if (!base64Data && currentSrc && currentSrc !== urlToLookup) {
            base64Data = imageUrlToBase64.get(currentSrc)
          }
          
          // 如果找到了base64数据，替换src
          if (base64Data) {
            clonedImg.src = base64Data
            console.log('✅ 在onclone中替换图片:', urlToLookup.substring(0, 50) + '...')
          } else {
            // 如果还没转换，尝试从原始文档中找到对应的img元素
            console.warn('⚠️ 图片未预先转换，尝试从原始DOM获取:', urlToLookup)
            try {
              // 在原始文档中查找对应的img元素（使用更灵活的查询）
              let originalImg: HTMLImageElement | null = null
              
              // 先尝试通过data-original-src查找
              if (dataOriginalSrc) {
                originalImg = document.querySelector(`img[data-original-src="${dataOriginalSrc}"]`) as HTMLImageElement
              }
              
              // 如果没找到，尝试通过src查找
              if (!originalImg && currentSrc) {
                originalImg = document.querySelector(`img[src="${currentSrc}"]`) as HTMLImageElement
              }
              
              // 如果还是没找到，尝试通过data-original-src查找（使用urlToLookup）
              if (!originalImg) {
                originalImg = document.querySelector(`img[data-original-src="${urlToLookup}"]`) as HTMLImageElement
              }
              
              if (originalImg && originalImg.complete && originalImg.naturalWidth > 0 && originalImg.naturalHeight > 0) {
                // 从已加载的原始图片元素获取base64
                const base64 = await convertLoadedImageToBase64(originalImg)
                if (base64) {
                  clonedImg.src = base64
                  imageUrlToBase64.set(urlToLookup, base64)
                  if (currentSrc && currentSrc !== urlToLookup) {
                    imageUrlToBase64.set(currentSrc, base64)
                  }
                  console.log('✅ 在onclone中从原始DOM获取成功:', urlToLookup.substring(0, 50) + '...')
                } else {
                  console.error('❌ 在onclone中从原始DOM获取返回null:', urlToLookup)
                }
              } else {
                console.warn('⚠️ 原始图片未找到或未加载:', urlToLookup, {
                  found: !!originalImg,
                  complete: originalImg?.complete,
                  naturalWidth: originalImg?.naturalWidth,
                  naturalHeight: originalImg?.naturalHeight
                })
              }
            } catch (error) {
              console.error('❌ 在onclone中转换图片失败:', urlToLookup, error)
            }
          }
        }
        
        console.log('onclone处理完成')
        
        // 确保在克隆的文档中也隐藏empty slot
        const emptySlots = clonedDoc.querySelectorAll('.tier-item.empty')
        emptySlots.forEach((slot) => {
          (slot as HTMLElement).style.display = 'none'
        })
        
        // 隐藏所有按钮和交互元素
        const buttons = clonedDoc.querySelectorAll('button, .btn, .header-actions')
        buttons.forEach((btn) => {
          (btn as HTMLElement).style.display = 'none'
        })
      },
    })
    
    // 恢复滚动位置
    window.scrollTo(originalScrollX, originalScrollY)
    
    // 转换为 blob
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('生成图片失败')
        isExportingImage.value = false
        return
      }
      
      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tier-list-${new Date().toISOString().split('T')[0]}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      isExportingImage.value = false
    }, 'image/png', 1.0) // 最高质量
  } catch (error) {
    console.error('导出图片失败:', error)
    alert('导出图片失败：' + (error instanceof Error ? error.message : '未知错误'))
    isExportingImage.value = false
  }
}

// 使用CORS代理获取图片（使用 wsrv.nl，专门用于图片处理，更稳定）
function getCorsProxyUrl(url: string): string {
  // wsrv.nl 是专门用于图片的代理服务，支持CORS，返回PNG格式
  // 参数说明：
  // - url: 原始图片URL
  // - output=png: 输出PNG格式
  // - n=-1: 不缓存（-1表示禁用缓存）
  // - t=timestamp: 添加时间戳防止缓存
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png&n=-1&t=${Date.now()}`
}

// 从已加载的图片元素中获取base64（使用 wsrv.nl 代理）
async function convertLoadedImageToBase64(img: HTMLImageElement): Promise<string | null> {
  try {
    // 获取原始URL
    const originalUrl = img.getAttribute('data-original-src') || img.src
    
    // 如果已经是base64或blob，直接返回
    if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
      return originalUrl
    }
    
    // 使用 wsrv.nl 代理加载图片（类似 anime-role-grid 的方法）
    try {
      const proxyUrl = getCorsProxyUrl(originalUrl)
      
      // 使用 Image 对象加载代理后的图片
      return new Promise<string>((resolve, reject) => {
        const proxyImg = new Image()
        proxyImg.crossOrigin = 'anonymous'
        proxyImg.referrerPolicy = 'no-referrer'
        
        proxyImg.onload = async () => {
          try {
            // 等待图片解码
            await proxyImg.decode()
            
            // 验证图片尺寸
            if (proxyImg.naturalWidth === 0 || proxyImg.naturalHeight === 0) {
              reject(new Error('图片尺寸为0'))
              return
            }
            
            // 绘制到canvas并转换为base64
            const canvas = document.createElement('canvas')
            canvas.width = proxyImg.naturalWidth
            canvas.height = proxyImg.naturalHeight
            const ctx = canvas.getContext('2d')
            
            if (!ctx) {
              reject(new Error('无法创建canvas上下文'))
              return
            }
            
            ctx.drawImage(proxyImg, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')
            resolve(dataUrl)
          } catch (error) {
            reject(error)
          }
        }
        
        proxyImg.onerror = () => {
          reject(new Error('图片加载失败'))
        }
        
        proxyImg.src = proxyUrl
      })
    } catch (proxyError) {
      console.warn('wsrv.nl 代理方法失败:', proxyError)
      return null
    }
  } catch (error) {
    console.warn('从已加载图片获取base64失败:', error)
    return null
  }
}

// 将图片URL转换为base64（用于导出，使用 wsrv.nl 代理）
async function convertImageToBase64ForExport(imageUrl: string): Promise<string | null> {
  if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl // 如果已经是base64或blob，直接返回
  }
  
  try {
    // 使用 wsrv.nl 代理加载图片（类似 anime-role-grid 的方法）
    const proxyUrl = getCorsProxyUrl(imageUrl)
    
    return new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.referrerPolicy = 'no-referrer'
      
      img.onload = async () => {
        try {
          // 等待图片解码
          await img.decode()
          
          // 验证图片尺寸
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            reject(new Error('图片尺寸为0'))
            return
          }
          
          // 绘制到canvas并转换为base64
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error('无法创建canvas上下文'))
            return
          }
          
          ctx.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/png')
          resolve(dataUrl)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }
      
      img.src = proxyUrl
    })
  } catch (error) {
    console.warn('图片转换失败:', imageUrl, error)
    return null
  }
}

</script>

<template>
  <div class="app" ref="appContentRef">
    <header class="header">
      <h1 
        class="title" 
        contenteditable="true"
        @input="handleTitleInput"
        @blur="handleTitleBlur"
        @focus="handleTitleFocus"
        @keydown.enter.prevent="titleRef?.blur()"
        @keydown.esc.prevent="titleRef?.blur()"
        ref="titleRef"
        title="点击编辑标题"
      ></h1>
      <div class="header-actions">
        <button 
          class="btn btn-secondary" 
          @click="handleExportImage" 
          title="保存为高清图片"
          :disabled="isExportingImage"
        >
          {{ isExportingImage ? '准备中...' : '保存图片' }}
        </button>
        <button 
          v-if="isExportingImage" 
          class="btn btn-secondary" 
          @click="isExportingImage = false" 
          title="恢复页面显示"
        >
          恢复显示
        </button>
        <button class="btn btn-secondary" @click="handleExport" title="导出数据">
          导出
        </button>
        <button class="btn btn-secondary" @click="handleImportClick" title="导入数据">
          导入
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleFileImport"
        />
        <button class="btn btn-secondary" @click="showConfig = true">
          设置
        </button>
      </div>
    </header>

    <TierList
      :tiers="tiers"
      :tier-configs="tierConfigs"
      :is-dragging="isDragging"
      :is-exporting-image="isExportingImage"
      @add-item="handleAddItem"
      @add-row="handleAddRow"
      @delete-row="handleDeleteRow"
      @delete-item="handleDeleteItem"
      @edit-item="handleEditItem"
      @move-item="handleMoveItem"
      @reorder="handleReorder"
      @drag-start="isDragging = true"
      @drag-end="isDragging = false"
    />

    <SearchModal
      v-if="showSearch"
      @close="showSearch = false"
      @select="handleSelectAnime"
    />

    <ConfigModal
      v-if="showConfig"
      :configs="tierConfigs"
      @close="showConfig = false"
      @update="handleUpdateConfigs"
    />

    <EditItemModal
      v-if="showEditItem"
      :item="currentEditItem"
      @close="handleCloseEditItem"
      @save="handleSaveEditItem"
    />
  </div>
</template>

<style scoped>
.app {
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #000000;
}

.title {
  font-size: 32px;
  font-weight: bold;
  color: #000000;
  letter-spacing: 2px;
  cursor: text;
  outline: none;
  transition: opacity 0.2s;
}

.title:hover {
  opacity: 0.7;
}

.title:focus {
  opacity: 1;
  border-bottom: 2px dashed #000000;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: 2px solid #000000;
  background: #ffffff;
  color: #000000;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  background: #000000;
  color: #ffffff;
}

.btn-secondary {
  background: #ffffff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:disabled:hover {
  background: #ffffff;
  color: #000000;
}
</style>

