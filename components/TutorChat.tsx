"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "LEARNER" | "TUTOR";
  content: string;
  createdAt: string;
}

async function fetchHistory(submissionId?: string): Promise<ChatMessage[]> {
  const params = submissionId ? `?submissionId=${encodeURIComponent(submissionId)}` : "";
  const res = await fetch(`/api/coach${params}`);
  const data = (await res.json()) as { messages: ChatMessage[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.messages;
}

async function postMessage(message: string, submissionId?: string): Promise<string> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, submissionId }),
  });
  const data = (await res.json()) as { reply: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.reply;
}

interface TutorChatProps {
  /** Scopes the conversation to one submission ("ask your tutor why" on a results page); omit for the general dashboard chat. */
  submissionId?: string;
  title?: string;
}

/** "Ask your tutor why" — a small persistent chat backed by the full teacher context (profile, ledger, plan, and — when scoped — the submission itself). */
export function TutorChat({ submissionId, title = "Ask your tutor" }: TutorChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    fetchHistory(submissionId)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load chat"))
      .finally(() => setLoaded(true));
  }, [open, loaded, submissionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const optimisticLearnerMsg: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "LEARNER",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticLearnerMsg]);
    setInput("");
    try {
      const reply = await postMessage(text, submissionId);
      setMessages((prev) => [
        ...prev,
        { id: `reply-${Date.now()}`, role: "TUTOR", content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-full border border-violet-300 bg-white px-4 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-700 dark:bg-zinc-950 dark:text-violet-300 dark:hover:bg-violet-950"
      >
        💬 {title}
      </button>
    );
  }

  return (
    <section className="flex max-h-[28rem] flex-col gap-3 rounded-lg border border-violet-300 bg-white p-4 dark:border-violet-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-violet-800 dark:text-violet-300">{title}</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && loaded && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {submissionId
              ? "Ask why you got this band, or what to do next."
              : "Ask your tutor anything about your progress."}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "LEARNER"
                ? "self-end bg-foreground text-background"
                : "self-start bg-violet-100 text-violet-950 dark:bg-violet-900 dark:text-violet-100"
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSend();
          }}
          placeholder="Why did I get this band?"
          disabled={sending}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || input.trim().length === 0}
          className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-50 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </section>
  );
}
