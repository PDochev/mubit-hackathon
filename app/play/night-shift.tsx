"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Verdict } from "@/lib/prompt";
import type { Review, ShiftView } from "@/lib/shift";
import { cn } from "@/lib/utils";
import { loadShift, reviewClaim, settleClaim, startShift } from "./actions";
import { ENCOUNTERS, type Encounter } from "./encounters";

// Art is PixelLab output in public/play. The background is 400x248, so one art
// pixel is 0.25cqw; every sprite is sized at that same scale.
const ART_PX = 0.25;

// One claim at a time: the apprentice gives its call (a metadata-only first
// pass through Mubit), you stamp it, and if you disagree you teach it why.
// Your ruling becomes a precedent for the rest of the shift and is recorded
// through Mubit as a training example (lib/game.ts).
type Phase =
  | "loading" // fetching the shift
  | "asking" // the apprentice is reading the claim
  | "ready" // its call is in; your stamp
  | "teach" // you disagreed: say why
  | "saving" // recording through Mubit
  | "done" // ruled; next claim
  | "error" // the apprentice couldn't be reached
  | "over"; // every claim ruled

const STAMPS: { id: Verdict; label: string; color: string }[] = [
  { id: "approve", label: "APPROVE", color: "var(--ns-approve)" },
  { id: "violation", label: "REJECT", color: "var(--ns-violation)" },
  { id: "needs_info", label: "NEED INFO", color: "var(--ns-info)" },
];

const STAMP_MARK: Record<Verdict, string> = {
  approve: "APPROVED",
  violation: "REJECTED",
  needs_info: "MORE INFO",
};

const SAID: Record<Verdict, string> = {
  approve: "APPROVE",
  violation: "REJECT",
  needs_info: "NEED INFO",
};

// The wall clock as the night goes on, by claims ruled.
const CLOCK = ["23:12", "01:05", "03:40", "06:15", "08:58"];

// Each phase's robot face (public/play/robot-*.png) and body motion.
const MOOD: Record<Phase, { face: string; motion: string }> = {
  loading: { face: "thinking", motion: "ns-bob" },
  asking: { face: "thinking", motion: "ns-bob" },
  ready: { face: "idle", motion: "ns-bob" },
  teach: { face: "confused", motion: "ns-tilt" },
  saving: { face: "thinking", motion: "ns-bob" },
  done: { face: "happy", motion: "ns-hop" },
  error: { face: "confused", motion: "ns-tilt" },
  over: { face: "happy", motion: "ns-hop" },
};

const nextUp = (shift: ShiftView) => ENCOUNTERS.find((e) => !shift.settled.includes(e.id));

