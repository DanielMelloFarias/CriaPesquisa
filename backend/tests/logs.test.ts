import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/logModel.js");

import { createApp } from "../src/app.js";
import { tokenDe } from "./helpers/sessao.js";
import { logModel } from "../src/models/logModel.js";

const app = createApp();
const tokenAdmin = tokenDe("a1", "ADMIN");
const tokenGestor = tokenDe("g1", "GESTOR");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logs", () => {
  it("ADMIN lista auditoria -> 200", async () => {
    vi.mocked(logModel.listar).mockResolvedValue({ total: 0, itens: [] } as never);
    const res = await request(app).get("/api/logs").set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, itens: [] });
  });

  it("GESTOR (sem permissão) -> 403", async () => {
    const res = await request(app).get("/api/logs").set("Authorization", `Bearer ${tokenGestor}`);
    expect(res.status).toBe(403);
  });

  it("sem token -> 401", async () => {
    const res = await request(app).get("/api/logs");
    expect(res.status).toBe(401);
  });
});
