
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Загружаем переменные из .env файлов
  // Fix: cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error in TypeScript
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || process.env.API_KEY),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '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')
    }
  }
})
