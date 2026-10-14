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
