"use client";

import {
  ArrowUp,
  BarChart3,
  FileSpreadsheet,
  Lightbulb,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { navigation } from "@/components/dashboard/dashboard-data";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Button } from "@/components/ui/button";
import {
  aiWorkspaceRecoverySuggestions,
  needsAiWorkspaceSuggestions,
  suggestionsForAiWorkspaceAnswer,
} from "@/lib/ai-workspace-suggestions";

type Message = {
  id?: string;
  role: "user" | "assistant";
  text: string;
  exportUrl?: string | null;
  suggestions?: readonly string[] | null;
  context?: { period: string; sources: string[]; limitations: string };
  feedback?: "positive" | "negative";
};

const welcomeMessage: Message = {
  role: "assistant",
  text: "I’m your Supplai business analyst. Ask me about spend, inventory, suppliers, orders, or a report you want to build.",
};

function AnswerText({ text }: { text: string }) {
  const lines = text.split("\n");
  const hasList = lines.some((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line));
  if (!hasList) return <p>{text}</p>;

  return (
    <div className="ai-answer-content">
      {lines
        .filter((line) => !/^\s*(?:[-*]|\d+[.)])\s+/.test(line))
        .map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      <ul>
        {lines.map((line, index) => {
          const match = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/);
          return match ? <li key={`${line}-${index}`}>{match[1]}</li> : null;
        })}
      </ul>
    </div>
  );
}

const suggestions = [
  {
    icon: BarChart3,
    label: "Business snapshot",
    prompt: "Give me a snapshot of this business for the current year.",
  },
  {
    icon: Lightbulb,
    label: "Find opportunities",
    prompt: "Where can this business reduce purchasing costs?",
  },
  {
    icon: FileSpreadsheet,
    label: "Create an Excel report",
    prompt:
      "Create an Excel sheet with inventory, suppliers, stock levels, and last updates.",
  },
];

