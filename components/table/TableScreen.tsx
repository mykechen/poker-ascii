"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cardParts } from "@/lib/poker/cards";
import type { Card, Command, LegalAction } from "@/lib/poker/types";
import type { PublicSeat, PublicView, VisibleHole } from "@/lib/poker/view";
import { useTable } from "@/hooks/useTable";

type RoomClock = {
  pauseMs: number;
  remainMs: number | null;
  dealMs: number | null;
};

type RemoteCommand = Command | { type: "boot"; seat: number };

type Remote = {
  view: PublicView;
  you: number | null;
  host: boolean;
  seatKey: string | null;
  clock: RoomClock;
  version: number;
  code: string;
  send: (command: RemoteCommand) => void;
  link: "live" | "reconnecting";
  unknownKey: boolean;
  onReclaim: (key: string) => void;
};

const SEAT_POS = [
  { left: "50%", top: "88%" },
  { left: "18%", top: "74%" },
  { left: "7%", top: "42%" },
  { left: "22%", top: "14%" },
  { left: "50%", top: "6%" },
  { left: "78%", top: "14%" },
  { left: "93%", top: "42%" },
  { left: "82%", top: "74%" },
];

type Editor =
  | { kind: "sit"; seat: number }
  | { kind: "add"; seat: number }
  | { kind: "blinds" }
  | null;

