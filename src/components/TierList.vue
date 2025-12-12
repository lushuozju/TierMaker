<script setup lang="ts">
import { computed } from 'vue'
import TierRow from './TierRow.vue'
import type { Tier, TierConfig, AnimeItem } from '../types'

const props = defineProps<{
  tiers: Tier[]
  tierConfigs: TierConfig[]
  isDragging?: boolean
  isExportingImage?: boolean
}>()

const emit = defineEmits<{
  'add-item': [tierId: string, rowId: string, index: number]
  'add-row': [tierId: string]
  'delete-row': [tierId: string, rowId: string]
  'delete-item': [tierId: string, rowId: string, index: number]
  'edit-item': [tierId: string, rowId: string, item: AnimeItem, index: number]
  'move-item': [data: {
    fromTierId: string
    fromRowId: string
    toTierId: string
    toRowId: string
    fromIndex: number
    toIndex: number
    item: AnimeItem
  }]
  'reorder': [tierId: string, rowId: string, newItems: AnimeItem[]]
  'drag-start': []
  'drag-end': []
}>()

function getTierConfig(tierId: string): TierConfig | undefined {
  return props.tierConfigs.find(c => c.id === tierId)
}
</script>

<template>
  <div class="tier-list">
    <div
      v-for="tier in tiers"
      :key="tier.id"
      class="tier-group"
    >
      <div
        v-for="(row, rowIndex) in tier.rows"
        :key="row.id"
        class="tier-row-wrapper"
      >
        <div
          class="tier-label"
          :style="{ backgroundColor: getTierConfig(tier.id)?.color || '#000000' }"
        >
          <span class="tier-label-text">{{ getTierConfig(tier.id)?.label || tier.id }}</span>
        </div>
        
        <TierRow
          :row="row"
          :tier-id="tier.id"
          :row-id="row.id"
          :is-dragging="props.isDragging"
          :is-exporting-image="props.isExportingImage"
          @add-item="(index) => emit('add-item', tier.id, row.id, index)"
          @delete-item="(index) => emit('delete-item', tier.id, row.id, index)"
          @edit-item="(item, index) => emit('edit-item', tier.id, row.id, item, index)"
          @reorder="(newItems) => emit('reorder', tier.id, row.id, newItems)"
          @drag-start="() => emit('drag-start')"
          @drag-end="() => emit('drag-end')"
          @move-item="(data) => {
            // 需要找到源行和目标行所在的等级
            let fromTierId = tier.id
            let toTierId = tier.id
            
            // 查找源行和目标行所在的等级
            for (const t of props.tiers) {
              if (t.rows.find(r => r.id === data.fromRowId)) {
                fromTierId = t.id
              }
              if (t.rows.find(r => r.id === data.toRowId)) {
                toTierId = t.id
              }
            }
            
            emit('move-item', {
              fromTierId: fromTierId,
              fromRowId: data.fromRowId,
              toTierId: toTierId,
              toRowId: data.toRowId,
              fromIndex: data.fromIndex,
              toIndex: data.toIndex,
              item: data.item,
            })
          }"
        />
        
        <button
          v-if="tier.rows.length > 1"
          class="delete-row-btn"
          @click="emit('delete-row', tier.id, row.id)"
          title="删除此行"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tier-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tier-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 2px solid #000000;
}

.tier-group:first-child {
  border-top: none;
}

.tier-row-wrapper {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-top: 1px solid #000000;
}

.tier-row-wrapper:first-child {
  border-top: none;
}

.tier-label {
  min-width: 80px;
  width: 80px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  background: #000000;
  color: #ffffff;
  flex-shrink: 0;
  align-self: stretch;
}

.tier-label-text {
  font-size: 48px;
  font-weight: bold;
  color: #ffffff;
}

.delete-row-btn {
  width: 30px;
  min-width: 30px;
  background: #ffffff;
  color: #000000;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.delete-row-btn:hover {
  background: #000000;
  color: #ffffff;
}
</style>