export function AiWorkspaceShell({
  companyName,
  userName,
}: {
  companyName: string;
  userName: string;
}) {
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai-workspace")
      .then((response) => response.json())
      .then(
        (result: {
          messages?: Array<{ id: string; role: string; content: string }>;
        }) => {
          if (!active || !result.messages?.length) return;
          setMessages(
            result.messages
              .filter(
                (message) =>
                  message.role === "user" || message.role === "assistant",
              )
              .map((message) => ({
                id: message.id,
                role: message.role as Message["role"],
                text: message.content,
                suggestions:
                  message.role === "assistant"
                    ? suggestionsForAiWorkspaceAnswer(message.content)
                    : null,
              })),
          );
        },
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const messageList = messageListRef.current;
      messageList?.scrollTo({
        top: messageList.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, messages]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setPrompt("");
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const response = await fetch("/api/ai-workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const result = (await response.json()) as {
        answer?: string;
        messageId?: string;
        exportUrl?: string | null;
        suggestions?: string[] | null;
        context?: Message["context"];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "The AI workspace is unavailable.");
      setMessages((current) => [
        ...current,
        {
          id: result.messageId,
          role: "assistant",
          text: result.answer ?? "I could not create an answer yet.",
          exportUrl: result.exportUrl,
          suggestions: result.suggestions,
          context: result.context,
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Try again.";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: errorMessage,
          suggestions: needsAiWorkspaceSuggestions(errorMessage)
            ? aiWorkspaceRecoverySuggestions
            : null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function rateMessage(
    messageId: string,
    rating: "positive" | "negative",
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, feedback: rating } : message,
      ),
    );
    await fetch("/api/ai-workspace/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, rating }),
    });
  }

  async function clearChat() {
    if (
      !window.confirm(
        "Delete your AI workspace chat history for this company? This cannot be undone.",
      )
    )
      return;
    setClearing(true);
    try {
      const response = await fetch("/api/ai-workspace", { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to clear the chat.");
      setMessages([welcomeMessage]);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to clear the chat.",
      );
    } finally {
      setClearing(false);
    }
  }

  function chooseSuggestion(messageIndex: number, suggestion: string) {
    setMessages((current) =>
      current.map((message, index) =>
        index === messageIndex ? { ...message, suggestions: null } : message,
      ),
    );
    void ask(suggestion);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(prompt);
  }

  return (
    <div className="app-shell ai-workspace-shell">
      <Sidebar
        items={navigation}
        user={{ initials, name: userName, subtitle: companyName }}
      />
      <main className="ai-workspace-main">
        <header className="ai-workspace-header">
          <div>
            <p className="eyebrow">SUPPLAI AI</p>
            <h1>Your business copilot</h1>
            <p className="subtitle">
              Ask questions, find opportunities, and turn your workspace data
              into useful reports.
            </p>
          </div>
          <span className="ai-live-pill">
            <Sparkles /> Live workspace data
          </span>
        </header>

        <section className="ai-workspace-layout">
          <div className="ai-chat-panel">
            <div className="ai-chat-heading">
              <div className="ai-chat-avatar">
                <Sparkles />
              </div>
              <div className="ai-chat-title">
                <strong>Supplai analyst</strong>
                <span>Grounded in your business records</span>
              </div>
              <button
                className="ai-clear-chat"
                disabled={clearing || loading || messages.length === 1}
                onClick={() => void clearChat()}
                type="button"
              >
                <Trash2 />
                {clearing ? "Clearing…" : "Clear chat"}
              </button>
            </div>
            <div className="ai-message-list" ref={messageListRef}>
              {messages.map((message, index) => (
                <div
                  className={`ai-message ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <AnswerText text={message.text} />
                  {message.suggestions?.length ? (
                    <div className="ai-recovery-suggestions">
                      {message.suggestions.map((suggestion) => (
                        <button
                          disabled={loading}
                          key={suggestion}
                          onClick={() => chooseSuggestion(index, suggestion)}
                          type="button"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.exportUrl ? (
                    <a className="ai-export-link" href={message.exportUrl}>
                      <FileSpreadsheet /> Download Excel report
                    </a>
                  ) : null}
                  {message.role === "assistant" && message.id ? (
                    <div className="ai-message-tools">
                      <button
                        className={
                          message.feedback === "positive" ? "selected" : ""
                        }
                        aria-label="Helpful answer"
                        onClick={() =>
                          void rateMessage(message.id!, "positive")
                        }
                        type="button"
                      >
                        <ThumbsUp />
                      </button>
                      <button
                        className={
                          message.feedback === "negative" ? "selected" : ""
                        }
                        aria-label="Unhelpful answer"
                        onClick={() =>
                          void rateMessage(message.id!, "negative")
                        }
                        type="button"
                      >
                        <ThumbsDown />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="ai-message assistant">
                  <p className="ai-thinking">Reviewing your workspace data…</p>
                </div>
              ) : null}
            </div>
            <form className="ai-prompt-form" onSubmit={submit}>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask about your business or request a report…"
                rows={2}
              />
              <Button
                aria-label="Send question"
                disabled={loading || !prompt.trim()}
                size="icon"
                type="submit"
              >
                <ArrowUp />
              </Button>
            </form>
            <small className="ai-disclaimer">
              AI answers are recommendations. Review before making inventory or
              purchasing decisions.
            </small>
          </div>
          <aside className="ai-suggestions-panel">
            <p className="eyebrow">START WITH A TASK</p>
            <h2>What would you like to explore?</h2>
            <div className="ai-suggestion-list">
              {suggestions.map(
                ({ icon: Icon, label, prompt: suggestionPrompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void ask(suggestionPrompt)}
                  >
                    <span>
                      <Icon />
                    </span>
                    <strong>{label}</strong>
                    <small>{suggestionPrompt}</small>
                    <ArrowUp />
                  </button>
                ),
              )}
            </div>
          </aside>
        </section>
      </main>
      <MobileNavigation
        items={navigation.map(({ label, href, icon }) => ({
          label,
          href,
          icon,
        }))}
      />
    </div>
  );
}
