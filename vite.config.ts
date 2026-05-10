// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

import { localStudioServerPlugin } from './server/localStudioServer';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    localStudioServerPlugin(),
  ],
});