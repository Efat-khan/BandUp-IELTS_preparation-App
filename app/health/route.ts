import { prisma } from "@/lib/db";
import { ping } from "@/lib/gemini/client";

export const dynamic = "force-dynamic";

type CheckResult = { ok: true } | { ok: false; error: string };

function settle(result: PromiseSettledResult<unknown>): CheckResult {
  if (result.status === "fulfilled") return { ok: true };
  const reason = result.reason;
  return {
    ok: false,
    error: reason instanceof Error ? reason.message : String(reason),
  };
}

export async function GET() {
  const [db, gemini] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    ping(),
  ]);

  const checks = { db: settle(db), gemini: settle(gemini) };
  const ok = checks.db.ok && checks.gemini.ok;

  return Response.json(
    { ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