export function TableScreen({ remote }: { remote?: Remote }) {
  const local = useTable();
  const view = remote?.view ?? local.view;
  const you = remote?.you ?? null;
  function send(command: RemoteCommand) {
    if (command.type === "boot") {
      remote?.send(command);
      return;
    }
    if (remote) remote.send(command);
    else local.send(command);
  }
  const clock = useLiveClock(remote?.clock, remote?.version ?? 0);
  const [editor, setEditor] = useState<Editor>(null);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [reclaimKey, setReclaimKey] = useState("");
  const logRef = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [stack, setStack] = useState("200");
  const [smallBlind, setSmallBlind] = useState(String(view.smallBlind));
  const [bigBlind, setBigBlind] = useState(String(view.bigBlind));
  const [amount, setAmount] = useState("");
  const turnKey = `${view.handNumber}:${view.street ?? "none"}:${view.toAct ?? "none"}`;
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (seenTurn !== turnKey) {
    setSeenTurn(turnKey);
    setAmount(view.presets ? String(view.presets.min) : "");
  }

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [view.log.length, view.handNumber]);

  const inHand = view.phase === "betting";
  const ready = view.seats.filter((seat) => seat.occupied && !seat.away && seat.stack > 0).length;

  function openSit(seat: number) {
    if (remote && you !== null) return;
    setName("");
    setStack("200");
    setEditor({ kind: "sit", seat });
  }

  function copyText(value: string, mark: (copied: boolean) => void) {
    void navigator.clipboard.writeText(value).then(() => {
      mark(true);
      window.setTimeout(() => mark(false), 1200);
    });
  }

  function copyLink() {
    if (!remote) return;
    copyText(`${window.location.origin}/t/${remote.code}`, setCopied);
  }

  function openAdd(seat: number) {
    setStack("100");
    setEditor({ kind: "add", seat });
  }

  function openBlinds() {
    setSmallBlind(String(view.smallBlind));
    setBigBlind(String(view.bigBlind));
    setEditor({ kind: "blinds" });
  }

  function submitEditor(event: FormEvent) {
    event.preventDefault();
    if (editor?.kind === "sit") {
      send({ type: "sit", seat: editor.seat, name, stack: Number(stack) });
    } else if (editor?.kind === "add") {
      send({ type: "addChips", seat: editor.seat, amount: Number(stack) });
    } else if (editor?.kind === "blinds") {
      send({ type: "setBlinds", smallBlind: Number(smallBlind), bigBlind: Number(bigBlind) });
    }
    setEditor(null);
  }

  function act(action: LegalAction["action"], value?: number) {
    if (view.toAct === null) return;
    send({ type: "act", seat: view.toAct, action, amount: value });
  }

  function sendRaise() {
    if (view.toAct === null) return;
    const value = Number(amount);
    const raise = view.validActions.find((item) => item.action === "raise");
    const allIn = view.validActions.find((item) => item.action === "all_in");
    if (raise && raise.action === "raise" && Number.isInteger(value) && value >= raise.min && value <= raise.max) {
      act("raise", value);
      return;
    }
    if (allIn && allIn.action === "all_in" && value === allIn.amount) {
      act("all_in");
      return;
    }
    act("raise", value);
  }

  const raise = view.validActions.find((item) => item.action === "raise");
  const call = view.validActions.find((item) => item.action === "call");
  const check = view.validActions.some((item) => item.action === "check");
  const fold = view.validActions.some((item) => item.action === "fold");
  const allIn = view.validActions.find((item) => item.action === "all_in");

  return (
    <main className="screen">
      <header className="top">
        <div>
          <p className="kicker">{remote ? `TABLE ${remote.code}` : "TABLE 01"}</p>
          <h1>No Limit</h1>
        </div>
        <p className="status">
          {view.handNumber === 0 ? "NO HAND" : `HAND ${String(view.handNumber).padStart(6, "0")}`}
          <span>BLINDS {view.smallBlind}/{view.bigBlind}</span>
          <span>{view.street ? view.street.toUpperCase() : "WAITING"}</span>
          {remote?.link === "reconnecting" && <span>RECONNECTING</span>}
          {clock.remainMs !== null && <span>{Math.ceil(clock.remainMs / 1000)}s</span>}
        </p>
        <div className="top-actions">
          <Link className="t" href="/">
            [TABLES]
          </Link>
          {remote && (
            <button type="button" className="t" onClick={copyLink}>
              [{copied ? "COPIED" : "COPY LINK"}]
            </button>
          )}
          {remote?.seatKey && (
            <button type="button" className="t" onClick={() => copyText(remote.seatKey!, setCopiedKey)}>
              [{copiedKey ? "COPIED" : "COPY SEAT KEY"}]
            </button>
          )}
          <button type="button" className="t" onClick={openBlinds} disabled={inHand || (remote ? you === null : false)}>
            [BLINDS]
          </button>
          <button
            type="button"
            className="t"
            onClick={() => send({ type: "startHand" })}
            disabled={inHand || ready < 2 || (remote ? you === null : false)}
          >
            [START]
          </button>
        </div>
      </header>

      {remote && you === null && (
        <form
          className="editor"
          onSubmit={(event) => {
            event.preventDefault();
            const key = reclaimKey.trim();
            if (key) remote.onReclaim(key);
          }}
        >
          <label>
            Seat key
            <input
              value={reclaimKey}
              onChange={(event) => setReclaimKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="t">
            [RECLAIM]
          </button>
          {remote.unknownKey && <p className="error">That seat key is not at this table.</p>}
        </form>
      )}

      {editor && (
        <form className="editor" onSubmit={submitEditor}>
          {editor.kind === "sit" && (
            <>
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} required autoFocus />
              </label>
              <label>
                Stack
                <input value={stack} onChange={(event) => setStack(event.target.value)} inputMode="numeric" required />
              </label>
            </>
          )}
          {editor.kind === "add" && (
            <label>
              Add chips to {view.seats[editor.seat]?.name}
              <input value={stack} onChange={(event) => setStack(event.target.value)} inputMode="numeric" required autoFocus />
            </label>
          )}
          {editor.kind === "blinds" && (
            <>
              <label>
                Small blind
                <input value={smallBlind} onChange={(event) => setSmallBlind(event.target.value)} inputMode="numeric" required />
              </label>
              <label>
                Big blind
                <input value={bigBlind} onChange={(event) => setBigBlind(event.target.value)} inputMode="numeric" required />
              </label>
            </>
          )}
          <div className="top-actions">
            <button type="submit" className="t">
              [{editor.kind === "sit" ? "SIT" : editor.kind === "add" ? "ADD" : "SET"}]
            </button>
            <button type="button" className="t" onClick={() => setEditor(null)}>
              [CANCEL]
            </button>
          </div>
        </form>
      )}

      <section className="table-fig" aria-label="Eight seat hold'em table">
        <div className="felt" />
        <div className="center">
          <div className="board">
            {Array.from({ length: 5 }, (_, index) => {
              const dealt = view.board[index];
              return <CardFace key={index} value={dealt ?? "slot"} />;
            })}
          </div>
          {view.pots.length === 0 ? (
            <p className="pot">POT {chips(view.pot)}</p>
          ) : (
            view.pots.map((pot) => (
              <p key={pot.name} className="pot">
                {pot.name} {chips(pot.amount)}
              </p>
            ))
          )}
        </div>
        {view.seats.map((seat) => (
          <Seat
            key={seat.seat}
            seat={seat}
            mine={you === seat.seat}
            winner={view.result?.winners.some((item) => item.seat === seat.seat && item.net > 0) ?? false}
            locked={inHand}
            canSit={!remote || you === null}
            canManage={!remote || you === seat.seat}
            canBoot={Boolean(remote?.host) && you !== seat.seat}
            onBoot={() => send({ type: "boot", seat: seat.seat })}
            onSit={() => openSit(seat.seat)}
            onLeave={() => send({ type: "leave", seat: seat.seat })}
            onAway={() => send({ type: seat.away ? "back" : "away", seat: seat.seat })}
            onAdd={() => openAdd(seat.seat)}
          />
        ))}
      </section>

      <section className="action" aria-live="polite">
        {view.error && <p className="error">{view.error}</p>}
        {view.result && <p className="result">{view.result.text}</p>}
        {!remote && view.revealRequired && (
          <p className="turn">
            {view.actorName} to act
            <button type="button" className="t" onClick={local.reveal}>
              [REVEAL]
            </button>
          </p>
        )}
        {remote && clock.pauseMs > 0 && (
          <p className="turn">{(view.street ?? "hand").toUpperCase()} {Math.ceil(clock.pauseMs / 1000)}s</p>
        )}
        {remote && clock.dealMs !== null && (
          <p className="hint">Next hand in {Math.ceil(clock.dealMs / 1000)}s. Sit out to skip it.</p>
        )}
        {remote && view.toAct !== null && you !== view.toAct && clock.pauseMs === 0 && (
          <p className="turn">{view.actorName} to act</p>
        )}
        {(remote ? you === view.toAct && view.toAct !== null && clock.pauseMs === 0 : !view.revealRequired && view.toAct !== null) && (
          <div className="controls">
            <p className="turn">{remote ? "You to act" : `${view.actorName} to act`}</p>
            <div className="buttons">
              {fold && (
                <button type="button" className="t" onClick={() => act("fold")}>
                  [FOLD]
                </button>
              )}
              {check && (
                <button type="button" className="t" onClick={() => act("check")}>
                  [CHECK]
                </button>
              )}
              {call && call.action === "call" && (
                <button type="button" className="t" onClick={() => act("call")}>
                  [CALL {chips(call.amount)}]
                </button>
              )}
              {raise && raise.action === "raise" && view.presets && (
                <>
                  <label className="raise">
                    Raise to
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      inputMode="numeric"
                      aria-label="Raise to"
                    />
                  </label>
                  <button type="button" className="t" onClick={() => setAmount(String(view.presets!.min))}>
                    [MIN]
                  </button>
                  <button type="button" className="t" onClick={() => setAmount(String(view.presets!.half))}>
                    [1/2 POT]
                  </button>
                  <button type="button" className="t" onClick={() => setAmount(String(view.presets!.pot))}>
                    [POT]
                  </button>
                  <button type="button" className="t" onClick={sendRaise}>
                    [RAISE]
                  </button>
                </>
              )}
              {allIn && allIn.action === "all_in" && (
                <button type="button" className="t" onClick={() => act("all_in")}>
                  [ALL-IN {chips(allIn.amount)}]
                </button>
              )}
            </div>
          </div>
        )}
        {remote && you === null && inHand && <p className="hint">A hand is in progress. Sit when it ends.</p>}
        {remote && you === null && !inHand && <p className="hint">Take an open seat. The link is the invite.</p>}
        {!inHand && ready < 2 && (!remote || you !== null) && <p className="hint">Sit at least two players, then deal.</p>}
      </section>

      <section className="log" aria-label="Hand log" ref={logRef}>
        {view.log.length === 0 && <p className="hint">Blinds, bets, and the showdown land here.</p>}
        {view.log.map((entry, index) => (
          <p key={`${entry.text}-${index}`}>{entry.text}</p>
        ))}
      </section>
    </main>
  );
}