export function NightShift({ pixelFont, typeFont }: { pixelFont: string; typeFont: string }) {
  const [shift, setShift] = useState<ShiftView | null>(null);
  const [current, setCurrent] = useState<Encounter | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [stamp, setStamp] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Opens the next unruled claim and asks the apprentice about it. Asking
  // again about a claim it already answered costs nothing: the server keeps
  // the first pass.
  function open(next: ShiftView) {
    setShift(next);
    setStamp(null);
    setReview(null);
    setError(null);
    const e = nextUp(next);
    setCurrent(e ?? null);
    if (!e) {
      setPhase("over");
      return;
    }
    setPhase("asking");
    reviewClaim(e.id)
      .then((r) => {
        setReview(r);
        setShift(r.shift);
        if (r.verdict) setPhase("ready");
        else {
          setError(r.error ?? "The apprentice didn't answer. Try again.");
          setPhase("error");
        }
      })
      .catch(() => {
        setError("Couldn't reach the apprentice. Try again.");
        setPhase("error");
      });
  }

  useEffect(() => {
    loadShift()
      .then(open)
      .catch(() => {
        setError("Couldn't open the shift. Try again.");
        setPhase("error");
      });
  }, []);

  function rule(verdict: Verdict, reason?: string) {
    if (!current) return;
    setPhase("saving");
    setError(null);
    settleClaim(current.id, verdict, reason)
      .then((r) => {
        setShift(r.shift);
        if (!r.final) {
          setError(r.error ?? "Couldn't record that. Try again.");
          setPhase(reason ? "teach" : "ready");
          return;
        }
        setReview(r);
        setPhase("done");
      })
      .catch(() => {
        setError("Couldn't record that. Try again.");
        setPhase(reason ? "teach" : "ready");
      });
  }

  function press(verdict: Verdict) {
    if (phase !== "ready" || !review?.verdict) return;
    setStamp(verdict);
    setError(null);
    if (verdict === review.verdict) rule(verdict);
    else setPhase("teach");
  }

  function restart() {
    setPhase("loading");
    startShift()
      .then(open)
      .catch(() => {
        setError("Couldn't start a new shift. Try again.");
        setPhase("error");
      });
  }

  function retry() {
    if (shift) open(shift);
    else restart();
  }

  return (
    // Fills the window. The HUD and the controls are placed against the
    // window; the office art covers it, cropped from the bottom (drawers)
    // on screens wider than the art, and lifted when the desk top (70% of
    // the art) would fall behind the controls (the bottom 17%). cqw inside
    // the office is the art's width.
    <div
      className={cn(
        "ns-scene relative size-full overflow-hidden bg-[#0d1024] select-none",
        pixelFont,
        stamp && phase !== "ready" && "ns-shake",
      )}
    >
      <div className="@container absolute top-[min(0px,calc(83dvh-max(100vw,100dvh*400/248)*0.434))] left-1/2 aspect-[400/248] w-[max(100vw,calc(100dvh*400/248))] -translate-x-1/2 portrait:top-1/2 portrait:w-screen portrait:-translate-y-1/2">
        {/* The office, with live rain on the glass and a flickering lamp */}
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art must not be resampled */}
        <img src="/play/office-b.png" alt="" className="absolute inset-0 size-full" />
        <div className="ns-rain absolute top-[22%] left-[24.5%] h-[42%] w-[50%] opacity-60" />
        <div className="ns-glow ns-flicker absolute top-[36%] left-[68%] h-[40%] w-[26%]" />

        {/* Desk props, at the art's pixel scale, standing on the desk top */}
        <Prop src="binder" w={26} left={27} />
        <Prop src="mug" w={28} left={37} />
        <Prop src="stamp" w={20} left={47} />

        <Apprentice phase={phase} review={review} stamp={stamp} error={error} typeFont={typeFont} />

        {current && phase !== "over" && (
          <Claim key={current.id} encounter={current} typeFont={typeFont} stamp={phase === "ready" ? null : stamp} />
        )}
      </div>

      <Hud shift={shift} onRestart={restart} />

      {(phase === "asking" || phase === "ready" || phase === "loading") && (
        <Stamps disabled={phase !== "ready"} onPress={press} />
      )}
      {phase === "teach" && review?.verdict && stamp && (
        <Teach
          review={review}
          stamp={stamp}
          error={error}
          typeFont={typeFont}
          onReason={(reason) => rule(stamp, reason)}
          onBack={() => {
            setStamp(null);
            setError(null);
            setPhase("ready");
          }}
        />
      )}
      {phase === "saving" && (
        <Panel>
          <span className="ns-dots text-[1.7cqw] text-[#cfd6ff]">
            RECORDING THROUGH MUBIT<span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </Panel>
      )}
      {phase === "done" && review && shift && <Learned review={review} onNext={() => open(shift)} />}
      {phase === "error" && (
        <Panel>
          <div className="flex items-center justify-between gap-[2cqw]">
            <span className="text-[1.6cqw] text-[var(--ns-violation)]">{error}</span>
            <PixelButton onClick={retry}>TRY AGAIN</PixelButton>
          </div>
        </Panel>
      )}
      {phase === "over" && shift && <ShiftOver shift={shift} onRestart={restart} />}

      <div className="ns-scanlines absolute inset-0" />
    </div>
  );
}

