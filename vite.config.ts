import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import Unocss from 'unocss/vite'
import { presetUno } from 'unocss'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'
import Inspect from 'vite-plugin-inspect'
import Mkcert from 'vite-plugin-mkcert'
import { getPackageInfo } from 'local-pkg'
import pkg from './package.json'

const pathSrc = path.resolve(__dirname, 'src')

export default defineConfig(async ({ mode }) => {
  // 根据当前工作目录中的 `mode` 加载 .env 文件
  const env = loadEnv(mode, process.cwd())

  const repl = await getPackageInfo('@vue/repl')
  return {
    base: env.VITE_BASE_URL || '/',

    resolve: {
      alias: {
        '@': pathSrc,
      },
    },
    define: {
      'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
      'import.meta.env.REPL_VERSION': JSON.stringify(repl!.version),
    },
    server: {
      https: true,
      host: true,
    },
    plugins: [
      vue({
        reactivityTransform: true,
      }),
      AutoImport({
        imports: ['vue', '@vueuse/core'],
        resolvers: [ElementPlusResolver()],
        dts: path.resolve(pathSrc, 'auto-imports.d.ts'),
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: path.resolve(pathSrc, 'components.d.ts'),
      }),
      Unocss({
        presets: [presetUno()],
      }),
      Mkcert(),
      Inspect(),
    ],
  }
})
