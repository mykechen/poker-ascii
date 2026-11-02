"use client";

import { useEffect, useRef, useState } from "react";
import type { Command } from "@/lib/poker/types";
import type { PublicView } from "@/lib/poker/view";
import { TableScreen } from "./TableScreen";

type RoomClock = {
  pauseMs: number;
  remainMs: number | null;
  dealMs: number | null;
};

type Snapshot = {
  code: string;
  version: number;
  you: number | null;
  host: boolean;
  known: boolean;
  seatKey: string | null;
  clock: RoomClock;
  view: PublicView;
  token?: string;
};

export function RemoteTable({ code }: { code: string }) {
  const room = code.toUpperCase();
  const storageKey = `nlhe-token:${room}`;
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [missing, setMissing] = useState(false);
  const [link, setLink] = useState<"live" | "reconnecting">("live");
  const version = useRef(-1);

  useEffect(() => {
    setToken(sessionStorage.getItem(storageKey));
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        try {
          const params = new URLSearchParams({ since: String(version.current) });
          if (token) params.set("token", token);
          const response = await fetch(`/api/tables/${room}?${params}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.status === 404) {
            if (!cancelled) setMissing(true);
            return;
          }
          if (!response.ok) throw new Error("status");
          const body = (await response.json()) as Snapshot;
          if (cancelled) return;
          if (body.version >= version.current) {
            version.current = body.version;
            setSnap(body);
            setLink("live");
            setMissing(false);
          }
        } catch {
          if (cancelled || controller.signal.aborted) return;
          setLink("reconnecting");
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, token, room]);

  async function send(command: Command | { type: "boot"; seat: number }) {
    try {
      const response = await fetch(`/api/tables/${room}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, command }),
      });
      const body = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) {
        setSnap((current) =>
          current
            ? { ...current, view: { ...current.view, error: body.error ?? "The table refused that." } }
            : current,
        );
        return;
      }
      if (body.token && body.token !== token) {
        sessionStorage.setItem(storageKey, body.token);
        setToken(body.token);
      }
      version.current = body.version;
      setSnap(body);
      setLink("live");
    } catch {
      setLink("reconnecting");
    }
  }

  if (missing) {
    return (
      <main className="screen">
        <p className="kicker">TABLE {room}</p>
        <h1>That table is gone</h1>
        <p className="hint">That code does not match a table.</p>
        <p>
          <a className="t" href="/">
            [TABLES]
          </a>
        </p>
      </main>
    );
  }

  if (!snap) {
    return (
      <main className="screen">
        <p className="hint">{link === "reconnecting" ? "Reconnecting to the table." : "Looking up the table."}</p>
      </main>
    );
  }

  return (
    <TableScreen
      remote={{
        view: snap.view,
        you: snap.you,
        host: snap.host,
        seatKey: snap.seatKey,
        clock: snap.clock,
        version: snap.version,
        code: snap.code,
        send,
        link,
        unknownKey: Boolean(token) && !snap.known,
        onReclaim: (key) => {
          sessionStorage.setItem(storageKey, key);
          version.current = -1;
          setToken(key);
        },
      }}
    />
  );
}