function Hud({ shift, onRestart }: { shift: ShiftView | null; onRestart: () => void }) {
  const ruled = shift?.settled.length ?? 0;
  const hasScore = ruled > 0;
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[7.5%] items-center justify-between gap-[2cqw] bg-[#0b0d1f]/90 px-[2.5cqw] text-[1.35cqw] whitespace-nowrap text-[#cfd6ff]">
      <span className="text-[var(--ns-amber)]">NIGHT SHIFT · NORTHWIND</span>
      <div className="flex items-center gap-[1cqw]">
        <span className="tabular-nums">{CLOCK[Math.min(ruled, CLOCK.length - 1)]}</span>
        <div className="ns-px h-[1.1cqw] w-[14cqw] bg-[#1d2147] [--px-color:#3a4180]">
          <div
            className="h-full bg-[var(--ns-amber)] transition-[width] duration-500"
            style={{ width: `${Math.max(4, (ruled / ENCOUNTERS.length) * 100)}%` }}
          />
        </div>
        <span className="text-[#7f88c9]">09:00 AUDIT</span>
      </div>
      <div className="flex items-center gap-[1cqw]">
        <span>APPRENTICE</span>
        <div className="ns-px h-[1.1cqw] w-[12cqw] bg-[#1d2147] [--px-color:#3a4180]">
          <div
            className="h-full bg-[var(--ns-learn)] transition-[width] duration-500"
            style={{ width: `${shift?.accuracy ?? 0}%` }}
          />
        </div>
        <span className="text-[var(--ns-learn)] tabular-nums">{hasScore ? `${shift?.accuracy}%` : "--"}</span>
      </div>
      <div className="flex items-center gap-[2cqw]">
        <span>PRECEDENTS {shift?.precedents.length ?? 0}</span>
        <button type="button" onClick={onRestart} className="text-[#7f88c9] hover:text-white">
          NEW SHIFT
        </button>
        <Link href="/" className="text-[#7f88c9] hover:text-white">
          EXIT
        </Link>
      </div>
    </div>
  );
}

function verdictLine(verdict: Verdict): string {
  switch (verdict) {
    case "approve":
      return "I'D APPROVE";
    case "violation":
      return "I'D REJECT";
    case "needs_info":
      return "I NEED MORE INFO";
    default: {
      const neverVerdict: never = verdict;
      return neverVerdict;
    }
  }
}

function Apprentice({
  phase,
  review,
  stamp,
  error,
  typeFont,
}: {
  phase: Phase;
  review: Review | null;
  stamp: Verdict | null;
  error: string | null;
  typeFont: string;
}) {
  const mood = MOOD[phase];
  return (
    <div className="absolute bottom-[30%] left-[55%] flex flex-col items-center">
      <div className="ns-px relative mb-[0.6cqw] min-h-[4.5cqw] w-[24cqw] bg-white px-[1.2cqw] py-[0.8cqw] text-center text-[1.5cqw] leading-tight text-[var(--ns-ink)]">
        <Speech phase={phase} review={review} stamp={stamp} error={error} typeFont={typeFont} />
      </div>
      <div key={phase} className={mood.motion}>
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art must not be resampled */}
        <img
          src={`/play/robot-${mood.face}.png`}
          alt="Your AI apprentice"
          style={{ width: `${96 * ART_PX}cqw` }}
          className="h-auto"
        />
      </div>
    </div>
  );
}

