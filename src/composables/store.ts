import { File, type Store, type StoreState, compileFile } from '@vue/repl'
import { atou, utoa } from '@/utils/encode'
import { genImportMap, genUnpkgLink, genVueLink } from '@/utils/dependency'
import { type ImportMap, mergeImportMap } from '@/utils/import-map'
import { IS_DEV } from '@/constants'
import mainCode from '../template/main.vue?raw'
import welcomeCode from '../template/welcome.vue?raw'
import elementPlusCode from '../template/element-plus.js?raw'
import piniaCode from '../template/pinia.js?raw'

export interface Initial {
  serializedState?: string
  versions?: Versions
  userOptions?: UserOptions
}
export type VersionKey = 'vue' | 'elementPlus'
export type Versions = Record<VersionKey, string>
export interface UserOptions {
  styleSource?: string
  showHidden?: boolean
  showOutput?: boolean
  showCompileOutput?: boolean
  layout?: string
}
export type SerializeState = Record<string, string> & {
  _o?: UserOptions
}

const MAIN_FILE = 'PlaygroundMain.vue'
const APP_FILE = 'App.vue'
const ELEMENT_PLUS_FILE = 'element-plus.js'
const PINIA_FILE = 'pinia.js'
const IMPORT_MAP = 'import-map.json'
export const USER_IMPORT_MAP = 'user-imports.json'

export const useStore = (initial: Initial) => {
  console.log('initial:', initial)
  const versions = reactive(
    initial.versions || { vue: 'latest', elementPlus: 'latest' }
  )

  let compiler = $(shallowRef<typeof import('vue/compiler-sfc')>())
  const [nightly, toggleNightly] = $(useToggle(false))
  let userOptions = $ref<UserOptions>(initial.userOptions || {})
  const hideFile = $computed(() => !IS_DEV && !userOptions.showHidden)
  console.log(userOptions.showHidden, hideFile)

  const files = initFiles(initial.serializedState || '')
  const state = reactive({
    mainFile: MAIN_FILE,
    files,
    activeFile: files[APP_FILE],
    errors: [],
    vueRuntimeURL: '',
  })

  const bultinImportMap = $computed<ImportMap>(() =>
    genImportMap(versions, nightly)
  )
  const userImportMap = $computed<ImportMap>(() => {
    const code = state.files[USER_IMPORT_MAP]?.code.trim()
    if (!code) return {}
    let map: ImportMap = {}
    try {
      map = JSON.parse(code)
    } catch (err) {
      console.error(err)
    }
    return map
  })
  const importMap = $computed<ImportMap>(() =>
    mergeImportMap(bultinImportMap, userImportMap)
  )

  // eslint-disable-next-line no-console
  console.log('Files:', files, 'Options:', userOptions)

  const store: Store = reactive({
    state,
    compiler: $$(compiler),
    setActive,
    addFile,
    deleteFile,
    getImportMap,
    initialShowOutput: userOptions.showOutput || false,
    initialOutputMode: 'preview',
  })

  watch(
    $$(importMap),
    (content) => {
      state.files[IMPORT_MAP] = new File(
        IMPORT_MAP,
        JSON.stringify(content, undefined, 2),
        hideFile
      )
    },
    { immediate: true, deep: true }
  )
  watch(
    () => versions.elementPlus,
    (version) => {
      const file = new File(
        ELEMENT_PLUS_FILE,
        generateElementPlusCode(version, userOptions.styleSource).trim(),
        hideFile
      )
      state.files[ELEMENT_PLUS_FILE] = file
      compileFile(store, file)
    },
    { immediate: true }
  )

  function generateElementPlusCode(version: string, styleSource?: string) {
    const style = styleSource
      ? styleSource.replace('#VERSION#', version)
      : genUnpkgLink(
        nightly ? '@element-plus/nightly' : 'element-plus',
        version,
        '/dist/index.css'
      )
    return elementPlusCode.replace('#EP_STYLE#', style)
  }

  async function setVueVersion(version: string) {
    const { compilerSfc, runtimeDom } = genVueLink(version)

    compiler = await import(/* @vite-ignore */ compilerSfc)
    state.vueRuntimeURL = runtimeDom
    versions.vue = version

    // eslint-disable-next-line no-console
    console.info(`[@vue/repl] Now using Vue version: ${version}`)
  }

  async function init() {
    await setVueVersion(versions.vue)

    for (const file of Object.values(state.files)) {
      compileFile(store, file)
    }

    watchEffect(() => compileFile(store, state.activeFile))
  }

  function getFiles(download: boolean = false) {
    const exported: Record<string, string> = {}
    for (const file of Object.values(state.files)) {
      if (!download && file.hidden) continue
      exported[file.filename] = file.code
    }
    return exported
  }

  function serialize() {
    const state: SerializeState = { ...getFiles() }
    state._o = userOptions
    return utoa(JSON.stringify(state))
  }
  function deserialize(text: string): SerializeState {
    const state = JSON.parse(atou(text))
    return state
  }

  function initFiles(serializedState: string) {
    const files: StoreState['files'] = {}
    if (serializedState) {
      const saved = deserialize(serializedState)
      for (const [filename, file] of Object.entries(saved)) {
        if (filename === '_o') continue
        files[filename] = new File(filename, file as string)
      }
      // 没有使用传入的userOptions
      // userOptions = saved._o || {}
      userOptions = Object.assign(userOptions, saved._o || {})
    } else {
      files[APP_FILE] = new File(APP_FILE, welcomeCode)
    }
    files[MAIN_FILE] = new File(MAIN_FILE, mainCode, hideFile)
    if (!files[USER_IMPORT_MAP]) {
      files[USER_IMPORT_MAP] = new File(
        USER_IMPORT_MAP,
        JSON.stringify({ imports: {} }, undefined, 2)
      )
    }
    files[PINIA_FILE] = new File(PINIA_FILE, piniaCode, hideFile)
    return files
  }

  function setActive(filename: string) {
    const file = state.files[filename]
    if (file.hidden) return
    state.activeFile = state.files[filename]
  }

  function addFile(fileOrFilename: string | File) {
    const file =
      typeof fileOrFilename === 'string'
        ? new File(fileOrFilename)
        : fileOrFilename
    state.files[file.filename] = file
    setActive(file.filename)
  }

  function deleteFile(filename: string) {
    if (filename === ELEMENT_PLUS_FILE) {
      alert(
        'You cannot remove it, because Element Plus requires it.'
      )
      return
    }
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
      if (state.activeFile.filename === filename) {
        setActive(APP_FILE)
      }
      delete state.files[filename]
    }
  }

  function getImportMap() {
    return importMap
  }

  async function setVersion(key: VersionKey, version: string) {
    switch (key) {
      case 'elementPlus':
        setElementPlusVersion(version)
        break
      case 'vue':
        await setVueVersion(version)
        break
    }
  }

  function setElementPlusVersion(version: string) {
    versions.elementPlus = version
  }

  // console.log('showOutput:', userOptions.showOutput)

  return {
    ...store,
    showOutput: userOptions.showOutput || false,

    versions,
    nightly: $$(nightly),
    userOptions: $$(userOptions),

    init,
    serialize,
    setVersion,
    toggleNightly,
    getFiles,
  }
}

export type ReplStore = ReturnType<typeof useStore>
