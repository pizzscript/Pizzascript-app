"use client";

import { useState } from "react";
import { sendMessage } from "@/app/actions";
import type { AgentMessage } from "@/lib/studio/types";
import { useStudio } from "./StudioProvider";

export function AgentThread({ thread, messages, placeholder }: { thread: string; messages: AgentMessage[]; placeholder: string }) {
  const { run, busy } = useStudio();
  const [text, setText] = useState("");

  return (
    <div className="mt-4 space-y-3">
      {messages.map((m) => (
        <p key={m.id} className={m.role === "admin" ? "s-dim pl-4 border-l-2 s-line" : "leading-relaxed"}>
          {m.content}
        </p>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const content = text;
          setText("");
          run("Agent reply", () => sendMessage(thread, content));
        }}
      >
        <input
          className="s-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Message the agent"
        />
        <button type="submit" className="s-btn" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
