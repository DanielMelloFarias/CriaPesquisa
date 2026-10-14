import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { gerarToken } from "../src/helper/token.js";
import { hashSenha } from "../src/helper/senha.js";

/**
 * O token assinado não basta: `autenticar` relê o usuário no banco a cada
 * requisição. Contra o banco real (porta 5433), sem mock de model.
 * Tudo que é criado aqui é apagado no afterAll.
 */

const app = createApp();
const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SENHA_PROVISORIA = "provisoria da secria 1";
const SENHA_NOVA = "gato azul no telhado 7";

const criados: string[] = [];

async function criarUsuario(nome: string, dados: { papel: "ADMIN" | "GESTOR" | "COLETADOR" | "VISUALIZADOR"; precisaTrocarSenha?: boolean; senha?: string }) {
  const u = await prisma.usuario.create({
    data: {
      nome,
      email: `auth-estado-${nome}-${sufixo}@cria.al`,
      senhaHash: await hashSenha(dados.senha ?? "x"),
      papel: dados.papel,
      precisaTrocarSenha: dados.precisaTrocarSenha ?? false,
    },
  });
  criados.push(u.id);
  return { id: u.id, token: `Bearer ${gerarToken({ sub: u.id, papel: dados.papel })}` };
}

afterAll(async () => {
  await prisma.logAlteracao.deleteMany({ where: { usuarioId: { in: criados } } });
  await prisma.usuario.deleteMany({ where: { id: { in: criados } } });
  await prisma.$disconnect();
}, 30000);

describe("autenticar relê o usuário no banco", () => {
  it("usuário ativo passa (controle)", async () => {
    const { token } = await criarUsuario("ativo", { papel: "COLETADOR" });
    const res = await request(app).get("/api/pesquisas").set("Authorization", token);
    expect(res.status).toBe(200);
  });

  it("usuário desativado depois do login -> 401, mesmo com token válido", async () => {
    const { id, token } = await criarUsuario("inativo", { papel: "GESTOR" });
    await prisma.usuario.update({ where: { id }, data: { ativo: false } });

    const res = await request(app).get("/api/pesquisas").set("Authorization", token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NAO_AUTENTICADO");
  });

  it("usuário apagado do banco -> 401, mesmo com token válido", async () => {
    const { id, token } = await criarUsuario("apagado", { papel: "GESTOR" });
    await prisma.usuario.delete({ where: { id } });

    const res = await request(app).get("/api/pesquisas").set("Authorization", token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NAO_AUTENTICADO");
  });
});

describe("senha provisória", () => {
  it("bloqueia rota comum com 403, libera /auth/me e /auth/senha, e após a troca o mesmo token passa", async () => {
    const { token } = await criarUsuario("provisoria", {
      papel: "GESTOR",
      precisaTrocarSenha: true,
      senha: SENHA_PROVISORIA,
    });

    const bloqueada = await request(app).get("/api/pesquisas").set("Authorization", token);
    expect(bloqueada.status).toBe(403);
    expect(bloqueada.body.error.code).toBe("SENHA_PROVISORIA");
    expect(bloqueada.body.error.message).toMatch(/provis/i);

    const me = await request(app).get("/api/auth/me").set("Authorization", token);
    expect(me.status).toBe(200);
    expect(me.body.usuario.precisaTrocarSenha).toBe(true);

    const troca = await request(app)
      .put("/api/auth/senha")
      .set("Authorization", token)
      .send({ senhaAtual: SENHA_PROVISORIA, senhaNova: SENHA_NOVA });
    expect(troca.status).toBe(204);

    // O frontend mantém o mesmo token depois da troca.
    const depois = await request(app).get("/api/pesquisas").set("Authorization", token);
    expect(depois.status).toBe(200);
  });
});

describe("papel vem do banco, não do token", () => {
  it("promovido a ADMIN no banco: token emitido como VISUALIZADOR já acessa rota de ADMIN", async () => {
    const { id, token } = await criarUsuario("promovido", { papel: "VISUALIZADOR" });
    expect((await request(app).get("/api/logs").set("Authorization", token)).status).toBe(403);

    await prisma.usuario.update({ where: { id }, data: { papel: "ADMIN" } });
    expect((await request(app).get("/api/logs").set("Authorization", token)).status).toBe(200);
  });

  it("rebaixado no banco: token emitido como ADMIN perde a rota de ADMIN na hora", async () => {
    const { id, token } = await criarUsuario("rebaixado", { papel: "ADMIN" });
    expect((await request(app).get("/api/logs").set("Authorization", token)).status).toBe(200);

    await prisma.usuario.update({ where: { id }, data: { papel: "VISUALIZADOR" } });
    const res = await request(app).get("/api/logs").set("Authorization", token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SEM_PERMISSAO");
  });
});
