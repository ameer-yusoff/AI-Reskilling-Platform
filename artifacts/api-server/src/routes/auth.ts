import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import {
  claimGuestData,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  hashPassword,
  issueToken,
  userToApi,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/me", (req, res) => {
  res.json(req.user ?? null);
});

router.get("/auth/demo-accounts", (_req, res) => {
  res.json(DEMO_ACCOUNTS.map((a) => ({ role: a.role, email: a.email, password: DEMO_PASSWORD, organization: a.organization })));
});

router.post("/auth/login", async (req, res) => {
  const body = LoginBody.parse(req.body);
  const email = body.email.trim().toLowerCase();
  const [u] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!u || !(await verifyPassword(body.password, u.passwordHash))) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  if (u.role !== body.role) {
    res.status(403).json({ error: "wrong_role", role: u.role });
    return;
  }
  const claimed = u.role === "individual" ? await claimGuestData(u.id, req.guestToken) : 0;
  res.json({ token: issueToken(u.id), user: userToApi(u), claimedProfiles: claimed });
});

router.post("/auth/register", async (req, res) => {
  const body = RegisterBody.parse(req.body);
  const email = body.email.trim().toLowerCase();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "email_taken" });
    return;
  }
  const [u] = await db
    .insert(usersTable)
    .values({ email, name: body.name.trim(), role: "individual", organization: null, passwordHash: await hashPassword(body.password) })
    .returning();
  const claimed = await claimGuestData(u.id, req.guestToken);
  req.log.info({ userId: u.id, claimed }, "Individual registered");
  res.status(201).json({ token: issueToken(u.id), user: userToApi(u), claimedProfiles: claimed });
});

// Tokens are stateless; the client discards its copy.
router.post("/auth/logout", (_req, res) => {
  res.status(204).end();
});

export default router;
