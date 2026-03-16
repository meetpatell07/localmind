import { Mic, AudioWaveform, MessageSquare } from "lucide-react";

export default function VoicePage() {
  return (
    <div className="flex flex-col h-full items-center justify-center p-6">
      <div className="text-center space-y-6 animate-fade-in max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center ring-1 ring-primary/10 animate-breathe">
          <Mic className="h-7 w-7 text-primary/50" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-heading font-bold text-foreground">Voice Chat</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Push-to-talk voice conversations with your personal AI.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/70 bg-surface-elevated rounded-full ring-1 ring-border/20">
            <AudioWaveform className="h-3 w-3" aria-hidden="true" />
            Speech-to-Text
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/70 bg-surface-elevated rounded-full ring-1 ring-border/20">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            Voice Response
          </div>
        </div>

        <span className="inline-block px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-primary/60 bg-primary/5 rounded-full ring-1 ring-primary/10">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
