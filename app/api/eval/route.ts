import { assertReviewer } from "@/lib/reviewer";
import { runEval } from "@/lib/eval";

export async function POST(request: Request) {
  await assertReviewer();
  const body = (await request.json().catch(() => ({}))) as { n?: number };
  return Response.json(await runEval(Math.min(body.n ?? 36, 100)));
}
