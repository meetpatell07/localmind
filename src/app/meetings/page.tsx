"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CameraVideoIcon,
  StopIcon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  ArrowLeft01Icon,
  Mic01Icon,
  ClipboardIcon,
  CheckListIcon,
  BulbIcon,
  UserGroupIcon,
  FileEditIcon,
  Delete01Icon,
  RefreshIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from "hugeicons-react";

// Web Speech API type shims (not in all TypeScript lib targets)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionItem {
  task: string;
  assignee?: string;
  dueDate?: string;
  priority: string;
}

interface Meeting {
  id: string;
  title: string;
  participants: string[];
  transcript: string;
  summary: string | null;
  actionItems: ActionItem[];
  decisions: string[];
  topics: string[];
  tasksCreated: number;
  durationSeconds: number | null;
  source: string;
  processedAt: string | null;
  createdAt: string;
}

type RecState = "idle" | "recording" | "saving" | "processing" | "done";
type InputMode = "record" | "paste";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1) return `Yesterday`;
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function priorityColor(priority: string) {
  if (priority === "high") return "bg-red-50 text-red-600 border-red-100";
  if (priority === "low")  return "bg-gray-50 text-gray-500 border-gray-100";
  return "bg-amber-50 text-amber-600 border-amber-100";
}

// ── Recording panel ───────────────────────────────────────────────────────────

