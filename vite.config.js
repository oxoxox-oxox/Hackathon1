import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [
        basicSsl({
            name: 'vr-vocabulary',
            domains: ['localhost', '0.0.0.0']
        })
    ],
    server: {
        host: '0.0.0.0', // Allow LAN access
        port: 5173,
        strictPort: false,
        open: false,
        https: true, // Enable HTTPS for WebXR
        cors: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            },
            '/models': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            }
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true
    },
    optimizeDeps: {
        include: ['three']
    }
});