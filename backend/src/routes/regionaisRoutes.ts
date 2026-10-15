import { Router } from "express";
import { autenticar } from "../middleware/auth.js";
import { regionais } from "../controllers/regionaisController.js";

export const regionaisRoutes = Router();

regionaisRoutes.get("/regionais", autenticar, regionais);
