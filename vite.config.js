import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    https: true,
    host: true
  },
  base: '/lr2-ar/'
})