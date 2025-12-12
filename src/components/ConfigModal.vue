<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import type { TierConfig } from '../types'
import { loadBgmToken, saveBgmToken } from '../utils/storage'

const props = defineProps<{
  configs: TierConfig[]
}>()

const emit = defineEmits<{
  close: []
  update: [configs: TierConfig[]]
}>()

const localConfigs = ref<TierConfig[]>([])
const bgmToken = ref('')
// 临时存储输入框的值，避免输入过程中触发响应式更新
const inputValues = ref<Record<number, string>>({})

// 预设颜色选项
const presetColors = [
  '#ff7f7f', // 红色
  '#ff9f7f', // 红橙色（过渡色）
  '#ffbf7f', // 橙色
  '#ffdf7f', // 浅橙色
  '#ffff7f', // 黄色
  '#bfff7f', // 浅绿色
  '#cfcfcf', // 灰色
]

watch(() => props.configs, (newConfigs) => {
  const newLocalConfigs = JSON.parse(JSON.stringify(newConfigs))
  // 为每个配置添加内部唯一 ID（用于 key，不会改变）
  newLocalConfigs.forEach((config: any, index: number) => {
    // 如果已有内部 ID，保持不变；否则创建新的
    const existingConfig = localConfigs.value.find(c => c.id === config.id && c.order === config.order)
    if (existingConfig && (existingConfig as any)._internalId) {
      (config as any)._internalId = (existingConfig as any)._internalId
    } else {
      (config as any)._internalId = `config-${Date.now()}-${index}`
    }
    // 同步 label
    if (!config.label || config.label !== config.id) {
      config.label = config.id
    }
    // 初始化输入框的临时值
    inputValues.value[index] = config.id
  })
  localConfigs.value = newLocalConfigs
}, { immediate: true })

onMounted(() => {
  // 加载用户自定义的 Token
  const savedToken = loadBgmToken()
  if (savedToken) {
    bgmToken.value = savedToken
  }
})

function addTier() {
  const newId = String.fromCharCode(65 + localConfigs.value.length) // A, B, C...
  const newConfig: any = {
    id: newId,
    label: newId, // label 会自动从 id 生成（显示时重复）
    color: '#000000',
    order: localConfigs.value.length,
  }
  // 添加内部唯一 ID
  newConfig._internalId = `config-${Date.now()}-${localConfigs.value.length}`
  localConfigs.value.push(newConfig)
}

function removeTier(index: number) {
  if (localConfigs.value.length > 1) {
    localConfigs.value.splice(index, 1)
    // 重新排序
    localConfigs.value.forEach((config, i) => {
      config.order = i
    })
  }
}

function moveUp(index: number) {
  if (index > 0) {
    const temp = localConfigs.value[index]
    localConfigs.value[index] = localConfigs.value[index - 1]
    localConfigs.value[index - 1] = temp
    localConfigs.value[index].order = index
    localConfigs.value[index - 1].order = index - 1
  }
}

function moveDown(index: number) {
  if (index < localConfigs.value.length - 1) {
    const temp = localConfigs.value[index]
    localConfigs.value[index] = localConfigs.value[index + 1]
    localConfigs.value[index + 1] = temp
    localConfigs.value[index].order = index
    localConfigs.value[index + 1].order = index + 1
  }
}

function handleSave() {
  emit('update', localConfigs.value)
  // 保存用户自定义的 Token（如果为空则清除）
  saveBgmToken(bgmToken.value || null)
  emit('close')
}

function handleClose() {
  emit('close')
}

// 处理输入框输入事件（不直接更新 config.id，避免触发响应式更新）
function handleTierIdInput(index: number, value: string) {
  inputValues.value[index] = value
}

// 在失去焦点时更新 config.id 和 label
function handleTierIdBlur(config: TierConfig, index: number) {
  const newValue = inputValues.value[index] || config.id
  config.id = newValue
  config.label = newValue
}
</script>

