import type { Request, Response } from "express";
import { listarRegionais } from "../helper/regionais.js";

export function regionais(_req: Request, res: Response) {
  return res.json({ regionais: listarRegionais() });
}