function RecordingPanel({ onMeetingSaved }: { onMeetingSaved: (m: Meeting) => void }) {
  const [inputMode, setInputMode] = useState<InputMode>("record");
  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [participantsInput, setParticipantsInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTranscriptRef = useRef("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  function cleanup() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    for (const s of streamsRef.current) s.getTracks().forEach((t) => t.stop());
    streamsRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    // Check mic permission
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      streamsRef.current.push(micStream);

      // Try to capture display audio (system audio from the meeting tab)
      let displayStream: MediaStream | null = null;
      try {
        displayStream = await (navigator.mediaDevices.getDisplayMedia as (
          constraints: MediaStreamConstraints & { audio: boolean; video: boolean }
        ) => Promise<MediaStream>)({ audio: true, video: false });
        streamsRef.current.push(displayStream);
      } catch {
        // User cancelled or browser doesn't support — mic-only mode is fine
      }

      // Mix streams for recording
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaStreamSource(micStream).connect(dest);
      if (displayStream) {
        audioCtx.createMediaStreamSource(displayStream).connect(dest);
      }

      // MediaRecorder on mixed stream
      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      recorder.start(1000);

      // Web Speech API for live transcription
      const win = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      };
      const SpeechRecognitionAPI = win.SpeechRecognition ?? win.webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscriptRef.current += result[0].transcript + " ";
            } else {
              interim = result[0].transcript;
            }
          }
          setTranscript(finalTranscriptRef.current);
          setInterimText(interim);
        };
        recognition.onerror = () => {}; // Silent — network or no-speech errors expected
        recognition.start();
        recognitionRef.current = recognition;
      }

      // Timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      setRecState("recording");
    } catch (err) {
      setHasMicPermission(false);
      setStatusMsg(`Microphone access denied. ${String(err)}`);
    }
  }

  async function stopAndSave() {
    const finalTranscript = finalTranscriptRef.current.trim();
    const duration = elapsed;
    cleanup();
    setRecState("saving");
    setStatusMsg("Saving meeting…");

    const participants = participantsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Meeting ${new Date().toLocaleDateString()}`,
          transcript: finalTranscript,
          participants,
          durationSeconds: duration,
          source: "recorded",
        }),
      });
      const data = (await res.json()) as { meeting: Meeting };
      if (!res.ok) throw new Error("Save failed");

      await processAndNotify(data.meeting);
    } catch (err) {
      setStatusMsg(`Error: ${String(err)}`);
      setRecState("idle");
    }
  }

  async function processPastedTranscript() {
    const text = pastedTranscript.trim();
    if (!text) return;
    setRecState("saving");
    setStatusMsg("Saving meeting…");

    const participants = participantsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Meeting ${new Date().toLocaleDateString()}`,
          transcript: text,
          participants,
          source: "pasted",
        }),
      });
      const data = (await res.json()) as { meeting: Meeting };
      if (!res.ok) throw new Error("Save failed");

      await processAndNotify(data.meeting);
    } catch (err) {
      setStatusMsg(`Error: ${String(err)}`);
      setRecState("idle");
    }
  }

  async function processAndNotify(meeting: Meeting) {
    setRecState("processing");
    setStatusMsg("AI is analyzing the transcript…");

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/process`, {
        method: "POST",
      });
      const data = (await res.json()) as { meeting: Meeting };
      if (!res.ok) throw new Error("Processing failed");
      setRecState("done");
      onMeetingSaved(data.meeting);
    } catch {
      // Processing failed but meeting was saved — still navigate to it
      setRecState("done");
      onMeetingSaved(meeting);
    }
  }

  const isRecording = recState === "recording";
  const isBusy = recState === "saving" || recState === "processing";
  const liveText = transcript + (interimText ? interimText : "");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">New Meeting</h2>
        {/* Mode tabs */}
        <div className="flex gap-1 mt-3 bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => !isRecording && setInputMode("record")}
            disabled={isRecording}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              inputMode === "record" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Mic01Icon className="size-3.5" />
            Record
          </button>
          <button
            onClick={() => !isRecording && setInputMode("paste")}
            disabled={isRecording}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              inputMode === "paste" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            <ClipboardIcon className="size-3.5" />
            Paste transcript
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Meeting metadata */}
        <div className="space-y-2.5">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Meeting title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isBusy || recState === "done"}
              placeholder="e.g. Sprint planning, Design review…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Participants <span className="text-gray-400 font-normal">(comma separated)</span>
            </label>
            <input
              type="text"
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              disabled={isBusy || recState === "done"}
              placeholder="e.g. Meet, Sarah, John"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>
        </div>

        {/* ── RECORD mode ── */}
        {inputMode === "record" && (
          <div className="space-y-3">
            {/* Record / stop button */}
            {recState === "idle" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <button
                  onClick={() => void startRecording()}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                >
                  <div className="size-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-200 transition-all group-hover:scale-105 active:scale-95">
                    <CameraVideoIcon className="size-9 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Start recording</span>
                </button>
                <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
                  Your microphone will be transcribed live. You may also be prompted to share your screen audio (optional — captures meeting participants).
                </p>
                {hasMicPermission === false && (
                  <p className="text-xs text-red-500 text-center">{statusMsg}</p>
                )}
              </div>
            )}

            {recState === "recording" && (
              <div className="space-y-3">
                {/* Timer + pulse */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-mono font-medium text-gray-700">
                      {formatDuration(elapsed)}
                    </span>
                    <span className="text-xs text-gray-400">Recording</span>
                  </div>
                  <button
                    onClick={() => void stopAndSave()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors shadow-sm"
                  >
                    <StopIcon className="size-3.5" />
                    Stop & Process
                  </button>
                </div>

                {/* Live transcript */}
                <div
                  ref={transcriptRef}
                  className="h-48 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-sm leading-relaxed text-gray-700"
                >
                  {liveText ? (
                    <>
                      <span>{transcript}</span>
                      {interimText && (
                        <span className="text-gray-400 italic">{interimText}</span>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 text-xs text-center mt-8">
                      Listening… Start speaking to see live transcript.
                    </p>
                  )}
                </div>

                {!recognitionRef.current && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                    Live transcription is not available in this browser. The recording will still be saved — add a transcript manually after stopping.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PASTE mode ── */}
        {inputMode === "paste" && recState === "idle" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 block">
              Paste transcript
              <span className="ml-1 text-gray-400 font-normal">
                (from Google Meet captions, Otter.ai, etc.)
              </span>
            </label>
            <textarea
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              placeholder="Paste the full meeting transcript here…"
              rows={10}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400 resize-y"
            />
            <p className="text-xs text-gray-400">
              {pastedTranscript.length.toLocaleString()} characters
            </p>
          </div>
        )}

        {/* Busy states */}
        {isBusy && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center">
              <Loading03Icon className="size-6 text-blue-500 animate-spin" />
            </div>
            <p className="text-sm text-gray-600 font-medium">{statusMsg}</p>
            {recState === "processing" && (
              <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
                Extracting action items, decisions, and participants… updating memory…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action button */}
      {(inputMode === "paste" && recState === "idle" && pastedTranscript.trim()) && (
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <button
            onClick={() => void processPastedTranscript()}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <CheckmarkCircle01Icon className="size-4" />
            Process with AI
          </button>
        </div>
      )}
    </div>
  );
}

// ── Meeting card ──────────────────────────────────────────────────────────────

function MeetingCard({
  meeting,
  isSelected,
  onClick,
  onDelete,
}: {
  meeting: Meeting;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 transition-all group border-l-2",
        isSelected
          ? "bg-blue-50/60 border-l-blue-500"
          : "border-l-transparent hover:bg-gray-50/80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-[13px] font-semibold truncate",
            isSelected ? "text-gray-900" : "text-gray-700",
          )}>
            {meeting.title}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {formatRelativeDate(meeting.createdAt)}
            {meeting.durationSeconds != null && ` · ${formatDuration(meeting.durationSeconds)}`}
          </p>
          {meeting.processedAt ? (
            <div className="flex items-center gap-2 mt-1.5">
              {meeting.tasksCreated > 0 && (
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  {meeting.tasksCreated} task{meeting.tasksCreated !== 1 ? "s" : ""}
                </span>
              )}
              {meeting.topics?.length > 0 && (
                <span className="text-[10px] text-gray-400 truncate">
                  {meeting.topics.slice(0, 2).join(", ")}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-amber-500 font-medium mt-1.5 block">
              Not yet processed
            </span>
          )}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 mt-0.5"
        >
          <Delete01Icon className="size-3.5" />
        </button>
      </div>
    </button>
  );
}

// ── Meeting details panel ─────────────────────────────────────────────────────

function MeetingDetails({
  meeting,
  onBack,
  onReprocess,
}: {
  meeting: Meeting;
  onBack: () => void;
  onReprocess: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/process`, { method: "POST" });
      if (res.ok) onReprocess();
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft01Icon className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-800 truncate">{meeting.title}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {formatRelativeDate(meeting.createdAt)}
              {meeting.durationSeconds != null && ` · ${formatDuration(meeting.durationSeconds)}`}
              {meeting.participants?.length > 0 && ` · ${meeting.participants.join(", ")}`}
            </p>
          </div>
          {meeting.transcript && (
            <button
              onClick={() => void handleReprocess()}
              disabled={reprocessing}
              title="Re-run AI analysis"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <RefreshIcon className={cn("size-4", reprocessing && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {!meeting.processedAt && (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
            <BulbIcon className="size-4 shrink-0" />
            <span className="text-xs">This meeting has not been processed yet. Click the refresh button to analyze it.</span>
          </div>
        )}

        {/* Summary */}
        {meeting.summary && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileEditIcon className="size-3.5 text-blue-500 shrink-0" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed bg-blue-50/30 border border-blue-100/50 rounded-xl px-4 py-3">
              {meeting.summary}
            </p>
          </section>
        )}

        {/* Action items */}
        {meeting.actionItems?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <CheckListIcon className="size-3.5 text-emerald-500 shrink-0" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Action Items
              </h3>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 ml-auto">
                {meeting.tasksCreated} task{meeting.tasksCreated !== 1 ? "s" : ""} created
              </span>
            </div>
            <div className="space-y-2">
              {meeting.actionItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm"
                >
                  <CheckmarkCircle01Icon className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-700 leading-snug">{item.task}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.assignee && (
                        <span className="text-[11px] text-blue-600 font-medium">
                          → {item.assignee}
                        </span>
                      )}
                      {item.dueDate && (
                        <span className="text-[11px] text-gray-400">
                          Due {new Date(item.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
                    priorityColor(item.priority),
                  )}>
                    {item.priority}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Decisions */}
        {meeting.decisions?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <BulbIcon className="size-3.5 text-violet-500 shrink-0" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Decisions</h3>
            </div>
            <ul className="space-y-2">
              {meeting.decisions.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-gray-700 bg-violet-50/40 border border-violet-100/60 rounded-xl px-3.5 py-2.5"
                >
                  <span className="text-violet-400 font-bold shrink-0 mt-0.5">•</span>
                  {d}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Participants */}
        {meeting.participants?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <UserGroupIcon className="size-3.5 text-gray-400 shrink-0" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Participants</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {meeting.participants.map((p, i) => (
                <span
                  key={i}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
                >
                  {p}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Topics */}
        {meeting.topics?.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Topics covered</h3>
            <div className="flex flex-wrap gap-1.5">
              {meeting.topics.map((t, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Full transcript collapsible */}
        {meeting.transcript && (
          <section>
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider"
            >
              <FileEditIcon className="size-3.5" />
              Full Transcript
              {showTranscript
                ? <ArrowUp01Icon className="size-3.5" />
                : <ArrowDown01Icon className="size-3.5" />}
            </button>
            {showTranscript && (
              <div className="mt-2.5 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {meeting.transcript}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "panel">("list");

  async function loadMeetings() {
    try {
      const res = await fetch("/api/meetings");
      const data = (await res.json()) as { meetings: Meeting[] };
      setMeetings(data.meetings ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMeetings(); }, []);

  function handleMeetingSaved(meeting: Meeting) {
    setMeetings((prev) => [meeting, ...prev.filter((m) => m.id !== meeting.id)]);
    setSelectedMeeting(meeting);
    setShowNew(false);
    setMobileView("panel");
  }

  function handleSelectMeeting(meeting: Meeting) {
    setSelectedMeeting(meeting);
    setShowNew(false);
    setMobileView("panel");
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this meeting?")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedMeeting?.id === id) {
      setSelectedMeeting(null);
      setShowNew(true);
    }
  }

  async function handleReprocess() {
    if (!selectedMeeting) return;
    const res = await fetch(`/api/meetings/${selectedMeeting.id}`);
    const data = (await res.json()) as { meeting: Meeting };
    if (data.meeting) {
      setSelectedMeeting(data.meeting);
      setMeetings((prev) => prev.map((m) => m.id === data.meeting.id ? data.meeting : m));
    }
  }

  const showPanel = showNew || selectedMeeting;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Record, transcribe, and turn meetings into tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowNew(true); setSelectedMeeting(null); setMobileView("panel"); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            <CameraVideoIcon className="size-3.5" />
            New recording
          </button>
          {/* Mobile toggle */}
          <div className="md:hidden flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setMobileView("list")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mobileView === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500",
              )}
            >
              List
            </button>
            <button
              onClick={() => setMobileView("panel")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mobileView === "panel" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500",
              )}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0 mx-4 md:mx-6 mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* Left — meetings list */}
        <div className={cn(
          "flex flex-col w-full md:w-72 shrink-0 md:border-r border-gray-100",
          mobileView === "list" ? "flex" : "hidden md:flex",
        )}>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Past meetings
            </span>
            {meetings.length > 0 && (
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {meetings.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5 animate-pulse">
                    <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!loading && meetings.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 px-6 text-center">
                <CameraVideoIcon className="size-7 text-gray-200" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  No meetings yet. Start a new recording or paste a transcript.
                </p>
              </div>
            )}

            {meetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                isSelected={selectedMeeting?.id === m.id && !showNew}
                onClick={() => handleSelectMeeting(m)}
                onDelete={(e) => void handleDelete(e, m.id)}
              />
            ))}
          </div>
        </div>

        {/* Right — recording panel or meeting details */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          mobileView === "panel" ? "flex" : "hidden md:flex",
        )}>
          {showPanel ? (
            selectedMeeting && !showNew ? (
              <MeetingDetails
                meeting={selectedMeeting}
                onBack={() => setMobileView("list")}
                onReprocess={() => void handleReprocess()}
              />
            ) : (
              <RecordingPanel onMeetingSaved={handleMeetingSaved} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-10">
              <div className="size-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <CameraVideoIcon className="size-8 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Select a meeting or start a new recording</p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Meetings are transcribed, then AI extracts action items, decisions, and updates your memory.
                </p>
              </div>
              <button
                onClick={() => { setShowNew(true); setMobileView("panel"); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
              >
                <CameraVideoIcon className="size-4" />
                New recording
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
