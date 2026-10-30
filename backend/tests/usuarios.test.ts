import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/usuarioModel.js");
vi.mock("../src/helper/auditoria.js");
vi.mock("../src/helper/senha.js");

import { createApp } from "../src/app.js";
import { tokenDe } from "./helpers/sessao.js";
import { usuarioModel } from "../src/models/usuarioModel.js";
import { hashSenha } from "../src/helper/senha.js";
import { registrarLog } from "../src/helper/auditoria.js";

const app = createApp();
const tokenAdmin = tokenDe("a1", "ADMIN");
const tokenGestor = tokenDe("g1", "GESTOR");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usuarios", () => {
  it("ADMIN cria usuário válido -> 201", async () => {
    vi.mocked(usuarioModel.buscarPorEmail).mockResolvedValue(null as never);
    vi.mocked(hashSenha).mockResolvedValue("hash" as never);
    vi.mocked(usuarioModel.criar).mockResolvedValue({ id: "u1", nome: "X", email: "x@cria.al", papel: "COLETADOR", ativo: true } as never);
    vi.mocked(registrarLog).mockResolvedValue(undefined as never);

    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ nome: "X", email: "x@cria.al", senha: "colina verde 42", papel: "COLETADOR" });

    expect(res.status).toBe(201);
    expect(usuarioModel.criar).toHaveBeenCalledOnce();
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("não-admin (GESTOR) -> 403", async () => {
    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ nome: "X", email: "x@cria.al", senha: "colina verde 42", papel: "COLETADOR" });
    expect(res.status).toBe(403);
  });

  it("sem token -> 401", async () => {
    const res = await request(app).get("/api/usuarios");
    expect(res.status).toBe(401);
  });

  it("body inválido (senha curta) -> 422", async () => {
    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ nome: "X", email: "x@cria.al", senha: "123", papel: "COLETADOR" });
    expect(res.status).toBe(422);
  });

  it("e-mail duplicado -> 409", async () => {
    vi.mocked(usuarioModel.buscarPorEmail).mockResolvedValue({ id: "e" } as never);
    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ nome: "X", email: "x@cria.al", senha: "colina verde 42", papel: "COLETADOR" });
    expect(res.status).toBe(409);
  });
});

// O DELETE já impedia o admin de se desativar; o PUT deixava o mesmo efeito por
// outro caminho (e também rebaixar o próprio papel), o que pode deixar o sistema
// sem nenhum ADMIN.
describe("PUT /api/usuarios/:id no próprio usuário", () => {
  beforeEach(() => {
    vi.mocked(usuarioModel.buscarPublicoPorId).mockResolvedValue({ id: "a1", papel: "ADMIN", ativo: true } as never);
    vi.mocked(usuarioModel.atualizar).mockResolvedValue({ id: "a1" } as never);
  });

  it("ADMIN não se desativa -> 403", async () => {
    const res = await request(app).put("/api/usuarios/a1").set("Authorization", `Bearer ${tokenAdmin}`).send({ ativo: false });
    expect(res.status).toBe(403);
    expect(usuarioModel.atualizar).not.toHaveBeenCalled();
  });

  it("ADMIN não rebaixa o próprio papel -> 403", async () => {
    const res = await request(app).put("/api/usuarios/a1").set("Authorization", `Bearer ${tokenAdmin}`).send({ papel: "GESTOR" });
    expect(res.status).toBe(403);
    expect(usuarioModel.atualizar).not.toHaveBeenCalled();
  });

  it("ADMIN edita o próprio nome -> 200", async () => {
    const res = await request(app).put("/api/usuarios/a1").set("Authorization", `Bearer ${tokenAdmin}`).send({ nome: "Novo Nome", ativo: true, papel: "ADMIN" });
    expect(res.status).toBe(200);
    expect(usuarioModel.atualizar).toHaveBeenCalledOnce();
  });

  it("ADMIN desativa outro usuário -> 200", async () => {
    vi.mocked(usuarioModel.buscarPublicoPorId).mockResolvedValue({ id: "u5", papel: "COLETADOR", ativo: true } as never);
    const res = await request(app).put("/api/usuarios/u5").set("Authorization", `Bearer ${tokenAdmin}`).send({ ativo: false });
    expect(res.status).toBe(200);
  });
});
