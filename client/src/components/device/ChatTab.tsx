import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { Send } from "lucide-react";
import { LIMITS } from "@shared/constants";
import type { Device } from "@shared/types";
import type { ChatTurn } from "@shared/validation";
import { errorMessage } from "@/lib/api";
import { useChat } from "@/lib/queries";
import { Badge, Button } from "../ui";

interface Message extends ChatTurn {
  id: number;
  fallback?: boolean;
  error?: boolean;
}

function starters(device: Device): string[] {
  if (device.hasError) return [`What does "${device.errorMessage}" mean?`, "What should I try first?", "How do I reset it?"];
  if (!device.isOnline) return ["Why is it offline?", "How do I reconnect it?", "How do I reset it?"];
  return ["Is my firmware current?", "How do I reset it?", "Any maintenance tips?"];
}

/** Device-scoped chat. History lives in component state only and clears on leaving the page. */
export function ChatTab({ device }: { device: Device }) {
  const chat = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll only the conversation box (scrollIntoView would also scroll the phone frame).
    const log = logRef.current;
    if (log && messages.length > 0) log.scrollTop = log.scrollHeight;
  }, [messages, chat.isPending]);

  function ask(question: string, prior: Message[]) {
    const history = prior
      .filter((m) => !m.error)
      .slice(-LIMITS.chatHistoryTurns)
      .map(({ role, content }) => ({ role, content: content.slice(0, LIMITS.chatTurn) }));
    chat.mutate(
      { deviceId: device.id, question, history },
      {
        onSuccess: (res) =>
          setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: res.answer, fallback: res.source === "fallback" }]),
        onError: (err) =>
          setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: errorMessage(err), error: true }]),
      },
    );
  }

  function send(text: string) {
    const question = text.trim().slice(0, LIMITS.chatQuestion);
    if (!question || chat.isPending) return;
    const prior = messages;
    setMessages((m) => [...m, { id: nextId.current++, role: "user", content: question }]);
    setInput("");
    ask(question, prior);
  }

  function retry() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const prior = messages.filter((m) => m.id < lastUser.id);
    setMessages((m) => m.filter((x) => !(x.error && x.id > lastUser.id)));
    ask(lastUser.content, prior);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-2">
        Ask about this {device.type} device. Answers are guidance only; the assistant can't see or control the device.
      </p>
      <div ref={logRef} className="max-h-80 space-y-2 overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {starters(device).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="min-h-10 rounded-full bg-primary/10 px-3 text-left text-sm text-primary hover:bg-primary/15"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={clsx(
                "max-w-[85%] rounded-2xl px-3 py-2 text-[15px] whitespace-pre-wrap",
                m.role === "user" ? "rounded-br-md bg-primary text-white" : m.error ? "rounded-bl-md border border-error/30 bg-error/5" : "rounded-bl-md bg-page",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.fallback ? (
                <Badge className="mb-1">Offline guidance</Badge>
              ) : null}
              {m.error ? <span className="block font-medium text-[#d70015]">Couldn't get an answer.</span> : null}
              <span className="block">{m.content}</span>
              {m.error && m.id === messages[messages.length - 1]?.id ? (
                <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={retry} disabled={chat.isPending}>
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {chat.isPending ? (
          <div className="flex justify-start" role="status">
            <span className="sr-only">Assistant is typing</span>
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-page px-3 py-3" aria-hidden>
              <span className="typing-dot size-2 rounded-full bg-ink-2" />
              <span className="typing-dot size-2 rounded-full bg-ink-2 [animation-delay:150ms]" />
              <span className="typing-dot size-2 rounded-full bg-ink-2 [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about this device
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={LIMITS.chatQuestion}
          placeholder="Ask a question…"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-full border border-line bg-white px-4 text-[15px] focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!input.trim() || chat.isPending}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:bg-primary/40"
        >
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