function Seat({
  seat,
  mine,
  winner,
  locked,
  canSit,
  canManage,
  canBoot,
  onBoot,
  onSit,
  onLeave,
  onAway,
  onAdd,
}: {
  seat: PublicSeat;
  mine: boolean;
  winner: boolean;
  locked: boolean;
  canSit: boolean;
  canManage: boolean;
  canBoot: boolean;
  onBoot: () => void;
  onSit: () => void;
  onLeave: () => void;
  onAway: () => void;
  onAdd: () => void;
}) {
  const pos = SEAT_POS[seat.seat]!;
  return (
    <article
      className={`seat${seat.toAct ? " turn" : ""}${winner ? " win" : ""}${seat.folded ? " out" : ""}${mine ? " you" : ""}`}
      style={pos}
    >
      {seat.hole && (
        <div className="hole">
          {seat.hole === "down" ? (
            <>
              <CardFace value="down" />
              <CardFace value="down" />
            </>
          ) : (
            seat.hole.map((item) => <CardFace key={item} value={item} />)
          )}
        </div>
      )}
      {seat.occupied ? (
        <>
          <p className="who">
            {seat.name}
            {mine && <span> YOU</span>}
            {seat.button && <span> D</span>}
            {seat.smallBlind && <span> SB</span>}
            {seat.bigBlind && <span> BB</span>}
            {seat.away && <span> AWAY</span>}
          </p>
          <p className="meta">{chips(seat.stack)}{seat.streetCommitted > 0 ? ` · IN ${chips(seat.streetCommitted)}` : ""}</p>
          {seat.lastAction && <p className="act">{seat.lastAction}</p>}
          {!locked && (canManage || canBoot) && (
            <p className="seat-actions">
              {canManage && (
                <>
                  <button type="button" className="t" onClick={onAdd}>[ADD]</button>
                  <button type="button" className="t" onClick={onAway}>{seat.away ? "[BACK]" : "[AWAY]"}</button>
                  <button type="button" className="t" onClick={onLeave}>[LEAVE]</button>
                </>
              )}
              {canBoot && (
                <button type="button" className="t" onClick={onBoot}>[CLEAR]</button>
              )}
            </p>
          )}
        </>
      ) : canSit ? (
        <button type="button" className="t" onClick={onSit} disabled={locked}>
          [OPEN]
        </button>
      ) : (
        <p className="meta">OPEN</p>
      )}
    </article>
  );
}

