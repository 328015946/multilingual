<template>
  <!-- 主编辑区 -->
  <el-card class="language-editor-card" v-loading="isLoading" element-loading-text="正在从云端同步数据...">
    <template #header>
      <div class="card-header">
        <span>多语言文案协作工具</span>
        <el-button type="primary" :icon="Plus" @click="addLanguageDialogVisible = true"> 添加语言 </el-button>
      </div>
    </template>

    <!-- 语言标签 -->
    <div class="language-tags">
      <span>当前语言：</span>
      <el-tag
        v-for="lang in languages"
        :key="lang.code"
        closable
        :disable-transitions="false"
        @close="handleRemoveLanguage(lang.code)"
        style="margin-right: 8px">
        {{ lang.name }} ({{ lang.code }})
      </el-tag>
    </div>

    <!-- 文案录入表格 -->
    <el-table :data="entries" border style="width: 100%; margin-top: 20px" row-key="id">
      <el-table-column prop="key" label="Key (文案键)" width="250">
        <template #default="scope">
          <el-input v-model="scope.row.key" placeholder="例如：page.home.title" />
        </template>
      </el-table-column>

      <el-table-column v-for="lang in languages" :key="lang.code" :label="`${lang.name} (${lang.code})`">
        <template #default="scope">
          <el-input
            v-model="scope.row.translations[lang.code]"
            :placeholder="`请输入 ${lang.name} 文案`"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }" />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="100" align="center">
        <template #default="scope">
          <el-button type="danger" :icon="Delete" circle @click="handleRemoveEntry(scope.$index)" />
        </template>
      </el-table-column>
    </el-table>

    <el-button type="primary" @click="handleAddEntry" style="margin-top: 20px">
      <el-icon><Plus /></el-icon>
      添加新条目
    </el-button>
  </el-card>

  <!-- 功能区与预览 -->
  <el-card class="action-card">
    <template #header>
      <span>协作与预览</span>
    </template>
    <div class="action-buttons">
      <el-button type="warning" @click="updateJsonBin" :loading="isSaving" :icon="Upload"> 保存到云端 </el-button>
      <el-button type="primary" @click="handleManualLoad" :loading="isLoading" :icon="Refresh"> 从云端刷新 </el-button>
      <el-divider direction="vertical" />
      <el-button type="success" :icon="Download" @click="exportJson"> 导出 JSON 到本地 </el-button>
    </div>

    <h3>JSON 实时预览</h3>
    <pre class="json-preview"><code>{{ generatedJson }}</code></pre>
  </el-card>

  <!-- 添加语言对话框 -->
  <el-dialog v-model="addLanguageDialogVisible" title="添加新语言" width="30%">
    <el-form :model="newLanguage" label-width="120px">
      <el-form-item label="语言名称">
        <el-input v-model="newLanguage.name" placeholder="例如：英文" />
      </el-form-item>
      <el-form-item label="语言代码">
        <el-input v-model="newLanguage.code" placeholder="例如：en (必须唯一)" />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="addLanguageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddLanguage"> 确认 </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
  import { ref, reactive, computed, watch, onMounted } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Delete, Download, Upload, Refresh } from '@element-plus/icons-vue'

  // ===================================================================================
  // --- 1. 配置区：请在此处填入您的 JSONBin.io 信息 ---
  // ===================================================================================
  const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b'
  // 从您的 JSONBin.io 账户获取 (https://jsonbin.io/dashboard/api-keys)
  const jsonBinApiKey = '$2a$10$GNi5Pfm7XyT9xexD1zV6ceUHj5n3U4GX0tF0bck6qr7ZHumQXzDdO' // 示例 Key
  // 您用于存储此项目数据的 Bin ID
  const jsonBinId = '68cbb7f1d0ea881f4081e09d' // 示例 ID
  // ===================================================================================

  // --- 状态管理 ---
  const languages = ref([])
  const entries = ref([])
  const isLoading = ref(false)
  const isSaving = ref(false)
  const addLanguageDialogVisible = ref(false)
  const newLanguage = reactive({ name: '', code: '' })

  // --- 数据加载与初始化 ---
  const LOCAL_STORAGE_KEY = 'language-editor-data'

  onMounted(() => {
    initializeData()
  })

  async function initializeData() {
    isLoading.value = true
    // 1. 优先从云端加载
    const cloudSuccess = await loadFromJsonBin(true) // silent=true, 初始加载失败时不弹窗
    if (!cloudSuccess) {
      ElMessage.warning('从云端加载数据失败，尝试从本地缓存恢复。')
      // 2. 云端失败，则从本地加载
      const localSuccess = loadFromLocalStorage()
      if (!localSuccess) {
        // 3. 本地也失败，则使用默认数据
        setDefaultData()
      }
    }
    isLoading.value = false
  }

  // 自动将当前编辑内容保存到本地，防止意外关闭浏览器
  watch(
    [languages, entries],
    newData => {
      const dataToSave = { languages: newData[0], entries: newData[1] }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave))
    },
    { deep: true }
  )

  // --- 云端 (JSONBin.io) 操作 ---
  async function loadFromJsonBin(silent = false) {
    if (!jsonBinApiKey || !jsonBinId) {
      if (!silent) ElMessage.error('开发者未配置 API Key 或 Bin ID。')
      return false
    }
    try {
      const response = await fetch(`${JSONBIN_API_URL}/${jsonBinId}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': jsonBinApiKey }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || '加载失败')

      parseImportedData(data.record || data)
      if (!silent) ElMessage.success('从云端同步数据成功！')
      return true
    } catch (error) {
      if (!silent) ElMessage.error(`加载失败: ${error.message}`)
      return false
    }
  }

  async function updateJsonBin() {
    if (!jsonBinApiKey || !jsonBinId) {
      return ElMessage.error('开发者未配置 API Key 或 Bin ID。')
    }
    isSaving.value = true
    try {
      const response = await fetch(`${JSONBIN_API_URL}/${jsonBinId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': jsonBinApiKey
        },
        body: generatedJson.value
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || '更新失败')
      ElMessage.success('成功保存到云端！')
    } catch (error) {
      ElMessage.error(`更新失败: ${error.message}`)
    } finally {
      isSaving.value = false
    }
  }

  // 手动刷新按钮的逻辑
  function handleManualLoad() {
    ElMessageBox.confirm('这将从云端获取最新数据，并覆盖您当前未保存的更改。确定要刷新吗？', '警告', {
      type: 'warning'
    })
      .then(async () => {
        isLoading.value = true
        await loadFromJsonBin()
        isLoading.value = false
      })
      .catch(() => {})
  }

  // --- 数据处理与本地操作 ---
  function loadFromLocalStorage() {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!savedData) return false
    try {
      const parsedData = JSON.parse(savedData)
      languages.value = parsedData.languages || []
      entries.value = parsedData.entries || []
      return true
    } catch (e) {
      return false
    }
  }

  function setDefaultData() {
    languages.value = [
      { name: '中文', code: 'zh' },
      { name: 'English', code: 'en' }
    ]
    entries.value = [
      { id: 1, key: 'welcome.title', translations: { zh: '欢迎', en: 'Welcome' } },
      { id: 2, key: 'common.button.submit', translations: { zh: '提交', en: 'Submit' } }
    ]
  }

  function parseImportedData(data) {
    const langCodes = Object.keys(data)
    if (langCodes.length === 0) {
      setDefaultData()
      return
    }

    const existingLangs = new Map(languages.value.map(l => [l.code, l.name]))
    languages.value = langCodes.map(code => ({ name: existingLangs.get(code) || code, code }))

    const allKeys = new Set()
    langCodes.forEach(code => Object.keys(data[code]).forEach(key => allKeys.add(key)))
    let idCounter = 0 // 用于生成唯一ID
    const newEntries = Array.from(allKeys).map(key => {
      idCounter++
      const newEntry = { id: idCounter, key, translations: {} }
      langCodes.forEach(code => {
        newEntry.translations[code] = data[code]?.[key] || ''
      })
      return newEntry
    })
    entries.value = newEntries
  }

  // 【修复】: JSON 导出时忽略 id
  const generatedJsonObject = computed(() => {
    const result = {}
    languages.value.forEach(lang => {
      result[lang.code] = {}
    })
    entries.value.forEach(entry => {
      if (entry.key && entry.key.trim() !== '') {
        languages.value.forEach(lang => {
          result[lang.code][entry.key] = entry.translations[lang.code] || ''
        })
      }
    })
    return result
  })

  const generatedJson = computed(() => JSON.stringify(generatedJsonObject.value, null, 2))

  const exportJson = () => {
    if (entries.value.length === 0) return ElMessage.warning('没有可导出的内容！')
    const blob = new Blob([generatedJson.value], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'translations.json'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('JSON 文件导出成功！')
  }

  // --- 语言和条目管理 ---
  const handleAddLanguage = () => {
    if (!newLanguage.name || !newLanguage.code) {
      return ElMessage.error('语言名称和代码不能为空！')
    }
    if (languages.value.some(lang => lang.code === newLanguage.code)) {
      return ElMessage.error('语言代码已存在！')
    }
    languages.value.push({ ...newLanguage })
    entries.value.forEach(entry => {
      entry.translations[newLanguage.code] = ''
    })
    newLanguage.name = ''
    newLanguage.code = ''
    addLanguageDialogVisible.value = false
    ElMessage.success('语言添加成功！')
  }

  const handleRemoveLanguage = langCode => {
    if (languages.value.length <= 1) {
      return ElMessage.warning('至少需要保留一种语言！')
    }
    ElMessageBox.confirm(`确定移除 "${langCode}" 语言及其所有翻译吗？`, '警告', { type: 'warning' })
      .then(() => {
        languages.value = languages.value.filter(lang => lang.code !== langCode)
        entries.value.forEach(entry => delete entry.translations[langCode])
        ElMessage.success('语言移除成功！')
      })
      .catch(() => {})
  }

  const handleAddEntry = () => {
    const newEntry = { id: Date.now() + Math.random(), key: '', translations: {} }
    languages.value.forEach(lang => {
      newEntry.translations[lang.code] = ''
    })
    entries.value.push(newEntry)
  }

  const handleRemoveEntry = index => {
    entries.value.splice(index, 1)
  }
</script>

<style scoped>
  .language-editor-card,
  .action-card {
    margin-bottom: 20px;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .language-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .action-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  .json-preview {
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    border-radius: 4px;
    padding: 15px;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 400px;
    overflow-y: auto;
    font-family: 'Courier New', Courier, monospace;
  }
</style>