function Speech({
  phase,
  review,
  stamp,
  error,
  typeFont,
}: {
  phase: Phase;
  review: Review | null;
  stamp: Verdict | null;
  error: string | null;
  typeFont: string;
}) {
  const thinking = (label: string) => (
    <span className="ns-dots">
      {label}
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
  switch (phase) {
    case "loading":
      return thinking("CLOCKING IN");
    case "asking":
      return thinking("THINKING");
    case "saving":
      return thinking("WRITING THAT DOWN");
    case "error":
      return <span className="text-[var(--ns-violation)]">{error ?? "UH OH."}</span>;
    case "over":
      return <span className="ns-pop inline-block text-[var(--ns-learn)]">SHIFT DONE. SEE YOU AT THE AUDIT!</span>;
    case "teach":
      return (
        <span className="ns-pop inline-block text-[var(--ns-violation)]">
          {stamp ? `${SAID[stamp]}? WHY?` : "WHY?"}
        </span>
      );
    case "done": {
      const id = review?.final?.precedentId;
      const unverified = review?.commit?.status === "unverified";
      return (
        <span className="ns-pop inline-block text-[var(--ns-learn)]">
          {id ? (unverified ? `SAVED ${id}. STILL LEARNING IT.` : `GOT IT! LEARNED ${id}`) : "WE AGREE!"}
        </span>
      );
    }
    case "ready": {
      if (!review?.verdict) return null;
      const wants = review.verdict === "needs_info" ? review.missing.join(" ") : "";
      return (
        <div className="ns-pop flex flex-col gap-[0.4cqw]">
          {review.precedentIds.length > 0 && (
            <p className="text-[1.2cqw] text-[var(--ns-learn)]">USING {review.precedentIds.join(", ")}</p>
          )}
          <p>
            {verdictLine(review.verdict)}
            {review.clause ? ` · ${review.clause}` : ""}
          </p>
          {review.reason && (
            <p
              className={cn(
                "text-left text-[1.5cqw] leading-[1.05] text-[#4a4f7a]",
                wants ? "line-clamp-2" : "line-clamp-3",
                typeFont,
              )}
            >
              {review.reason}
            </p>
          )}
          {wants && (
            <p className={cn("line-clamp-3 text-left text-[1.5cqw] leading-[1.05] text-[#9a6a12]", typeFont)}>
              <span className="text-[#8a5a00]">WANTS: </span>
              {wants}
            </p>
          )}
        </div>
      );
    }
    default: {
      const neverPhase: never = phase;
      return neverPhase;
    }
  }
}

function formatWhen(datetime: string): string {
  // Claim times are London wall-clock "YYYY-MM-DDTHH:mm"; read them as UTC
  // so the browser's time zone doesn't shift them.
  const d = new Date(`${datetime}:00Z`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${day}, ${datetime.slice(11, 16)}`;
}

function Claim({
  encounter,
  typeFont,
  stamp,
}: {
  encounter: Encounter;
  typeFont: string;
  stamp: Verdict | null;
}) {
  const c = encounter.claim;
  const rows: [string, string][] = [
    ["MERCHANT", c.merchant],
    ["AMOUNT", `£${c.amount.toFixed(2)} · ${c.headcount} ${c.headcount === 1 ? "person" : "people"}`],
    ["WHEN", formatWhen(c.datetime)],
    ["WHO", c.attendees || c.employee],
    ["WHY", c.purpose],
    ["RECEIPT", c.receipt ? (c.receiptText ?? "Attached") : "Missing"],
  ];
  return (
    <div className="ns-slide-in absolute top-[13%] left-[20%] w-[36%] -rotate-1">
      <div className="ns-px relative bg-[var(--ns-paper)] px-[2cqw] pt-[1.4cqw] pb-[1.8cqw] text-[var(--ns-ink)] shadow-[0.8cqw_0.8cqw_0_rgb(0_0_0/0.35)]">
        <div className="flex items-baseline justify-between border-b-[0.3cqw] border-dashed border-[var(--ns-paper-shade)] pb-[0.8cqw] text-[1.6cqw]">
          <span>EXPENSE CLAIM</span>
          <span className="text-[1.3cqw] text-[#7a6d55]">{c.employee.toUpperCase()}</span>
        </div>
        <dl className={cn("mt-[1cqw] grid grid-cols-[auto_1fr] gap-x-[1.4cqw] gap-y-[0.3cqw] text-[1.9cqw] leading-[1.05]", typeFont)}>
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[#8a7c62]">{k}</dt>
              <dd className={cn(k === "RECEIPT" && !c.receipt && "text-[var(--ns-violation)]")}>{v}</dd>
            </div>
          ))}
        </dl>
        {stamp && (
          <div
            className="ns-stamp-mark absolute right-[6%] bottom-[14%] border-[0.4cqw] px-[1cqw] py-[0.2cqw] text-[2.6cqw] mix-blend-multiply"
            style={{ color: STAMPS.find((s) => s.id === stamp)!.color, borderColor: "currentColor" }}
          >
            {STAMP_MARK[stamp]}
          </div>
        )}
      </div>
    </div>
  );
}

function Stamps({ disabled, onPress }: { disabled: boolean; onPress: (s: Verdict) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-[5%] flex justify-center gap-[3cqw]">
      {STAMPS.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onPress(s.id)}
          className="ns-px ns-btn px-[2.4cqw] py-[1.1cqw] text-[1.9cqw] text-white disabled:pointer-events-none disabled:opacity-40"
          style={{ background: s.color }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="ns-pop ns-px absolute inset-x-[4%] bottom-[3%] flex flex-col gap-[1cqw] bg-[#0b0d1f]/92 p-[1.6cqw]"
      style={{ ["--px-color" as string]: accent ?? "#3a4180" }}
    >
      {children}
    </div>
  );
}

function PixelButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ns-px ns-btn shrink-0 bg-[var(--ns-amber)] px-[2cqw] py-[0.9cqw] text-[1.7cqw] text-[var(--ns-ink)]"
    >
      {children}
    </button>
  );
}

function Teach({
  review,
  stamp,
  error,
  typeFont,
  onReason,
  onBack,
}: {
  review: Review;
  stamp: Verdict;
  error: string | null;
  typeFont: string;
  onReason: (reason: string) => void;
  onBack: () => void;
}) {
  const [note, setNote] = useState("");
  const cards = review.teachings.filter((t) => t.verdict === stamp);
  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-[2cqw]">
        <span className="text-[1.6cqw] text-[#cfd6ff]">
          APPRENTICE SAID {SAID[review.verdict!]}. YOU SAID {SAID[stamp]}.{" "}
          <span className="text-[var(--ns-amber)]">TEACH IT WHY:</span>
        </span>
        <button type="button" onClick={onBack} className="shrink-0 text-[1.3cqw] text-[#7f88c9] hover:text-white">
          ◀ CHANGE STAMP
        </button>
      </div>
      {error && <span className="text-[1.4cqw] text-[var(--ns-violation)]">{error}</span>}
      {cards.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-[1.2cqw]">
          {cards.map((card) => (
            <button
              key={card.reason}
              type="button"
              onClick={() => onReason(card.reason)}
              className={cn(
                "ns-px ns-btn bg-[var(--ns-paper)] p-[1cqw] text-left text-[1.6cqw] leading-[1.05] text-[var(--ns-ink)]",
                typeFont,
              )}
            >
              {card.reason}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-[1cqw]"
        onSubmit={(e) => {
          e.preventDefault();
          const reason = note.trim();
          if (reason) onReason(reason);
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={cards.length ? "Or write your own rule, in one sentence" : "Write the rule, in one sentence"}
          className={cn(
            "ns-px min-w-0 flex-1 bg-[var(--ns-paper)] px-[1cqw] py-[0.6cqw] text-[1.7cqw] text-[var(--ns-ink)] outline-none",
            typeFont,
          )}
        />
        <button
          type="submit"
          disabled={!note.trim()}
          className="ns-px ns-btn bg-[var(--ns-amber)] px-[1.6cqw] text-[1.6cqw] text-[var(--ns-ink)] disabled:opacity-40"
        >
          TEACH
        </button>
      </form>
    </Panel>
  );
}

function Learned({ review, onNext }: { review: Review; onNext: () => void }) {
  const id = review.final?.precedentId;
  const commit = review.commit;
  const ref = commit?.mubitRequestId;
  const title = id ? `+1 RULING · ${id} LEARNED` : "AGREED · NO NEW RULING NEEDED";
  let detail: string;
  if (ref && commit?.status === "verified") detail = `RECORDED THROUGH MUBIT AS A TRAINING EXAMPLE · ${ref}`;
  else if (ref) detail = `RECORDED THROUGH MUBIT · ${ref} · THE MODEL DIDN'T REPEAT IT YET, SO IT ISN'T VERIFIED`;
  else detail = commit?.error ? `NOT RECORDED: ${commit.error}` : "NOT RECORDED";
  return (
    <Panel accent="var(--ns-learn)">
      <div className="flex items-center justify-between gap-[2cqw]">
        <div className="flex min-w-0 flex-col gap-[0.4cqw]">
          <span className="text-[1.9cqw] text-[var(--ns-learn)]">{title}</span>
          <span className="truncate text-[1.3cqw] text-[#9aa3e0]">{detail}</span>
        </div>
        <PixelButton onClick={onNext}>NEXT CLAIM ▶</PixelButton>
      </div>
    </Panel>
  );
}

function ShiftOver({ shift, onRestart }: { shift: ShiftView; onRestart: () => void }) {
  return (
    <Panel accent="var(--ns-amber)">
      <div className="flex items-center justify-between gap-[2cqw]">
        <div className="flex min-w-0 flex-col gap-[0.4cqw]">
          <span className="text-[1.9cqw] text-[var(--ns-amber)]">
            SHIFT OVER · APPRENTICE AGREED WITH YOU {shift.accuracy}% OF THE TIME
          </span>
          <span className="truncate text-[1.3cqw] text-[#9aa3e0]">
            {shift.precedents.length
              ? `IT LEARNED ${shift.precedents.map((p) => p.id).join(", ")}: ${shift.precedents.map((p) => p.reason).join(" · ")}`
              : "IT DIDN'T NEED ANY NEW RULINGS TONIGHT."}
          </span>
        </div>
        <PixelButton onClick={onRestart}>NEW SHIFT ▶</PixelButton>
      </div>
    </Panel>
  );
}

function Prop({ src, w, left }: { src: string; w: number; left: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pixel art must not be resampled
    <img
      src={`/play/${src}.png`}
      alt=""
      className="absolute bottom-[30.5%] h-auto"
      style={{ left: `${left}%`, width: `${w * ART_PX}cqw` }}
    />
  );
}
