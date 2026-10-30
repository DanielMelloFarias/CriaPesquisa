import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

// Erro do cliente não é erro do servidor: sem isto os dois casos caíam no 500 genérico.
describe("corpo da requisição inválido", () => {
  it("JSON malformado -> 400 JSON_INVALIDO", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("JSON_INVALIDO");
  });

  it("corpo acima do limite -> 413 CORPO_GRANDE_DEMAIS", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a".repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("CORPO_GRANDE_DEMAIS");
  });
});
