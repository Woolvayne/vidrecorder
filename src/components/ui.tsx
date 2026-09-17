"use client";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Button ----------
type BtnVariant = "primary" | "soft" | "ghost" | "outline" | "danger" | "success";
type BtnSize = "xs" | "sm" | "md" | "lg";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<BtnVariant, string> = {
  primary: "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:brightness-110 border border-violet-400/30",
  soft: "bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1] border border-white/[0.06]",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]",
  outline: "border border-white/10 text-zinc-200 hover:border-white/25 hover:bg-white/[0.04]",
  danger: "bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20",
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25",
};
const sizes: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-8.5 px-3.5 text-[13px] gap-2 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "soft", size = "md", loading, icon, className, children, disabled, ...rest }, ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
        "disabled:opacity-45 disabled:pointer-events-none cursor-pointer",
        variants[variant], sizes[size], className
      )}
      disabled={disabled || loading}
      {...(rest as object)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </motion.button>
  );
});

// ---------- Card ----------
export function Card({ className, children, interactive, ...rest }: { className?: string; children: ReactNode; interactive?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-[#10121a]/90 backdrop-blur",
        interactive && "transition-all duration-200 hover:border-white/[0.12] hover:bg-[#12141d] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 cursor-pointer",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------- Inputs ----------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100",
        "placeholder:text-zinc-600 outline-none transition-colors",
        "focus:border-violet-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20",
        className
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 leading-relaxed",
        "placeholder:text-zinc-600 outline-none transition-colors resize-none",
        "focus:border-violet-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20",
        className
      )}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full h-10 px-3 rounded-xl bg-[#14161f] border border-white/[0.08] text-sm text-zinc-100 outline-none cursor-pointer",
        "focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 appearance-none",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}

// ---------- Badge ----------
const badgeTones = {
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  blue: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  zinc: "bg-white/[0.06] text-zinc-400 border-white/[0.08]",
} as const;
export function Badge({ tone = "zinc", className, children }: { tone?: keyof typeof badgeTones; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

// ---------- Switch ----------
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 cursor-pointer group">
      <span className={cn(
        "relative w-9 h-5 rounded-full transition-colors duration-200",
        checked ? "bg-violet-500" : "bg-white/10 group-hover:bg-white/15"
      )}>
        <span className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all duration-200",
          checked ? "left-[18px]" : "left-0.5"
        )} />
      </span>
      {label && <span className="text-sm text-zinc-300">{label}</span>}
    </button>
  );
}

// ---------- Slider row ----------
export function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 w-20 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step ?? 1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500 h-1"
      />
      <span className="text-xs text-zinc-400 w-12 text-right tabular-nums">{format ? format(value) : value}</span>
    </div>
  );
}

// ---------- Progress ----------
export function ProgressBar({ value, className, tone = "violet" }: { value: number; className?: string; tone?: "violet" | "green" | "amber" }) {
  const colors = { violet: "from-violet-500 to-indigo-400", green: "from-emerald-500 to-teal-400", amber: "from-amber-500 to-orange-400" };
  return (
    <div className={cn("h-1.5 rounded-full bg-white/[0.07] overflow-hidden", className)}>
      <motion.div
        className={cn("h-full rounded-full bg-gradient-to-r", colors[tone])}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ duration: 0.25 }}
      />
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={cn("relative w-full rounded-2xl border border-white/10 bg-[#12141d] shadow-2xl shadow-black/60", wide ? "max-w-3xl" : "max-w-lg")}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="font-semibold text-zinc-100">{title}</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="size-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-500 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-zinc-200">{title}</h3>
      {desc && <p className="text-sm text-zinc-500 mt-1.5 max-w-sm">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------- Spinner ----------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-violet-400", className)} />;
}

// ---------- Skeleton ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-xl bg-white/[0.05] animate-pulse", className)} />;
}
