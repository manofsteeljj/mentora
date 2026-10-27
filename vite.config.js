import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        // Polyfill Node.js built-ins (stream, buffer, crypto, etc.) for ExcelJS
        nodePolyfills({
            include: ['buffer', 'stream', 'crypto', 'path', 'process', 'util', 'events'],
            globals: { Buffer: true, global: true, process: true },
        }),
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react({ jsxRuntime: 'automatic' }),
    ],
});
