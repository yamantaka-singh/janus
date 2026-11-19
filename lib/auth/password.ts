/**
 * @file lib/auth/password.ts
 * @description WebAssembly Argon2id password hashing and verification helper using hash-wasm for Edge / Cloudflare Workers.
 */

import { argon2id, argon2Verify } from "hash-wasm";

/**
 * Hashes a plaintext password using Argon2id via WebAssembly.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: "encoded",
  });
}

/**
 * Verifies a plaintext password against an Argon2id modular crypt format string.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({
      password,
      hash: storedHash,
    });
  } catch {
    return false;
  }
}
