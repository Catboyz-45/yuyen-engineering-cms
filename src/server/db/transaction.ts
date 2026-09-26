import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { randomInt } from "node:crypto";

const MAX_ATTEMPTS = 4;

/** PostgreSQL aborts one side of a conflicting serializable transaction (SQLSTATE 40001), which Prisma reports as P2034. */
export function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/** Runs the callback in a SERIALIZABLE transaction, retrying the whole callback when PostgreSQL reports a conflict. */
export async function serializable<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try { return await db.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isSerializationFailure(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt + randomInt(25)));
    }
  }
}