<template>
  <div class="modal-overlay" @click="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">设置</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="config-section">
        <h3 class="section-title">Bangumi Access Token（可选）</h3>
        <div class="token-config">
          <div class="token-input-group">
            <input
              v-model="bgmToken"
              type="text"
              class="token-input"
              placeholder="留空则使用默认 Token"
            />
            <button
              class="token-clear-btn"
              @click="bgmToken = ''"
              :disabled="!bgmToken"
            >
              清除
            </button>
          </div>
          <p class="token-hint">
            💡 提示：留空将使用默认 Token。设置自定义 Token 后，将优先使用您的 Token。
            <br />
            获取 Token：<a href="https://next.bgm.tv/demo/access-token" target="_blank">https://next.bgm.tv/demo/access-token</a>
          </p>
        </div>
      </div>
      
      <div class="config-section">
        <h3 class="section-title">评分等级配置</h3>
      </div>
      
      <div class="config-list">
        <div
          v-for="(config, index) in localConfigs"
          :key="(config as any)._internalId || `config-${index}`"
          class="config-item"
        >
          <div class="config-controls">
            <button
              class="move-btn"
              @click="moveUp(index)"
              :disabled="index === 0"
            >
              ↑
            </button>
            <button
              class="move-btn"
              @click="moveDown(index)"
              :disabled="index === localConfigs.length - 1"
            >
              ↓
            </button>
          </div>
          
          <input
            :value="inputValues[index] !== undefined ? inputValues[index] : config.id"
            type="text"
            class="config-input"
            placeholder="等级（如 S、SS、A、EX）"
            @input="(e) => handleTierIdInput(index, (e.target as HTMLInputElement).value)"
            @blur="handleTierIdBlur(config, index)"
          />
          <div class="color-selector">
            <input
              v-model="config.color"
              type="color"
              class="config-color"
            />
            <div class="preset-colors">
              <button
                v-for="presetColor in presetColors"
                :key="presetColor"
                class="preset-color-btn"
                :class="{ active: config.color === presetColor }"
                :style="{ backgroundColor: presetColor }"
                :title="presetColor"
                @click="config.color = presetColor"
              />
            </div>
          </div>
          
          <button
            class="remove-btn"
            @click="removeTier(index)"
            :disabled="localConfigs.length <= 1"
          >
            删除
          </button>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="add-btn" @click="addTier">添加等级</button>
        <div class="footer-actions">
          <button class="btn btn-cancel" @click="handleClose">取消</button>
          <button class="btn btn-save" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #ffffff;
  border: 2px solid #000000;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #000000;
}

.modal-title {
  font-size: 24px;
  font-weight: bold;
}

.close-btn {
  width: 30px;
  height: 30px;
  border: 2px solid #000000;
  background: #ffffff;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #000000;
  color: #ffffff;
}

.config-section {
  padding: 20px;
  border-bottom: 1px solid #cccccc;
}

.config-section:last-of-type {
  border-bottom: none;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 15px;
}

.token-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.token-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.token-input {
  flex: 1;
  padding: 10px;
  border: 2px solid #000000;
  font-size: 14px;
  font-family: monospace;
}

.token-clear-btn {
  padding: 10px 15px;
  border: 2px solid #000000;
  background: #ffffff;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.token-clear-btn:hover:not(:disabled) {
  background: #000000;
  color: #ffffff;
}

.token-clear-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.token-hint {
  font-size: 12px;
  color: #666666;
  line-height: 1.6;
  margin: 0;
}

.token-hint a {
  color: #0066cc;
  text-decoration: underline;
}

.token-hint a:hover {
  color: #004499;
}

.config-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.config-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 15px;
  margin-bottom: 10px;
  border: 2px solid #000000;
}

.config-controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.move-btn {
  width: 30px;
  height: 20px;
  border: 1px solid #000000;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.move-btn:hover:not(:disabled) {
  background: #000000;
  color: #ffffff;
}

.move-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.config-input {
  flex: 1;
  padding: 8px;
  border: 2px solid #000000;
  font-size: 14px;
}

.color-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.config-color {
  width: 60px;
  height: 40px;
  border: 2px solid #000000;
  cursor: pointer;
}

.preset-colors {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.preset-color-btn {
  width: 24px;
  height: 24px;
  border: 2px solid #000000;
  cursor: pointer;
  padding: 0;
  background: none;
  transition: all 0.2s;
  position: relative;
}

.preset-color-btn:hover {
  transform: scale(1.1);
  z-index: 1;
}

.preset-color-btn.active {
  border-width: 3px;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #000000;
}

.remove-btn {
  padding: 8px 15px;
  border: 2px solid #000000;
  background: #ffffff;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-btn:hover:not(:disabled) {
  background: #000000;
  color: #ffffff;
}

.remove-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.modal-footer {
  padding: 20px;
  border-top: 2px solid #000000;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-btn {
  padding: 10px 20px;
  border: 2px solid #000000;
  background: #ffffff;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  background: #000000;
  color: #ffffff;
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: 2px solid #000000;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #ffffff;
  color: #000000;
}

.btn-cancel:hover {
  background: #f0f0f0;
}

.btn-save {
  background: #000000;
  color: #ffffff;
}

.btn-save:hover {
  background: #333333;
}
</style>

