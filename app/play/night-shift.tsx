"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/prompt";
import type { Review, ShiftView } from "@/lib/shift";
import { cn } from "@/lib/utils";
import { ADAPTER_EVIDENCE } from "@/lib/adapter-evidence";
import { loadShift, reviewClaim, settleClaim, startAudit, startShift } from "./actions";
import { ENCOUNTERS, ROUND_2, type Encounter } from "@/lib/encounters";

// Art is PixelLab output in public/play. The background is 400x248, so one art
// pixel is 0.25cqw; every sprite is sized at that same scale.
const ART_PX = 0.25;

// One claim at a time: the apprentice gives its call (a metadata-only first
// pass through Mubit), you stamp it, and if you disagree you teach it why.
// Your ruling becomes a precedent for the rest of the shift and is recorded
// through Mubit as a training example (lib/game.ts). Round 2 brings claims
// that turn on the same rules; the 09:00 audit tests it alone.
type Phase =
  | "loading" // fetching the shift
  | "asking" // the apprentice is reading the claim
  | "ready" // its call is in; your stamp
  | "teach" // you disagreed: say why
  | "saving" // recording through Mubit
  | "done" // ruled; next claim
  | "error" // the apprentice couldn't be reached
  | "interlude" // 03:00, round 2 is about to start
  | "audit-intro" // 09:00, every claim ruled
  | "auditing" // the audit's model calls are running
  | "audit" // the audit board
  | "results"; // the shift report

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

// The wall clock as the night goes on, by claims ruled; then the audit.
const CLOCK = ["23:12", "00:05", "00:58", "01:50", "03:05", "04:10", "05:20", "09:00"];

// Each phase's robot face (public/play/robot-*.png) and body motion.
const MOOD: Record<Phase, { face: string; motion: string }> = {
  loading: { face: "thinking", motion: "ns-bob" },
  asking: { face: "thinking", motion: "ns-bob" },
  ready: { face: "idle", motion: "ns-bob" },
  teach: { face: "confused", motion: "ns-tilt" },
  saving: { face: "thinking", motion: "ns-bob" },
  done: { face: "happy", motion: "ns-hop" },
  error: { face: "confused", motion: "ns-tilt" },
  interlude: { face: "idle", motion: "ns-bob" },
  "audit-intro": { face: "confused", motion: "ns-bob" },
  auditing: { face: "thinking", motion: "ns-bob" },
  audit: { face: "happy", motion: "ns-hop" },
  results: { face: "happy", motion: "ns-bob" },
};

const nextUp = (shift: ShiftView) => ENCOUNTERS.find((e) => !shift.settled.includes(e.id));

