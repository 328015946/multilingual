<!--
 * @Author: xiaobin
 * @Date: 2025-09-18 15:23:29
 * @LastEditors: xiaobin
 * @LastEditTime: 2025-09-18 15:32:33
 * @FilePath: \multilingual\src\App.vue
 * @Description: 注释
-->
<template>
  <div id="app-container">
    <LanguageEditor />
  </div>
</template>

<script setup>
  import LanguageEditor from './components/LanguageEditor.vue'
</script>

<style>
  #app-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
</style>
