"use client";

import { useEffect, useReducer } from "react";
import type { BotNote } from "@/lib/poker/bot";
import { botActAt, createLocalSession, reduceLocal } from "@/lib/poker/local";
import type { Command } from "@/lib/poker/types";
import { projectView, type PublicView } from "@/lib/poker/view";

export function useTable(): {
  view: PublicView;
  bots: boolean[];
  botNotes: BotNote[];
  botActAt: number | null;
  send: (command: Command) => void;
  reveal: () => void;
  seatBot: (input: { seat: number; name: string; stack: number }) => void;
} {
  const [session, dispatch] = useReducer(reduceLocal, undefined, createLocalSession);
  useEffect(() => {
    dispatch({ type: "botTick", now: Date.now() });
    const id = window.setInterval(() => dispatch({ type: "botTick", now: Date.now() }), 200);
    return () => window.clearInterval(id);
  }, []);
  return {
    view: projectView(session.table, session.revealed),
    bots: session.bots,
    botNotes: session.botNotes,
    botActAt: botActAt(session),
    send: (command) => dispatch(command),
    reveal: () => dispatch({ type: "reveal" }),
    seatBot: (input) => dispatch({ type: "seatBot", ...input }),
  };
}
