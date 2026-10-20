import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, usersTable, profilesTable, predictionsTable, type UserRow } from "@workspace/db";
import { and, eq, isNull, isNotNull, lt } from "drizzle-orm";
import { logger } from "./logger";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type Role = "individual" | "hr" | "tvet";
export type SessionUser = { id: number; email: string; name: string; role: Role; organization: string | null };

const SESSION_DAYS = 14;

function secret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Session token: `<userId>.<expiryEpochSec>.<hmac>`; sent as a Bearer token. */
export function issueToken(userId: number): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = sign(`${uid}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  const id = Number(uid);
  return Number.isInteger(id) ? id : null;
}

export function userToApi(u: UserRow): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role as Role, organization: u.organization };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      guestToken?: string;
    }
  }
}

const GUEST_RE = /^[A-Za-z0-9_-]{24,64}$/;

/** Reads the Bearer session token and the anonymous X-Guest-Token header. */
export const attachIdentity: RequestHandler = async (req, _res, next) => {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const uid = readToken(auth.slice(7).trim());
      if (uid) {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, uid));
        if (u) req.user = userToApi(u);
      }
    }
    const guest = req.headers["x-guest-token"];
    if (typeof guest === "string" && GUEST_RE.test(guest)) req.guestToken = guest;
    next();
  } catch (err) {
    next(err);
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "login_required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

/** Moves guest-owned profiles and predictions to a registered individual. */
export async function claimGuestData(userId: number, guestToken: string | undefined): Promise<number> {
  if (!guestToken) return 0;
  const moved = await db
    .update(profilesTable)
    .set({ ownerUserId: userId, guestToken: null })
    .where(and(eq(profilesTable.guestToken, guestToken), isNull(profilesTable.ownerUserId)))
    .returning({ id: profilesTable.id });
  await db
    .update(predictionsTable)
    .set({ ownerUserId: userId, guestToken: null })
    .where(and(eq(predictionsTable.guestToken, guestToken), isNull(predictionsTable.ownerUserId)));
  return moved.length;
}

export const DEMO_PASSWORD = "Demo@2026";
export const DEMO_ACCOUNTS = [
  { email: "hr@skilytics.demo", name: "Demo HR", role: "hr" as const, organization: "Syarikat Demo Sdn Bhd" },
  { email: "tvet@skilytics.demo", name: "Demo TVET", role: "tvet" as const, organization: "Kolej Vokasional Demo" },
];

export async function seedDemoAccounts(): Promise<void> {
  for (const a of DEMO_ACCOUNTS) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, a.email));
    if (existing) continue;
    await db.insert(usersTable).values({ ...a, passwordHash: await hashPassword(DEMO_PASSWORD) });
    logger.info({ email: a.email }, "Demo account created");
  }
}

const GUEST_TTL_DAYS = 7;

/** Removes guest work never claimed by a registration. */
export async function purgeStaleGuestData(): Promise<void> {
  const cutoff = new Date(Date.now() - GUEST_TTL_DAYS * 86400 * 1000);
  const p = await db
    .delete(profilesTable)
    .where(and(isNull(profilesTable.ownerUserId), lt(profilesTable.createdAt, cutoff), isNotNull(profilesTable.guestToken)))
    .returning({ id: profilesTable.id });
  await db
    .delete(predictionsTable)
    .where(and(isNull(predictionsTable.ownerUserId), lt(predictionsTable.createdAt, cutoff), isNotNull(predictionsTable.guestToken)));
  if (p.length) logger.info({ removed: p.length }, "Purged stale guest profiles");
}
