import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Não observar public/: evita crash EBUSY do watcher com arquivos travados
  // pelo OneDrive (a pasta public é servida estaticamente, não precisa de HMR).
  server: { port: 5173, watch: { ignored: ["**/public/**"] } },
  build: {
    rollupOptions: {
      output: {
        // Separa as bibliotecas do código da aplicação: elas mudam pouco, então
        // o navegador reaproveita o cache entre deploys em vez de rebaixar tudo.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          grafico: ["chart.js", "react-chartjs-2"],
          dados: ["@tanstack/react-query", "axios"],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Os testes de App fazem `await import("./App.js")`, que transforma o app
    // inteiro; com a máquina ocupada isso passa dos 5 s padrão.
    testTimeout: 20000,
  },
});
