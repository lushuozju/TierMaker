<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sortable from 'sortablejs'
import SearchModal from './SearchModal.vue'
import type { AnimeItem } from '../types'

const props = defineProps<{
  items: AnimeItem[]
  isDragging?: boolean
  hideItemNames?: boolean
}>()

const emit = defineEmits<{
  'add-item': []
  'delete-item': [index: number]
  'move-item': [data: {
    fromTierId: string
    fromRowId: string
    fromIndex: number
    toTierId: string
    toRowId: string
    toIndex: number
    item: AnimeItem
  }]
  'reorder': [newItems: AnimeItem[]]
  'drag-start': []
  'drag-end': []
}>()

const candidatesElement = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null
const showSearch = ref(false)

const displayItems = computed(() => {
  return [...props.items]
})

function handleSelectAnime(anime: AnimeItem) {
  emit('reorder', [...props.items, anime])
  showSearch.value = false
}

function handleSelectMultiple(animes: AnimeItem[]) {
  // 批量添加所有角色到备选框
  emit('reorder', [...props.items, ...animes])
  showSearch.value = false
}

function handleItemDelete(index: number, event: Event) {
  event.stopPropagation()
  const newItems = [...props.items]
  newItems.splice(index, 1)
  emit('reorder', newItems)
}

function getImageUrl(item: AnimeItem): string {
  // 直接返回图片URL，如果没有则返回空字符串
  return item.image || ''
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+'
}

onMounted(() => {
  if (candidatesElement.value) {
    sortableInstance = new Sortable(candidatesElement.value, {
      animation: 150,
      filter: '.delete-btn',
      group: {
        name: 'tier-items',
        pull: true,
        put: true,
      },
      draggable: '.candidate-item',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      forceFallback: false,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onStart: () => {
        emit('drag-start')
      },
      onEnd: (evt) => {
        emit('drag-end')
        const oldIndex = evt.oldIndex
        const newIndex = evt.newIndex
        const toElement = evt.to as HTMLElement
        const fromElement = evt.from as HTMLElement
        
        if (oldIndex === undefined || newIndex === undefined) {
          return
        }
        
        // 获取目标行的信息
        const toRowId = toElement.getAttribute('data-row-id')
        const fromRowId = fromElement.getAttribute('data-row-id')
        
        // 如果是跨容器拖动（从备选框拖动到等级框）
        if (toRowId && toRowId !== 'candidates' && evt.from !== evt.to) {
          if (oldIndex >= 0 && oldIndex < props.items.length) {
            const movedItem = props.items[oldIndex]
            
            // 触发跨容器拖动事件（toTierId 会在 App.vue 中通过 toRowId 查找）
            emit('move-item', {
              fromIndex: oldIndex,
              fromTierId: 'candidates',
              fromRowId: 'candidates',
              toTierId: '', // 留空，在 App.vue 中通过 toRowId 查找
              toRowId,
              toIndex: newIndex,
              item: movedItem,
            })
          }
        } else if (evt.from === evt.to && oldIndex !== newIndex) {
          // 同一容器内的重新排序（备选框内）
          const newItems = [...props.items]
          const [removed] = newItems.splice(oldIndex, 1)
          newItems.splice(newIndex, 0, removed)
          emit('reorder', newItems)
        }
        // 从等级框拖动到备选框的情况会在 TierRow 的 onEnd 中触发 move-item 事件
        // 然后在 App.vue 的 handleMoveItem 中处理，这里不需要额外处理
      },
    })
  }
})
</script>

<template>
  <div class="candidates-box">
    <div class="candidates-header">
      <h3 class="candidates-title">备选作品</h3>
      <button class="btn-add" @click="showSearch = true" title="添加作品">
        + 添加
      </button>
    </div>
    <div
      ref="candidatesElement"
      class="candidates-grid"
      data-row-id="candidates"
    >
      <div
        v-for="(item, index) in displayItems"
        :key="item.id || index"
        class="candidate-item"
      >
        <img
          :src="getImageUrl(item)"
          :alt="item.name"
          class="candidate-image"
          @error="handleImageError"
        />
        <div v-if="!hideItemNames" class="candidate-info">
          <div class="candidate-name">
            {{ item.name_cn || item.name }}
          </div>
        </div>
        <button
          class="delete-btn"
          @click="handleItemDelete(index, $event)"
          title="删除"
        >
          ×
        </button>
      </div>
      <div v-if="displayItems.length === 0" class="candidates-empty">
        点击"添加"按钮搜索并添加作品
      </div>
    </div>
    
    <SearchModal
      v-if="showSearch"
      @close="showSearch = false"
      @select="handleSelectAnime"
      @select-multiple="handleSelectMultiple"
    />
  </div>
</template>

<style scoped>
.candidates-box {
  border: 2px solid var(--border-color);
  border-radius: 8px;
  margin: 20px 0;
  background: var(--bg-color);
}

.candidates-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 2px solid var(--border-color);
  background: var(--bg-light-color);
}

.candidates-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-color);
  margin: 0;
}

.btn-add {
  padding: 8px 16px;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 4px;
}

.btn-add:hover {
  background: var(--border-color);
  color: var(--bg-color);
}

.candidates-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 15px;
  min-height: 120px;
}

.candidate-item {
  position: relative;
  width: 100px;
  height: 173px;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  cursor: move;
  transition: all 0.2s;
  overflow: hidden;
}

.candidate-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.candidate-item.hide-name {
  height: 133px !important;
}

.candidate-image {
  width: 100%;
  height: 133px;
  object-fit: cover;
  display: block;
}

.candidate-info {
  padding: 8px;
}

.candidate-name {
  font-size: 12px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  line-height: 1;
  opacity: 0.8;
}

.delete-btn:hover {
  background: var(--border-color);
  color: var(--bg-color);
  opacity: 1;
}

.candidates-empty {
  width: 100%;
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
}

/* 拖动样式 */
.candidate-item.sortable-ghost {
  opacity: 0.4;
}

.candidate-item.sortable-chosen {
  cursor: grabbing;
}

.candidate-item.sortable-drag {
  opacity: 1 !important;
  transform: rotate(5deg);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}
</style>

