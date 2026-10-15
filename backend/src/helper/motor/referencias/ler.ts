import { readFileSync } from "node:fs";

/** Lê um JSON de backend/referencias/ (mesma profundidade em src/ e em dist/). */
export function lerReferencia<T>(arquivo: string): T {
  return JSON.parse(readFileSync(new URL(`../../../../referencias/${arquivo}`, import.meta.url), "utf8")) as T;
}
