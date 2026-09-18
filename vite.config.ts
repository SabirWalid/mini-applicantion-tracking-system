import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', '')
	return {
		define: {
			'import.meta.env.MINI_ATS_SUPABASE_URL': JSON.stringify(env['MINI-ATS_SUPABASE_URL']),
			'import.meta.env.MINI_ATS_SUPABASE_ANON_KEY': JSON.stringify(env['MINI-ATS_SUPABASE_ANON_KEY']),
		},
		plugins: [react()],
	}
})
