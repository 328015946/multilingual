/*
 * @Author: xiaobin
 * @Date: 2025-09-18 15:23:29
 * @LastEditors: xiaobin
 * @LastEditTime: 2025-09-18 15:31:39
 * @FilePath: \multilingual\src\main.js
 * @Description: 注释
 */
import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)

app.use(ElementPlus)
app.mount('#app')
