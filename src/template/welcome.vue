<script setup lang="ts">
import { ref, version as vueVersion } from 'vue'

const msg = ref('Hello World!')
</script>

<template>
  <h1>{{ msg }}</h1>
  <input v-model="msg" />

  <p>You can also use Element Plus here.</p>
  <el-input v-model="msg" />
</template>
