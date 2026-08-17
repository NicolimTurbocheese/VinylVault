import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

// Called cross-origin from a separately hosted static frontend (e.g. GitHub Pages),
// so CORS must be opened explicitly. There's no cookie/session auth on these
// endpoints — the only secret involved (GEMINI_API_KEY) never leaves the server —
// so a permissive origin is an acceptable tradeoff here.
export function applyCors(res: Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// Returns true if the request was a handled CORS preflight (caller should return immediately).
export function handlePreflight(req: Request, res: Response): boolean {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}
