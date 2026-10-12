import {defineConfig} from 'vite';
export default defineConfig({base:'./',server:{port:5173,host:'0.0.0.0'},build:{target:'es2022',chunkSizeWarningLimit:700,rollupOptions:{input:{game:'index.html',gestures:'gesture-test.html'}}}});
