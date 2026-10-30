import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Erros do express.json(): o problema está no que o cliente mandou.
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "JSON_INVALIDO", message: "Corpo da requisição não é um JSON válido" } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "CORPO_GRANDE_DEMAIS", message: "Corpo da requisição grande demais" } });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({ error: { code: "VALIDACAO", message: "Dados inválidos", details: err.flatten() } });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  console.error("[500] erro não tratado:", err);
  return res.status(500).json({ error: { code: "ERRO_INTERNO", message: "Erro interno" } });
};
