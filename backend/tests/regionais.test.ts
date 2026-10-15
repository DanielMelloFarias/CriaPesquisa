import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);

import { createApp } from "../src/app.js";
import { tokenDe } from "./helpers/sessao.js";
import { listarRegionais } from "../src/helper/regionais.js";

const app = createApp();

describe("GET /api/regionais", () => {
  it("autenticado recebe as 10 regionais na ordem", async () => {
    const res = await request(app).get("/api/regionais").set("Authorization", `Bearer ${tokenDe("u1", "COLETADOR")}`);
    expect(res.status).toBe(200);
    expect(res.body.regionais).toHaveLength(10);
    expect(res.body.regionais[0]).toBe("1ª Regional – Maceió");
    expect(res.body.regionais[9]).toBe("10ª Regional – Piranhas");
  });

  it("sem token devolve 401", async () => {
    const res = await request(app).get("/api/regionais");
    expect(res.status).toBe(401);
  });

  it("listarRegionais devolve cópia das chaves", () => {
    expect(listarRegionais()).toHaveLength(10);
  });
});
