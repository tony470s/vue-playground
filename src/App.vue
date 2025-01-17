<script setup lang="ts">
import { Repl } from '@vue/repl'
import Header from '@/components/Header.vue'
import {
  USER_IMPORT_MAP,
  type UserOptions,
  type VersionKey,
  useStore,
} from '@/composables/store'
import type { BuiltInParserName } from 'prettier'
import type { SFCOptions } from '@vue/repl'
import type { Fn } from '@vueuse/core'
import type { ImportMap } from '@/utils/import-map'
import { IS_DEV } from './constants'

let loading = $ref(true)

// enable experimental features
const sfcOptions: SFCOptions = {
  script: {
    reactivityTransform: true,
  },
}

const initialUserOptions: UserOptions = {}

const debug = new URLSearchParams(location.search).get('debug')
if (debug) {
  initialUserOptions.showHidden = true
}

const showOutput = new URLSearchParams(location.search).get('showOutput')
if (showOutput) {
  initialUserOptions.showOutput = true
}

const showCompileOutput = new URLSearchParams(location.search).get('showCompileOutput')
if (showCompileOutput) {
  initialUserOptions.showCompileOutput = true
}

const layout = new URLSearchParams(location.search).get('layout')
if (layout?.toLowerCase() === 'vertical') {
  initialUserOptions.layout = 'vertical'
} else {
  // initialUserOptions.layout = 'vertical'
  initialUserOptions.layout = 'horizontal'
}

const store = useStore({
  serializedState: location.hash.slice(1),
  userOptions: initialUserOptions,
})

if (debug) {
  const map: ImportMap = {
    imports: {
    },
  }
  store.state.files[USER_IMPORT_MAP].code = JSON.stringify(map, undefined, 2)
  // const url = `${location.origin}${location.pathname}${location.search}#${store.serialize()}`
  // history.replaceState({}, '', url)
}

store.init().then(() => (loading = false))

// eslint-disable-next-line no-console
console.log('Store:', store)

const handleKeydown = (evt: KeyboardEvent) => {
  if ((evt.ctrlKey || evt.metaKey) && evt.code === 'KeyS') {
    evt.preventDefault()
    return
  }

  if ((evt.altKey || evt.ctrlKey) && evt.shiftKey && evt.code === 'KeyF') {
    evt.preventDefault()
    formatCode()
    return
  }
}

const handleBeforeDepsChange = (key: VersionKey, version: string): void => {
  loading = true
}

const handleDepsChanged = (key: VersionKey, version: string): void => {
  loading = false
}

let loadedFormat = false
const formatCode = async () => {
  let close: Fn | undefined
  if (!loadedFormat) {
    // ...
  }

  const [format, parserHtml, parserTypeScript, parserBabel, parserPostcss] =
    await Promise.all([
      import('prettier/standalone').then((r) => r.format),
      import('prettier/parser-html').then((m) => m.default),
      import('prettier/parser-typescript').then((m) => m.default),
      import('prettier/parser-babel').then((m) => m.default),
      import('prettier/parser-postcss').then((m) => m.default),
    ])
  loadedFormat = true
  close?.()

  const file = store.state.activeFile
  let parser: BuiltInParserName
  if (file.filename.endsWith('.vue')) {
    parser = 'vue'
  } else if (file.filename.endsWith('.js')) {
    parser = 'babel'
  } else if (file.filename.endsWith('.ts')) {
    parser = 'typescript'
  } else if (file.filename.endsWith('.json')) {
    parser = 'json'
  } else {
    return
  }
  file.code = format(file.code, {
    parser,
    plugins: [parserHtml, parserTypeScript, parserBabel, parserPostcss],
    semi: false,
    singleQuote: true,
  })
}

// useDark()

// persist state
watchEffect(() => history.replaceState({}, '', `#${store.serialize()}`))
</script>

<template>
  <div class="antialiased">
    <Header :store="store" @before-deps-change="handleBeforeDepsChange" @deps-changed="handleDepsChanged" />
    <Repl
      ref="repl"
      :store="store"
      :layout="store.userOptions.value.layout"
      :show-compile-output="store.userOptions.value.showCompileOutput || true"
      auto-resize
      :sfc-options="sfcOptions"
      :clear-console="false"
      :show-import-map="store.userOptions.value.showHidden || IS_DEV"
      @keydown="handleKeydown"
    />
  </div>
  <div v-if="loading" class="loading-wrapper">
    <div class="loading">Loading...</div>
  </div>
</template>

<style>
body {
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  margin: 0;
  --base: #444;
  --nav-height: 50px;
}

.vue-repl {
  height: calc(100vh - var(--nav-height));
}

.dark .vue-repl,
.vue-repl {
  --color-branding: #409eff !important;
}

button {
  border: none;
  outline: none;
  cursor: pointer;
  margin: 0;
  background-color: transparent;
}

.loading-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1100;
  background-color: white;
  opacity: 0.7;
}
.loading-wrapper .loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  font-weight: bold;
  color: #444;
}
</style>