function CardFace({ value }: { value: Card | VisibleHole | "slot" }) {
  if (value === "slot" || value === null) return <span className="cd slot" />;
  if (value === "down") return <span className="cd down" aria-hidden="true" />;
  if (Array.isArray(value)) return null;
  const { rank, suit } = cardParts(value);
  return (
    <span className="cd">
      <span>{rank}</span>
      <span>{suit}</span>
    </span>
  );
}

function chips(value: number): string {
  return value.toLocaleString("en-US");
}

function useLiveClock(clock: RoomClock | undefined, version: number): RoomClock {
  const [tick, setTick] = useState(0);
  const anchor = useRef({ version, at: Date.now() });
  if (anchor.current.version !== version) anchor.current = { version, at: Date.now() };
  useEffect(() => {
    if (!clock) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(id);
  }, [clock, version]);
  void tick;
  if (!clock) return { pauseMs: 0, remainMs: null, dealMs: null };
  const elapsed = Date.now() - anchor.current.at;
  return {
    pauseMs: Math.max(0, clock.pauseMs - elapsed),
    remainMs: clock.remainMs === null ? null : Math.max(0, clock.remainMs - elapsed),
    dealMs: clock.dealMs === null ? null : Math.max(0, clock.dealMs - elapsed),
  };
}
