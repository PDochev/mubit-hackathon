import { assertReviewer } from "@/lib/reviewer";
import { runEval } from "@/lib/eval";
import { EVAL_SETS } from "@/lib/generate";

export async function POST(request: Request) {
  await assertReviewer();
  const body = (await request.json().catch(() => ({}))) as { n?: number; set?: number };
  const set = body.set ?? 4;
  if (!EVAL_SETS.includes(set)) return Response.json({ error: `set must be one of ${EVAL_SETS.join(", ")}` }, { status: 400 });
  return Response.json(await runEval(set, body.n ? Math.min(body.n, 100) : undefined));
}
