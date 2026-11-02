import { normalizeCode, parseCommand, perform, pullSharedRooms, pushSharedRooms, readSnapshot, waitForSnapshot } from "@/lib/poker/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

type Context = { params: Promise<{ code: string }> };

const SHARED_WAIT_MS = 8_000;

export async function GET(request: Request, context: Context) {
  const code = await roomCode(context);
  if (!code) return Response.json({ error: "No table with that code." }, { status: 404 });
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const since = Number(url.searchParams.get("since") ?? "-1");
  const shared = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  if (!shared) {
    const current = readSnapshot(code, token);
    if (!current) return Response.json({ error: "No table with that code." }, { status: 404 });
    if (!Number.isInteger(since) || since !== current.version) return Response.json(current);
    const next = await waitForSnapshot(code, token, since, 20_000);
    if (!next) return Response.json({ error: "No table with that code." }, { status: 404 });
    return Response.json(next);
  }

  const deadline = Date.now() + SHARED_WAIT_MS;
  while (true) {
    try {
      await pullSharedRooms();
    } catch {
      return Response.json({ error: "The table store is not reachable." }, { status: 503 });
    }
    const current = readSnapshot(code, token);
    if (!current) return Response.json({ error: "No table with that code." }, { status: 404 });
    if (!Number.isInteger(since) || since !== current.version || Date.now() >= deadline) {
      try {
        await pushSharedRooms();
      } catch {
        return Response.json(current);
      }
      return Response.json(current);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function POST(request: Request, context: Context) {
  const code = await roomCode(context);
  if (!code) return Response.json({ error: "No table with that code." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { token?: unknown; command?: unknown } | null;
  const command = parseCommand(body?.command);
  if ("error" in command) return Response.json({ error: command.error }, { status: 400 });
  const token = typeof body?.token === "string" ? body.token : null;
  try {
    await pullSharedRooms();
  } catch {
    return Response.json({ error: "The table store is not reachable." }, { status: 503 });
  }
  const result = perform(code, token, command);
  try {
    await pushSharedRooms();
  } catch {
    return Response.json({ error: "The table store is not reachable." }, { status: 503 });
  }
  if ("error" in result) {
    const status = result.error === "No table with that code." ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result);
}

async function roomCode(context: Context): Promise<string | null> {
  const { code } = await context.params;
  return normalizeCode(code);
}
