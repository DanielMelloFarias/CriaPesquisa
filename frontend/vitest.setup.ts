import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";
// Mock de canvas 2D para o jsdom (Chart.js precisa de getContext no ambiente de teste).
import "vitest-canvas-mock";

// As páginas são carregadas sob demanda (React.lazy). Com a máquina ocupada (CI,
// suítes em paralelo), o import do chunk passa do 1 s padrão dos findBy* e os
// testes de App falhavam de vez em quando. 5 s cobre isso sem esconder travamento.
configure({ asyncUtilTimeout: 5000 });

// Node 22+ expõe um getter global `localStorage` (Web Storage API experimental)
// que retorna `undefined` sem a flag `--localstorage-file`. Como essa propriedade
// já existe em `global`, o Vitest não a substitui pela implementação funcional do
// jsdom (ver populateGlobal/getWindowKeys em vitest/dist), quebrando qualquer
// código que use `localStorage` durante os testes. A propriedade é `configurable`,
// então aqui a trocamos por um polyfill simples em memória só para os testes.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const memoryStorage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as unknown as Storage;

  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
