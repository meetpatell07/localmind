"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic01Icon, MicOff01Icon, VolumeHighIcon, VolumeOffIcon } from "hugeicons-react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface Turn {
  role: "user" | "assistant";
  text: string;
}

export default function VoicePage() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const interim = Array.from({ length: e.results.length }, (_, i) => e.results[i])
        .map((r) => r[0].transcript)
        .join("");
      setTranscript(interim);
    };

    rec.onend = () => {
      setListening(false);
    };

    rec.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.pitch = 1.0;
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);

  async function sendToChat(text: string) {
    if (!text.trim()) return;
    setThinking(true);
    setTurns((prev) => [...prev, { role: "user", text }]);
    setTranscript("");

    try {
      const messages = [
        ...turns.map((t) => ({ role: t.role, content: t.text })),
        { role: "user" as const, content: text },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, sessionId: sessionIdRef.current }),
      });

      if (res.headers.get("X-Session-Id")) {
        sessionIdRef.current = res.headers.get("X-Session-Id");
      }

      // Read streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // AI SDK data stream format: lines starting with "0:"
          for (const line of chunk.split("\n")) {
            if (line.startsWith("0:")) {
              try {
                const token = JSON.parse(line.slice(2));
                fullText += token;
              } catch {
                // skip malformed
              }
            }
          }
        }
      }

      setTurns((prev) => [...prev, { role: "assistant", text: fullText }]);
      speak(fullText);
    } finally {
      setThinking(false);
    }
  }

  function toggleListen() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      // send whatever was captured
      if (transcript.trim()) sendToChat(transcript.trim());
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setListening(true);
    }
  }

  if (!supported) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <MicOff01Icon className="h-8 w-8 opacity-20" />
        <p className="text-sm opacity-30 text-center max-w-xs">
          Web Speech API not supported in this browser.<br />
          Use Chrome or Edge for voice features.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display italic text-2xl leading-none" style={{ color: "var(--amber)" }}>
              Voice
            </h1>
            <p className="text-sm opacity-25 mt-1">
              push to talk · Web Speech API
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTtsEnabled((v) => !v)}
            className="opacity-40 hover:opacity-70 transition-opacity"
          >
            {ttsEnabled
              ? <VolumeHighIcon className="h-3.5 w-3.5" />
              : <VolumeOffIcon className="h-3.5 w-3.5" />
            }
            {ttsEnabled ? "voice on" : "voice off"}
          </Button>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {turns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
            <Mic01Icon className="h-8 w-8" />
            <p className="text-sm">hold the button and speak</p>
          </div>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`flex gap-3 ${turn.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {turn.role === "assistant" && (
              <span className="text-sm opacity-30 mt-1 shrink-0">ai</span>
            )}
            <div
              className="text-sm leading-relaxed px-3 py-2 rounded-sm max-w-[80%]"
              style={{
                background: turn.role === "user" ? "var(--amber-dim)" : "var(--surface-raised)",
                color: turn.role === "user" ? "var(--amber)" : "hsl(210 18% 75%)",
                border: "1px solid var(--line)",
              }}
            >
              {turn.text}
            </div>
            {turn.role === "user" && (
              <span className="text-sm opacity-30 mt-1 shrink-0">you</span>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex gap-3">
            <span className="text-sm opacity-30 mt-1">ai</span>
            <div
              className="text-sm px-3 py-2 rounded-sm"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", color: "hsl(215 12% 40%)" }}
            >
              <span className="animate-pulse">thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Transcript + push-to-talk */}
      <div
        className="px-6 py-5 shrink-0 flex flex-col items-center gap-4"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        {transcript && (
          <p
            className="text-sm text-center opacity-60 max-w-sm"
            style={{ color: "hsl(210 18% 75%)" }}
          >
            {transcript}
          </p>
        )}
        <Button
          variant="ghost"
          onMouseDown={!listening ? toggleListen : undefined}
          onMouseUp={listening ? toggleListen : undefined}
          onTouchStart={!listening ? toggleListen : undefined}
          onTouchEnd={listening ? toggleListen : undefined}
          onClick={listening ? toggleListen : undefined}
          disabled={thinking}
          className="relative w-16 h-16 rounded-full transition-all disabled:opacity-30"
          style={{
            background: listening
              ? "rgba(240,160,21,0.15)"
              : "var(--surface-raised)",
            border: listening
              ? "2px solid var(--amber)"
              : "2px solid var(--line)",
            boxShadow: listening
              ? "0 0 24px rgba(240,160,21,0.2)"
              : "none",
          }}
        >
          {listening
            ? <Mic01Icon className="h-6 w-6 animate-pulse" style={{ color: "var(--amber)" }} />
            : <Mic01Icon className="h-6 w-6 opacity-50" />
          }
        </Button>
        <p className="text-sm opacity-20">
          {listening ? "listening... click to send" : "click to speak"}
        </p>
      </div>
    </div>
  );
}
