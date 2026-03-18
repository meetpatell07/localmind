"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic01Icon, MicOff01Icon, VolumeHighIcon, VolumeOffIcon } from "hugeicons-react";
import { cn } from "@/lib/utils";

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

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

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
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
      if (transcript.trim()) sendToChat(transcript.trim());
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setListening(true);
    }
  }

  if (!supported) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 animate-fade-in">
        <div className="size-14 rounded-2xl bg-gray-50 flex items-center justify-center">
          <MicOff01Icon className="size-7 text-gray-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">Speech not supported</p>
          <p className="text-xs text-gray-400 mt-1">Use Chrome or Edge for voice features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-4 shrink-0 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Voice</h1>
            <p className="text-sm text-gray-500 mt-1">
              Push to talk · {turns.length} {turns.length === 1 ? "message" : "messages"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTtsEnabled((v) => !v)}
            className={cn(
              "text-xs gap-1.5 transition-all",
              ttsEnabled
                ? "text-gray-700"
                : "text-gray-400",
            )}
          >
            {ttsEnabled
              ? <VolumeHighIcon className="size-3.5" />
              : <VolumeOffIcon className="size-3.5" />
            }
            {ttsEnabled ? "Voice on" : "Voice off"}
          </Button>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
        {turns.length === 0 && !thinking && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="size-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <Mic01Icon className="size-7 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">Start a conversation</p>
              <p className="text-xs text-gray-400 mt-1">Click the microphone and speak</p>
            </div>
          </div>
        )}

        <div className="space-y-3 max-w-2xl mx-auto">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={cn("flex gap-3", turn.role === "user" ? "justify-end" : "justify-start")}
            >
              {turn.role === "assistant" && (
                <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-400">AI</span>
                </div>
              )}
              <div
                className={cn(
                  "text-sm leading-relaxed px-4 py-2.5 rounded-2xl max-w-[80%]",
                  turn.role === "user"
                    ? "bg-gray-900 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md",
                )}
              >
                {turn.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3">
              <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-gray-400">AI</span>
              </div>
              <div className="bg-gray-100 text-gray-400 text-sm px-4 py-2.5 rounded-2xl rounded-bl-md">
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-gray-400 animate-bounce-dot stagger-1" />
                  <span className="size-1.5 rounded-full bg-gray-400 animate-bounce-dot stagger-2" />
                  <span className="size-1.5 rounded-full bg-gray-400 animate-bounce-dot stagger-3" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transcript + push-to-talk */}
      <div className="px-4 md:px-6 py-6 shrink-0 flex flex-col items-center gap-4 border-t border-gray-100">
        {/* Live transcript */}
        {transcript && (
          <div className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 max-w-sm">
            <p className="text-sm text-gray-600 text-center">{transcript}</p>
          </div>
        )}

        {/* Mic button */}
        <button
          onMouseDown={!listening ? toggleListen : undefined}
          onMouseUp={listening ? toggleListen : undefined}
          onTouchStart={!listening ? toggleListen : undefined}
          onTouchEnd={listening ? toggleListen : undefined}
          onClick={listening ? toggleListen : undefined}
          disabled={thinking}
          className={cn(
            "relative size-16 rounded-full transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed",
            listening
              ? "bg-red-500 shadow-lg shadow-red-200 scale-110"
              : "bg-gray-900 shadow-md hover:shadow-lg hover:scale-105 active:scale-95",
          )}
        >
          <Mic01Icon className={cn(
            "size-6 transition-colors",
            listening ? "text-white animate-pulse" : "text-white",
          )} />
          {listening && (
            <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
          )}
        </button>

        <p className="text-xs text-gray-400">
          {thinking
            ? "Thinking..."
            : listening
            ? "Listening... release to send"
            : "Click or hold to speak"
          }
        </p>
      </div>
    </div>
  );
}
