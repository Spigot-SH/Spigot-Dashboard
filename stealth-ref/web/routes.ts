// Dashboard data API (/api/*) + static UI at /. SPEC §4.5. Milestones M3 + M5.
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { recentEvents, listCatalog, setAllowed } from "../db/db.js";
import { addServer } from "../mcp/aggregator.js";
import { tokenOk, tokenFromHono } from "../auth.js";

export const webRoutes = new Hono();

// dashboard UI shell (no secrets in it) — open so the browser can load + prompt for token
webRoutes.get("/", serveStatic({ path: "./src/web/public/index.html" }));

// health is OPEN (Railway healthcheck hits this) — registered before the auth gate
webRoutes.get("/api/health", (c) => c.json({ ok: true, service: "stealth", version: "0.1.0" }));

// gate everything else under /api/*
webRoutes.use("/api/*", async (c, next) => {
  if (!tokenOk(tokenFromHono(c))) return c.json({ ok: false, error: "unauthorized" }, 401);
  await next();
});

webRoutes.get("/api/events", async (c) => {
  const limit = Number(c.req.query("limit") ?? 100);
  return c.json({ ok: true, events: await recentEvents(limit) });
});

// Full catalog incl. not-yet-allowed items, grouped by server.
webRoutes.get("/api/catalog", async (c) => c.json({ ok: true, items: await listCatalog() }));

// Toggle allow-list: { kind:"tool"|"skill", name, on }
webRoutes.post("/api/allow", async (c) => {
  const { kind, name, on } = await c.req.json();
  if (kind !== "tool" && kind !== "skill") return c.json({ ok: false, error: "kind must be tool|skill" }, 400);
  await setAllowed(kind, name, on !== false);
  return c.json({ ok: true });
});

// Register + connect a downstream MCP server: { name, transport:"http"|"stdio", url }
webRoutes.post("/api/servers", async (c) => {
  const { name, transport, url } = await c.req.json();
  if (!name || !transport || !url) return c.json({ ok: false, error: "name, transport, url required" }, 400);
  try {
    await addServer(name, transport, url);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e) }, 502);
  }
});
