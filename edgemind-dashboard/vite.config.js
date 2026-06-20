import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── EdgeMind Vite config ──────────────────────────────────────────────────────
// Backend runs on Azure VM 172.188.241.209.
// socat systemd services on the VM forward each host port → k8s NodePort:
//   VM:8090 → edgemind-server (NodePort 30080)
//   VM:8081 → sensor-sim-1   (NodePort 30081)
//   VM:8082 → sensor-sim-2   (NodePort 30082)
//   VM:8083 → sensor-sim-3   (NodePort 30083)
//   VM:8006 → alert-manager  (NodePort 30006)
//
// To switch back to local kubectl port-forward, change BACKEND_HOST to 'localhost'. 172.188.241.209

const BACKEND_HOST = 'localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://${BACKEND_HOST}:8090`,
      '/ws': {
        target: `ws://${BACKEND_HOST}:8090`,
        ws: true,
      },
      '/sensor1': {
        target: `http://${BACKEND_HOST}:8081`,
        rewrite: path => path.replace(/^\/sensor1/, ''),
      },
      '/sensor2': {
        target: `http://${BACKEND_HOST}:8082`,
        rewrite: path => path.replace(/^\/sensor2/, ''),
      },
      '/sensor3': {
        target: `http://${BACKEND_HOST}:8083`,
        rewrite: path => path.replace(/^\/sensor3/, ''),
      },
      '/alertmanager': {
        target: `http://${BACKEND_HOST}:8006`,
        rewrite: path => path.replace(/^\/alertmanager/, ''),
      },
    },
  },
})
