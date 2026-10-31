"use client";

import { useReducer } from "react";
import { apply, createTable } from "@/lib/poker/engine";
import type { Command, TableState } from "@/lib/poker/types";
import { projectView, type PublicView } from "@/lib/poker/view";

type Session = {
  table: TableState;
  revealed: boolean;
};

type Action = Command | { type: "reveal" };

function reducer(session: Session, action: Action): Session {
  if (action.type === "reveal") return { ...session, revealed: true };
  const table = apply(session.table, action);
  const sameActor =
    table.phase === "betting" &&
    table.toAct !== null &&
    table.toAct === session.table.toAct &&
    table.handNumber === session.table.handNumber;
  return { table, revealed: sameActor ? session.revealed : false };
}

export function useTable(): {
  view: PublicView;
  send: (command: Command) => void;
  reveal: () => void;
} {
  const [session, dispatch] = useReducer(reducer, undefined, () => ({
    table: createTable(),
    revealed: false,
  }));
  return {
    view: projectView(session.table, session.revealed),
    send: (command) => dispatch(command),
    reveal: () => dispatch({ type: "reveal" }),
  };
}
