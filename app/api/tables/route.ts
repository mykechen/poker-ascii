import { openTable } from "@/lib/poker/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Send the blinds, your name, and your stack." }, { status: 400 });
  const result = openTable({
    smallBlind: numberOrNaN(body.smallBlind),
    bigBlind: numberOrNaN(body.bigBlind),
    name: typeof body.name === "string" ? body.name : "",
    stack: numberOrNaN(body.stack),
    seat: typeof body.seat === "number" ? body.seat : 0,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}

function numberOrNaN(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}
