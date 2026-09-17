"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, Wand2, LayoutTemplate, Palette,
  LibraryBig, Clapperboard, Rocket, Settings, Search, Plus, Zap,
  Menu, X, ChevronDown, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/create", label: "Create Video", icon: Wand2 },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/brands", label: "Brand Profiles", icon: Palette },
  { href: "/media", label: "Media Library", icon: LibraryBig },
  { href: "/editor", label: "Editor", icon: Clapperboard },
  { href: "/exports", label: "Exports", icon: Rocket },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 group">
      <div className="size-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
        <Zap className="size-[18px] text-white fill-white" />
      </div>
      <div className="leading-none">
        <div className="font-bold text-[15px] tracking-tight text-zinc-50 font-display">FREE RUSH</div>
        <div className="text-[10px] text-zinc-500 mt-0.5 tracking-wide">Your idea in. Your video out.</div>
      </div>
    </Link>
  );
}

function SystemStatus() {
  const [db, setDb] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((j) => setDb(Boolean(j?.ok))).catch(() => setDb(false));
  }, []);
  return (
    <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07]">
      <span className="relative flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
      </span>
      <span className="text-[11px] font-semibold text-emerald-300 tracking-wide">FREE MODE</span>
      <span className="text-[10px] text-zinc-500">{db === null ? "· checking…" : db ? "· local DB ready" : "· offline fallback"}</span>
    </div>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Creator");
  useEffect(() => {
    setName(localStorage.getItem("freerush.username") || "Creator");
  }, []);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-full hover:bg-white/[0.05] cursor-pointer transition-colors">
        <span className="size-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-[11px] font-bold text-white">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden md:block text-sm text-zinc-300 max-w-28 truncate">{name}</span>
        <ChevronDown className="size-3.5 text-zinc-600" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 z-40 w-52 rounded-xl border border-white/10 bg-[#14161f] shadow-2xl shadow-black/50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-medium text-zinc-200">{name}</p>
                <p className="text-[11px] text-zinc-500">Local profile · no account needed</p>
              </div>
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05]">
                <User className="size-4 text-zinc-500" /> Local profile
              </Link>
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05]">
                <Settings className="size-4 text-zinc-500" /> Settings
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5"><Logo /></div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 h-10 px-3 rounded-xl text-[13.5px] font-medium transition-all duration-150",
                active ? "text-white bg-white/[0.07]" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-gradient-to-b from-violet-400 to-indigo-500"
                />
              )}
              <item.icon className={cn("size-[17px]", active ? "text-violet-300" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3.5">
          <p className="text-[11px] font-semibold text-violet-300 flex items-center gap-1.5">
            <Zap className="size-3.5" /> 100% Free Engine
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            No API keys. All AI, voices, music and rendering run locally.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const isEditor = pathname.startsWith("/editor/");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/projects${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/4 size-[34rem] rounded-full bg-violet-600/[0.07] blur-[120px]" />
        <div className="absolute top-1/3 -right-32 size-[28rem] rounded-full bg-indigo-600/[0.05] blur-[100px]" />
      </div>

      {/* sidebar desktop */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-30 border-r border-white/[0.05] bg-[#0a0b10]/85 backdrop-blur-xl">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* mobile sidebar */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)} />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-60 z-50 bg-[#0a0b10] border-r border-white/[0.06] lg:hidden"
            >
              <button onClick={() => setMobileNav(false)} className="absolute top-5 right-4 text-zinc-500 hover:text-zinc-200 cursor-pointer">
                <X className="size-5" />
              </button>
              <SidebarContent pathname={pathname} onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* main */}
      <div className={cn("relative z-10 transition-none", isEditor ? "lg:pl-60" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 h-16 border-b border-white/[0.05] bg-[#08090d]/80 backdrop-blur-xl">
          <div className="h-full flex items-center gap-3 px-4 lg:px-6">
            <button onClick={() => setMobileNav(true)} className="lg:hidden p-2 -ml-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
              <Menu className="size-5" />
            </button>
            <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="w-full h-9.5 pl-10 pr-4 rounded-full bg-white/[0.04] border border-white/[0.07] text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/15 transition-colors"
              />
            </form>
            <div className="flex-1" />
            <SystemStatus />
            <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => router.push("/create")} className="hidden sm:inline-flex rounded-full">
              New Video
            </Button>
            <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => router.push("/create")} className="sm:hidden rounded-full px-3" aria-label="New Video" />
            <ProfileMenu />
          </div>
        </header>
        <main className={isEditor ? "" : "px-4 lg:px-8 py-6 lg:py-8"}>{children}</main>
      </div>
    </div>
  );
}