export function NightShift({ pixelFont, typeFont }: { pixelFont: string; typeFont: string }) {
  const [shift, setShift] = useState<ShiftView | null>(null);
  const [current, setCurrent] = useState<Encounter | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [stamp, setStamp] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The next claim's first pass, asked while you read the last result so it
  // is usually ready by the time you click on. Kept here so the same claim
  // is never asked twice at once (the server only dedupes finished asks).
  const ahead = useRef<{ id: string; review: Promise<Review> } | null>(null);

  function ask(id: string): Promise<Review> {
    const early = ahead.current;
    ahead.current = null;
    return early?.id === id ? early.review : reviewClaim(id);
  }

  function askAhead(next: ShiftView) {
    const e = nextUp(next);
    if (!e) return;
    const review = reviewClaim(e.id);
    review.catch(() => {}); // a failure shows up when the claim is opened
    ahead.current = { id: e.id, review };
  }

  // Opens the next unruled claim and asks the apprentice about it. Asking
  // again about a claim it already answered costs nothing: the server keeps
  // the first pass. Between rounds it stops at 03:00 (unless `go`), and
  // after the last claim it stops at the audit.
  function open(next: ShiftView, go = false) {
    setShift(next);
    setStamp(null);
    setReview(null);
    setError(null);
    const e = nextUp(next);
    if (!e) {
      setCurrent(null);
      setPhase(next.audit ? "audit" : "audit-intro");
      return;
    }
    if (!go && e.id === ROUND_2[0].id && current?.round === 1) {
      setCurrent(null);
      setPhase("interlude");
      return;
    }
    setCurrent(e);
    setPhase("asking");
    ask(e.id)
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
    // Once, on arrival: later claims are opened by the player's clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        askAhead(r.shift);
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
    ahead.current = null;
    setPhase("loading");
    startShift()
      .then(open)
      .catch(() => {
        setError("Couldn't start a new shift. Try again.");
        setPhase("error");
      });
  }

  function audit() {
    setPhase("auditing");
    setError(null);
    startAudit()
      .then(({ shift: s, error: message }) => {
        if (!s) {
          setError(message ?? "The audit couldn't reach the apprentice. Try again.");
          setPhase("audit-intro");
          return;
        }
        setShift(s);
        setPhase("audit");
      })
      .catch(() => {
        setError("The audit couldn't reach the apprentice. Try again.");
        setPhase("audit-intro");
      });
  }

  function retry() {
    if (shift) open(shift, true);
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
      {/* The scene is laid out for a landscape screen; an upright phone
          shows it too small to read, so ask for a turn instead. */}
      <div className="absolute inset-0 z-50 hidden flex-col items-center justify-center gap-4 bg-[#05060f] p-8 text-center text-[#e8ecff] portrait:max-md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art must not be resampled */}
        <img src="/play/robot-confused.png" alt="" className="w-32 [image-rendering:pixelated]" />
        <p className="text-xl text-[var(--ns-amber)]">TURN YOUR PHONE SIDEWAYS</p>
        <p className="text-sm text-[#9aa3e0]">The night shift needs the whole desk.</p>
      </div>
      <div className="@container absolute top-[min(0px,calc(83dvh-max(100vw,100dvh*400/248)*0.434))] left-1/2 aspect-[400/248] w-[max(100vw,calc(100dvh*400/248))] -translate-x-1/2 portrait:top-1/2 portrait:w-screen portrait:-translate-y-1/2">
        {/* The office, with live rain on the glass and a flickering lamp */}
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art must not be resampled */}
        <img src="/play/office-b.png" alt="" className="absolute inset-0 size-full" />
        <div className="ns-rain absolute top-[22%] left-[24.5%] h-[42%] w-[50%] opacity-60" />
        <div className="ns-glow ns-flicker absolute top-[36%] left-[68%] h-[40%] w-[26%]" />

        <Apprentice phase={phase} review={review} stamp={stamp} error={error} typeFont={typeFont} />

        {current && (
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
      {phase === "interlude" && shift && (
        <Panel accent="var(--ns-amber)">
          <div className="flex items-center justify-between gap-[2cqw]">
            <div className="flex min-w-0 flex-col gap-[0.4cqw]">
              <span className="text-[1.9cqw] text-[var(--ns-amber)]">03:00 · SOME FAMILIAR FACES ARE BACK</span>
              <span className="text-[1.3cqw] text-[#9aa3e0]">
                {shift.precedents.length
                  ? `NEW CLAIMS THAT TURN ON THE SAME RULES. THE APPRENTICE NOW KNOWS ${shift.precedents.map((p) => p.id).join(", ")}. LET IT TRY.`
                  : "NEW CLAIMS THAT TURN ON THE SAME RULES. LET THE APPRENTICE TRY."}
              </span>
            </div>
            <PixelButton onClick={() => open(shift, true)}>ROUND 2 ▶</PixelButton>
          </div>
        </Panel>
      )}
      {(phase === "audit-intro" || phase === "auditing") && (
        <Panel accent="var(--ns-amber)">
          <div className="flex items-center justify-between gap-[2cqw]">
            <div className="flex min-w-0 flex-col gap-[0.4cqw]">
              <span className="text-[1.9cqw] text-[var(--ns-amber)]">09:00 · THE AUDITOR IS HERE</span>
              <span className="text-[1.3cqw] text-[#9aa3e0]">
                {error ??
                  "6 CLAIMS THE APPRENTICE HAS NEVER SEEN, NO HELP FROM YOU. EACH ONE IS ASKED TWICE: AS IT WAS AT 23:00, AND WITH YOUR RULINGS."}
              </span>
            </div>
            {phase === "auditing" ? (
              <span className="ns-dots shrink-0 text-[1.7cqw] text-[#cfd6ff]">
                MARKING<span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            ) : (
              <PixelButton onClick={audit}>START AUDIT ▶</PixelButton>
            )}
          </div>
        </Panel>
      )}
      {phase === "audit" && shift?.audit && (
        <AuditBoard audit={shift.audit} typeFont={typeFont} onNext={() => setPhase("results")} />
      )}
      {phase === "results" && shift && <Results shift={shift} typeFont={typeFont} onRestart={restart} />}

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
        <span>RULINGS {shift?.precedents.length ?? 0}</span>
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
    case "interlude":
      return <span className="ns-pop inline-block text-[var(--ns-learn)]">LET ME TRY WHAT YOU TAUGHT ME.</span>;
    case "audit-intro":
      return <span className="ns-pop inline-block">AN AUDIT? NO HELP THIS TIME…</span>;
    case "auditing":
      return thinking("TAKING THE AUDIT");
    case "audit":
    case "results":
      return <span className="ns-pop inline-block text-[var(--ns-learn)]">WHAT A NIGHT. SAME TIME TOMORROW?</span>;
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
          {id
            ? unverified
              ? `SAVED ${id}. STILL LEARNING IT.`
              : `GOT IT! LEARNED ${id}`
            : review?.precedentIds.length
              ? `I REMEMBERED ${review.precedentIds.join(", ")}!`
              : "WE AGREE!"}
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
  const used = review.precedentIds;
  const title = id
    ? `+1 RULING · ${id} LEARNED`
    : used.length
      ? `IT USED ${used.join(", ")} AND GOT IT RIGHT, NO HELP NEEDED`
      : "AGREED · NO NEW RULING NEEDED";
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

const VERDICT_COLOR: Record<Verdict, string> = {
  approve: "var(--ns-approve)",
  violation: "var(--ns-violation)",
  needs_info: "var(--ns-info)",
};

// A small stamp for the audit board, ticked or crossed against the answer.
function Mark({ verdict, right, delay }: { verdict: Verdict | null; right?: boolean; delay: number }) {
  return (
    <span
      className="ns-stamp-mark inline-flex items-center gap-[0.5cqw] justify-self-start border-[0.25cqw] px-[0.6cqw] py-[0.1cqw] text-[1.15cqw] [rotate:-4deg]"
      style={{
        color: verdict ? VERDICT_COLOR[verdict] : "#7f88c9",
        borderColor: "currentColor",
        animationDelay: `${delay}s`,
      }}
    >
      {verdict ? SAID[verdict] : "NO ANSWER"}
      {right !== undefined && <span className={right ? "text-[var(--ns-approve)]" : "text-[var(--ns-violation)]"}>{right ? "✓" : "✗"}</span>}
    </span>
  );
}

// The overlays that replace the claim card: on the left, clear of the robot.
function Board({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div
      className="ns-pop ns-px absolute top-[10%] bottom-[4%] left-[3%] flex w-[52%] flex-col gap-[1.2cqw] overflow-hidden bg-[#0b0d1f]/95 p-[1.8cqw]"
      style={{ ["--px-color" as string]: accent }}
    >
      {children}
    </div>
  );
}

const STEP = 0.45; // seconds between audit rows

function AuditBoard({
  audit,
  typeFont,
  onNext,
}: {
  audit: NonNullable<ShiftView["audit"]>;
  typeFont: string;
  onNext: () => void;
}) {
  const n = audit.results.length;
  const end = n * STEP + 0.4;
  return (
    <Board accent="var(--ns-amber)">
      <div className="flex items-baseline justify-between">
        <span className="text-[2cqw] text-[var(--ns-amber)]">09:00 AUDIT</span>
        <span className="text-[1.2cqw] text-[#7f88c9]">{n} CLAIMS IT HAD NEVER SEEN</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-[1.6cqw] gap-y-[1cqw] text-[1.15cqw] text-[#7f88c9]">
        <span>CLAIM</span>
        <span>CORRECT</span>
        <span>AT 23:00</span>
        <span>WITH YOUR RULINGS</span>
        {audit.results.map((r, i) => (
          <div key={r.id} className="contents">
            <span
              className={cn("ns-pop text-[1.6cqw] leading-[1.05] text-[#e8ecff]", typeFont)}
              style={{ animationDelay: `${i * STEP}s` }}
            >
              {r.title}
            </span>
            <Mark verdict={r.expected} delay={i * STEP} />
            <Mark verdict={r.untrained.verdict} right={r.untrained.verdict === r.expected} delay={i * STEP + 0.15} />
            <span className="flex flex-col gap-[0.2cqw]">
              <Mark verdict={r.trained.verdict} right={r.trained.verdict === r.expected} delay={i * STEP + 0.3} />
              {r.trained.precedentIds.length > 0 && (
                <span className="mt-[0.5cqw] text-[1cqw] text-[var(--ns-learn)]">USING {r.trained.precedentIds.join(", ")}</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-[2cqw]">
        <span className="ns-pop text-[2.2cqw]" style={{ animationDelay: `${end}s` }}>
          <span className="text-[#9aa3e0]">{audit.untrainedRight}/{n}</span>
          <span className="text-[#7f88c9]"> → </span>
          <span className="text-[var(--ns-learn)]">{audit.trainedRight}/{n}</span>
          <span className="ml-[1cqw] text-[1.2cqw] text-[#7f88c9]">AFTER ONE NIGHT OF RULINGS</span>
        </span>
        <PixelButton onClick={onNext}>SHIFT REPORT ▶</PixelButton>
      </div>
    </Board>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="ns-px flex flex-col gap-[0.3cqw] bg-[#14173a] p-[1cqw] [--px-color:#3a4180]">
      <span className="text-[1.1cqw] text-[#7f88c9]">{label}</span>
      <span className="text-[2.2cqw] text-[var(--ns-learn)]">{value}</span>
      <span className="text-[1cqw] text-[#9aa3e0]">{note}</span>
    </div>
  );
}

function Results({
  shift,
  typeFont,
  onRestart,
}: {
  shift: ShiftView;
  typeFont: string;
  onRestart: () => void;
}) {
  const r1 = shift.rounds[1];
  const r2 = shift.rounds[2];
  const verified = shift.commits.filter((c) => c.status === "verified").length;
  const a = ADAPTER_EVIDENCE;
  const speed = (a.pair.provider.latencyMs / a.pair.adapter.latencyMs).toFixed(1);
  const tokens = (a.pair.provider.tokensOut / a.pair.adapter.tokensOut).toFixed(1);
  return (
    <Board accent="var(--ns-learn)">
      <span className="text-[2cqw] text-[var(--ns-learn)]">SHIFT REPORT</span>
      <div className="grid grid-cols-3 gap-[1.2cqw]">
        <Stat
          label="AGREED WITH YOU"
          value={`${r1.right}/${r1.ruled} → ${r2.right}/${r2.ruled}`}
          note="ROUND 1 → ROUND 2"
        />
        <Stat
          label="AUDIT"
          value={shift.audit ? `${shift.audit.untrainedRight} → ${shift.audit.trainedRight}/${shift.audit.results.length}` : "--"}
          note="BEFORE → AFTER YOUR RULINGS"
        />
        <Stat label="RECORDED THROUGH MUBIT" value={`${verified}/${shift.commits.length}`} note="VERIFIED TRAINING EXAMPLES" />
      </div>
      <div className="flex min-h-0 flex-col gap-[0.5cqw]">
        <span className="text-[1.2cqw] text-[var(--ns-amber)]">WHAT YOU TAUGHT IT</span>
        {shift.precedents.length ? (
          shift.precedents.map((p) => (
            <p key={p.id} className={cn("line-clamp-1 text-[1.5cqw] leading-[1.05] text-[#e8ecff]", typeFont)}>
              <span className="text-[var(--ns-learn)]">{p.id}</span> {p.reason}
            </p>
          ))
        ) : (
          <p className={cn("text-[1.5cqw] text-[#9aa3e0]", typeFont)}>Nothing new: it agreed with you every time.</p>
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-[0.3cqw]">
        <span className="text-[1.2cqw] text-[var(--ns-amber)]">MUBIT REQUESTS</span>
        <p className={cn("line-clamp-2 text-[1.3cqw] leading-[1.1] break-all text-[#9aa3e0]", typeFont)}>
          {shift.commits
            .filter((c) => c.mubitRequestId)
            .map((c) => `${c.mubitRequestId}${c.status === "verified" ? " ✓" : ""}`)
            .join("  ")}
        </p>
      </div>
      <p className={cn("text-[1.45cqw] leading-[1.1] text-[#cfd6ff]", typeFont)}>
        <span className="text-[var(--ns-amber)]">OVERNIGHT · </span>
        Mubit trains a small model on recorded examples like these. Our adapter ({a.base}, {a.version}) went from{" "}
        {Math.round(a.exam.base * 100)}% to {Math.round(a.exam.adapter * 100)}% on its exam, and answers a contractor claim
        like {a.pair.provider.model}: {speed}× faster, {tokens}× fewer tokens.
      </p>
      <div className="mt-auto flex items-center justify-end gap-[2cqw]">
        <Link href="/loop" className="text-[1.4cqw] text-[#7f88c9] hover:text-white">
          ENGINE ROOM ▶
        </Link>
        <PixelButton onClick={onRestart}>NEW SHIFT ▶</PixelButton>
      </div>
    </Board>
  );
}
