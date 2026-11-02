"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [stack, setStack] = useState("200");
  const [smallBlind, setSmallBlind] = useState("1");
  const [bigBlind, setBigBlind] = useState("2");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createTable(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          stack: Number(stack),
          smallBlind: Number(smallBlind),
          bigBlind: Number(bigBlind),
        }),
      });
      const body = (await response.json()) as { error?: string; code?: string; token?: string };
      if (!response.ok || !body.code || !body.token) {
        setError(body.error ?? "The table did not open.");
        setPending(false);
        return;
      }
      sessionStorage.setItem(`nlhe-token:${body.code}`, body.token);
      router.push(`/t/${body.code}`);
    } catch {
      setError("The table did not open.");
      setPending(false);
    }
  }

  function joinTable(event: FormEvent) {
    event.preventDefault();
    const next = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (next.length < 4) {
      setError("Enter the four character table code.");
      return;
    }
    router.push(`/t/${next}`);
  }

  return (
    <main className="screen lobby">
      <header className="top">
        <div>
          <p className="kicker">NO LIMIT</p>
          <h1>Open a table</h1>
        </div>
        <Link className="t" href="/local">
          [ONE SCREEN]
        </Link>
      </header>
      <p className="hint lobby-lead">
        You get a code and a link. Anyone who opens it sits in an empty seat. The server deals the cards, and each player only sees their own. The opener can also seat a bot in an empty chair. It is marked BOT and plays only that seat.
      </p>
      {error && <p className="error">{error}</p>}
      <form className="editor" onSubmit={createTable}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} required autoFocus />
        </label>
        <label>
          Stack
          <input value={stack} onChange={(event) => setStack(event.target.value)} inputMode="numeric" required />
        </label>
        <label>
          Small blind
          <input value={smallBlind} onChange={(event) => setSmallBlind(event.target.value)} inputMode="numeric" required />
        </label>
        <label>
          Big blind
          <input value={bigBlind} onChange={(event) => setBigBlind(event.target.value)} inputMode="numeric" required />
        </label>
        <button type="submit" className="t" disabled={pending}>
          [{pending ? "OPENING" : "OPEN TABLE"}]
        </button>
      </form>
      <form className="editor" onSubmit={joinTable}>
        <label>
          Table code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            required
          />
        </label>
        <button type="submit" className="t">
          [JOIN]
        </button>
      </form>
    </main>
  );
}
