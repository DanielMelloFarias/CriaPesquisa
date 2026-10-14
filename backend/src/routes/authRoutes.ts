import { Router } from "express";
import { login, me, trocarSenha } from "../controllers/authController.js";
import { autenticarPermitindoSenhaProvisoria } from "../middleware/auth.js";
import { validar } from "../middleware/validate.js";
import { limiteLogin } from "../middleware/rateLimit.js";
import { loginSchema, trocarSenhaSchema } from "../helper/validators.js";

export const authRoutes = Router();
authRoutes.post("/auth/login", limiteLogin, validar(loginSchema), login);
// Únicas rotas liberadas com senha provisória: ler o próprio perfil e trocar a senha.
authRoutes.get("/auth/me", autenticarPermitindoSenhaProvisoria, me);
authRoutes.put("/auth/senha", autenticarPermitindoSenhaProvisoria, validar(trocarSenhaSchema), trocarSenha);
