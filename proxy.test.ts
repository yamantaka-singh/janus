process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "dummy-key";

import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

const loaderSource = `
import { resolve as pathResolve } from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  if (specifier === "next/headers") {
    return nextResolve("next/headers.js", context);
  }
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    for (const ext of ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx", "/index.js"]) {
      const full = pathResolve(process.cwd(), rel + ext);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return nextResolve(pathToFileURL(full).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
`;

register(
  "data:text/javascript;base64," + Buffer.from(loaderSource).toString("base64"),
  import.meta.url,
);

const { NextRequest } = await import("next/server.js");
const { proxy } = await import("./proxy.ts");

test("public automatic ingest strips forged session headers", async () => {
  const req = new NextRequest("http://localhost:3000/api/weighments/automatic", {
    method: "POST",
    headers: {
      "x-user-role": "admin",
      "x-user-id": "1",
      "x-factory-id": "99",
      "x-pathname": "/forged",
      "x-client-device": "rpi-01",
    },
  });

  const res = await proxy(req);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-middleware-request-x-user-role"), null);
  assert.equal(res.headers.get("x-middleware-request-x-user-id"), null);
  assert.equal(res.headers.get("x-middleware-request-x-factory-id"), null);
  assert.equal(res.headers.get("x-middleware-request-x-pathname"), null);
  assert.equal(res.headers.get("x-middleware-request-x-client-device"), "rpi-01");
});

test("public auth API strips forged session headers", async () => {
  const req = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "x-user-role": "admin",
      "x-user-id": "1",
    },
  });

  const res = await proxy(req);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-middleware-request-x-user-role"), null);
  assert.equal(res.headers.get("x-middleware-request-x-user-id"), null);
});

test("public asset request strips forged session headers", async () => {
  const req = new NextRequest("http://localhost:3000/favicon.ico", {
    method: "GET",
    headers: {
      "x-user-role": "admin",
      "x-user-id": "1",
    },
  });

  const res = await proxy(req);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-middleware-request-x-user-role"), null);
  assert.equal(res.headers.get("x-middleware-request-x-user-id"), null);
});

test("unauthenticated login page strips forged session headers and sets x-pathname", async () => {
  const req = new NextRequest("http://localhost:3000/login", {
    method: "GET",
    headers: {
      "x-user-role": "admin",
      "x-user-id": "1",
    },
  });

  const res = await proxy(req);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-middleware-request-x-user-role"), null);
  assert.equal(res.headers.get("x-middleware-request-x-user-id"), null);
  assert.equal(res.headers.get("x-middleware-request-x-pathname"), "/login");
});
