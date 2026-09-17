"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, User, X, Sparkles } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useEditor } from "@/lib/store/editorStore";
import { runAssistant, type ProjectSlice } from "@/lib/ai/assistant";

interface Msg { role: "user" | "assistant"; text: string }

const QUICK = [
  "Make the video faster",
  "Remove all transitions",
  "Make the captions bigger",
  "Change music to epic",
  "Create a stronger hook",
  "Give me a summary",
];

export default function AssistantPanel({ onClose }: { onClose?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm your local editing assistant — no cloud, no API key. Tell me what to change and I'll apply it instantly. Type \"help\" for all commands." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);

  const send = (text: string) => {
    const cmd = text.trim();
    if (!cmd) return;
    setMsgs((m) => [...m, { role: "user", text: cmd }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const st = useEditor.getState();
      const p = st.project;
      if (!p) { setThinking(false); return; }
      const slice: ProjectSlice = {
        title: p.title, scenes: p.scenes, timeline: p.timeline,
        captionStyle: p.captionStyle, musicMood: p.musicMood,
        language: p.language, topic: p.research?.topic ?? p.title,
      };
      const result = runAssistant(cmd, slice);
      if (result.apply) {
        const applied = result.apply(structuredClone(slice));
        st.replaceProject({ ...p, ...applied });
      }
      setMsgs((m) => [...m, { role: "assistant", text: result.reply }]);
      setThinking(false);
    }, 420);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 h-11 flex items-center gap-2 border-b border-white/[0.05] shrink-0">
        <div className="size-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Bot className="size-3.5 text-violet-300" />
        </div>
        <h3 className="text-[13px] font-semibold text-zinc-200">AI Editor Assistant</h3>
        <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-1.5 py-0.5 ml-1">LOCAL</span>
        <div className="flex-1" />
        {onClose && (
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer"><X className="size-4" /></button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`size-6 rounded-lg shrink-0 flex items-center justify-center ${m.role === "user" ? "bg-white/[0.07]" : "bg-violet-500/20"}`}>
              {m.role === "user" ? <User className="size-3 text-zinc-300" /> : <Bot className="size-3.5 text-violet-300" />}
            </span>
            <div className={`rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap ${
              m.role === "user" ? "bg-violet-500/20 text-violet-100 rounded-tr-md" : "bg-white/[0.05] text-zinc-200 rounded-tl-md"
            }`}>{m.text}</div>
          </motion.div>
        ))}
        {thinking && (
          <div className="flex gap-2.5">
            <span className="size-6 rounded-lg bg-violet-500/20 flex items-center justify-center"><Bot className="size-3.5 text-violet-300 animate-pulse" /></span>
            <div className="rounded-2xl rounded-tl-md bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] text-zinc-400 flex items-center gap-2">
              <Sparkles className="size-3.5 animate-spin" /> Applying changes…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/[0.05] shrink-0">
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)}
              className="text-[10px] text-zinc-500 hover:text-violet-300 border border-white/[0.07] hover:border-violet-400/30 rounded-full px-2 py-1 transition-colors cursor-pointer">
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-1.5">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Replace scene 2…" className="!h-9 text-xs" />
          <Button size="sm" variant="primary" type="submit" className="!px-3" icon={<Send className="size-3.5" />} aria-label="Send" />
        </form>
      </div>
    </div>
  );
}
