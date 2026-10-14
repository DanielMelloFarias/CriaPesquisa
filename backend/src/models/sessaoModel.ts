import { prisma } from "../config/prisma.js";

/**
 * Consulta feita a cada requisição autenticada: só o que decide se o token
 * ainda vale (conta existe, está ativa, papel atual, senha provisória).
 * Fica separada de usuarioModel para ser leve e fácil de isolar nos testes.
 */
export const sessaoModel = {
  buscarPorId: (id: string) =>
    prisma.usuario.findUnique({
      where: { id },
      select: { id: true, papel: true, ativo: true, precisaTrocarSenha: true },
    }),
};
