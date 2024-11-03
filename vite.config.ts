import { resolve, dirname } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

const __dirname = dirname(".");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: resolve(__dirname, "tsconfig.lib.json")
    })
  ],
  publicDir: 'public',

  build: {
    lib: {
      entry: resolve(__dirname, 'lib/main.tsx'),
      formats: ['es']
    },

    copyPublicDir: false,

    rollupOptions: {
      external: [
        'react', 'react-dom', '@ptolemy2002/js-utils',
        '@ptolemy2002/list-object-utils', '@ptolemy2002/react-hook-result',
        '@ptolemy2002/react-proxy-context', '@ptolemy2002/react-utils',
        '@ptolemy2002/ts-utils', '@ptolemy2002/regex-utils',
        'is-callable', 'zod'
      ],
      output: {
        entryFileNames: '[name].js'
      }
    }
  },

  resolve: {
    alias: {
      "src": resolve(__dirname, 'src'),
      "lib": resolve(__dirname, 'lib')
    }
  }
});
