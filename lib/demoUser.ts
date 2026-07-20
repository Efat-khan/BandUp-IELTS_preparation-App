import { prisma } from "@/lib/db";

const DEMO_USER_EMAIL = "demo@bandup.local";

/**
 * Phase 1 stand-in for real auth (Clerk wiring is a later phase). API
 * routes accept an optional userId and otherwise fall back to a single
 * upserted demo user, so the generate -> evaluate loop is runnable end to
 * end before an auth system exists.
 */
export async function resolveUserId(requestedUserId?: string | null): Promise<string> {
  if (requestedUserId) return requestedUserId;
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Demo User" },
  });
  return user.id;
}
