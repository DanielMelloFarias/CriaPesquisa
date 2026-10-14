import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/usuarioModel.js");
vi.mock("../src/helper/auditoria.js");

import { createApp } from "../src/app.js";
import { usuarioModel } from "../src/models/usuarioModel.js";
import { registrarLog } from "../src/helper/auditoria.js";
import { tokenDe } from "./helpers/sessao.js";
import { hashSenha } from "../src/helper/senha.js";

const app = createApp();
// Conta com senha provisória: a troca tem de passar mesmo assim.
const token = tokenDe("u1", "COLETADOR", { precisaTrocarSenha: true });

const SENHA_ATUAL = "provisoria da secria 1";
const SENHA_NOVA = "gato azul no telhado 7";

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(usuarioModel.buscarPorId).mockResolvedValue({
    id: "u1",
    nome: "Coletador",
    email: "coletador@exemplo.local",
    papel: "COLETADOR",
    ativo: true,
    senhaHash: await hashSenha(SENHA_ATUAL),
    precisaTrocarSenha: true,
  } as never);
});

function trocar(corpo: Record<string, unknown>, comToken = true) {
  const req = request(app).put("/api/auth/senha");
  if (comToken) req.set("Authorization", `Bearer ${token}`);
  return req.send(corpo);
}

describe("PUT /api/auth/senha", () => {
  it("sem token -> 401", async () => {
    const res = await trocar({ senhaAtual: SENHA_ATUAL, senhaNova: SENHA_NOVA }, false);

    expect(res.status).toBe(401);
    expect(usuarioModel.atualizarSenha).not.toHaveBeenCalled();
  });

  it("senha atual errada -> 400 e nada é alterado", async () => {
    const res = await trocar({ senhaAtual: "chute errado aqui", senhaNova: SENHA_NOVA });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SENHA_ATUAL_INCORRETA");
    expect(usuarioModel.atualizarSenha).not.toHaveBeenCalled();
  });

  it("senha nova fraca -> 422 e nada é alterado", async () => {
    const res = await trocar({ senhaAtual: SENHA_ATUAL, senhaNova: "cria123" });

    expect(res.status).toBe(422);
    expect(usuarioModel.atualizarSenha).not.toHaveBeenCalled();
  });

  it("senha nova igual à atual -> 422", async () => {
    const res = await trocar({ senhaAtual: SENHA_ATUAL, senhaNova: SENHA_ATUAL });

    expect(res.status).toBe(422);
    expect(usuarioModel.atualizarSenha).not.toHaveBeenCalled();
  });

  it("troca válida -> 204, grava hash novo e limpa a pendência", async () => {
    const res = await trocar({ senhaAtual: SENHA_ATUAL, senhaNova: SENHA_NOVA });

    expect(res.status).toBe(204);
    expect(usuarioModel.atualizarSenha).toHaveBeenCalledOnce();

    const [id, hash] = vi.mocked(usuarioModel.atualizarSenha).mock.calls[0];
    expect(id).toBe("u1");
    expect(hash).not.toBe(SENHA_NOVA); // guardado com hash, nunca em texto
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("registra a troca na auditoria sem escrever a senha em lugar nenhum", async () => {
    await trocar({ senhaAtual: SENHA_ATUAL, senhaNova: SENHA_NOVA });

    expect(registrarLog).toHaveBeenCalledOnce();
    const registro = JSON.stringify(vi.mocked(registrarLog).mock.calls[0][0]);
    expect(registro).not.toContain(SENHA_NOVA);
    expect(registro).not.toContain(SENHA_ATUAL);
    expect(registro).not.toContain("$2");
  });
});
