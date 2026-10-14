import type { RequestHandler } from "express";
import { verificarToken } from "../helper/token.js";
import { sessaoModel } from "../models/sessaoModel.js";
import { HttpError } from "./errorHandler.js";

/**
 * O token só prova quem a pessoa era quando entrou. A cada requisição o
 * usuário é relido do banco, para que:
 * - conta desativada ou apagada perca o acesso na hora, sem esperar o token
 *   expirar (servidor desligado não pode seguir mexendo nos dados);
 * - mudança de papel valha já na próxima requisição (o papel vem do banco,
 *   não do token);
 * - conta com senha provisória não faça nada além de trocá-la (ver README,
 *   "Primeiro acesso").
 */
function criarAutenticacao({ permiteSenhaProvisoria }: { permiteSenhaProvisoria: boolean }): RequestHandler {
  // async: o express-async-errors (importado em app.ts) leva a rejeição ao errorHandler.
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new HttpError(401, "NAO_AUTENTICADO", "Token ausente");

    let sub: string;
    try {
      sub = verificarToken(header.slice(7)).sub;
    } catch {
      throw new HttpError(401, "TOKEN_INVALIDO", "Token inválido ou expirado");
    }

    const usuario = await sessaoModel.buscarPorId(sub);
    if (!usuario || !usuario.ativo) {
      throw new HttpError(401, "NAO_AUTENTICADO", "Usuário inativo ou removido");
    }
    if (usuario.precisaTrocarSenha && !permiteSenhaProvisoria) {
      throw new HttpError(
        403,
        "SENHA_PROVISORIA",
        "Sua senha é provisória. Troque a senha antes de usar o sistema.",
      );
    }

    req.usuario = { id: usuario.id, papel: usuario.papel };
    next();
  };
}

/** Padrão para toda rota protegida: bloqueia quem ainda está com senha provisória. */
export const autenticar = criarAutenticacao({ permiteSenhaProvisoria: false });

/**
 * Exceção explícita, usada só em GET /auth/me e PUT /auth/senha — o mínimo
 * para a tela de troca funcionar. Rota nova que esquecer de escolher fica
 * com `autenticar`, que bloqueia.
 */
export const autenticarPermitindoSenhaProvisoria = criarAutenticacao({ permiteSenhaProvisoria: true });
