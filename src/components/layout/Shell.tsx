"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Hash, Settings, Volume2, Plus, Mic,
    LayoutGrid, ShieldCheck, Paintbrush,
    CheckCircle, Lock, Monitor, Sun, Droplets
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatArea } from "@/components/chat/ChatArea";
import { VoiceRoom } from "@/components/chat/VoiceRoom";

interface Channel {
    id: string;
    name: string;
    type: "text" | "voice";
}

interface Server {
    id: string;
    name: string;
    initial: string;
}

// ─────────────────────────────────────────────────────────
// TODO: Replace these static definitions with API/DB data
// ─────────────────────────────────────────────────────────
const DEFAULT_CHANNELS: Channel[] = [
    { id: "general", name: "عام", type: "text" },
    { id: "voice-1", name: "غرفة صوتية 1", type: "voice" },
];

const DEFAULT_SERVERS: Server[] = [
    { id: "main", name: "ALO", initial: "A" },
];


// ─────────────────────────────────────────────────────────

const THEMES = [
    { id: "", label: "داكن (OLED)", icon: Monitor, preview: "bg-[#020202]" },
    { id: "theme-light", label: "فاتح", icon: Sun, preview: "bg-white" },
    { id: "theme-ocean", label: "المحيط", icon: Droplets, preview: "bg-[#081121]" },
];

export function Shell() {
    const { user, isLoaded } = useUser();
    const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
    const [activeChannelId, setActiveChannelId] = useState(DEFAULT_CHANNELS[0].id);
    const [activeServerId, setActiveServerId] = useState(DEFAULT_SERVERS[0].id);
    const [isMuted, setIsMuted] = useState(false);
    const [theme, setTheme] = useState("");
    const [showThemePanel, setShowThemePanel] = useState(false);

    // ─── Modal State ───
    const [showAddChannel, setShowAddChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");

    // ─── بيانات المستخدم الحقيقية من Clerk ───
    const currentUserName = user?.username ?? user?.firstName ?? "مستخدم";
    const currentUserAvatar = user?.imageUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id ?? "default"}`;
    const currentUserId = user?.id ?? "guest";

    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const invitedChannel = params.get("channel");
        if (invitedChannel) {
            setActiveChannelId(invitedChannel);
            if (!channels.find(c => c.id === invitedChannel)) {
                // Add dynamically if not in list
                setChannels(prev => [...prev, { id: invitedChannel, name: `غرفة مضافة (${invitedChannel.substring(0, 4)})`, type: "text" }]);
            }
        }
    }, []);

    const handleCreateChannel = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newChannelName.trim()) return;
        const newChannel: Channel = {
            id: `ch-${Date.now()}`,
            name: newChannelName.trim(),
            type: newChannelType
        };
        setChannels([...channels, newChannel]);
        setActiveChannelId(newChannel.id);
        setShowAddChannel(false);
        setNewChannelName("");
    };

    const activeChannel = channels.find(c => c.id === activeChannelId) ?? channels[0];

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans select-none" dir="rtl">

            {/* ──── Servers Rail ──── */}
            <nav className="w-16 md:w-20 bg-secondary flex flex-col items-center py-5 gap-4 border-l border-white/5 no-scrollbar overflow-y-auto z-50">
                {/* Home / Discovery */}
                <div className="group relative flex items-center justify-center w-full">
                    <div className="absolute right-0 w-1 h-8 bg-primary rounded-l-full scale-0 group-hover:scale-100 transition-all origin-right" />
                    <div className="w-11 h-11 bg-white/5 rounded-[22px] flex items-center justify-center cursor-pointer hover:rounded-[14px] transition-all duration-300 hover:bg-primary text-gray-400 hover:text-white border border-white/[0.06] group-active:scale-90">
                        <LayoutGrid className="w-5 h-5" />
                    </div>
                </div>

                <div className="w-6 h-[1px] bg-white/10 rounded-full" />

                {/* Server Icons */}
                {DEFAULT_SERVERS.map((server) => (
                    <div key={server.id} className="group relative flex items-center justify-center w-full">
                        {activeServerId === server.id && (
                            <div className="absolute right-0 w-1 h-8 bg-primary rounded-l-full" />
                        )}
                        <div
                            onClick={() => setActiveServerId(server.id)}
                            className={cn(
                                "w-11 h-11 flex items-center justify-center cursor-pointer transition-all duration-300 border border-white/[0.06] font-black text-base",
                                activeServerId === server.id
                                    ? "rounded-[16px] bg-primary text-white scale-105 shadow-lg shadow-primary/20"
                                    : "rounded-[24px] bg-white/5 text-gray-400 hover:rounded-[16px] hover:bg-primary hover:text-white"
                            )}
                        >
                            {server.initial}
                        </div>
                    </div>
                ))}

                {/* Add Server */}
                <div className="mt-auto pb-1">
                    <div className="w-11 h-11 bg-white/5 rounded-[24px] flex items-center justify-center cursor-pointer hover:rounded-[16px] transition-all duration-300 hover:bg-success text-success hover:text-white border border-white/[0.06]">
                        <Plus className="w-5 h-5" />
                    </div>
                </div>
            </nav>

            {/* ──── Channel Sidebar ──── */}
            <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-64 md:w-72 bg-secondary-light/20 flex flex-col border-l border-white/5 z-40 backdrop-blur-2xl relative"
            >
                {/* Server Header */}
                <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-background/30 backdrop-blur-xl">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="font-black text-[14px] tracking-wide flex items-center gap-1.5 font-mono">
                            ALO.SA
                            <Lock className="w-3 h-3 text-success/70" />
                        </h1>
                        <span className="text-[9px] text-success/70 font-bold tracking-widest uppercase">خصوصية تامة • مجاني 100%</span>
                    </div>
                    <button
                        aria-label="تخصيص الواجهة"
                        onClick={() => setShowThemePanel(true)}
                        className="p-1.5 text-gray-500 hover:text-primary transition-colors rounded-lg hover:bg-white/5"
                    >
                        <Paintbrush className="w-4 h-4" />
                    </button>
                </header>

                {/* Channels */}
                <div className="flex-1 overflow-y-auto p-2 py-4 space-y-6 no-scrollbar">

                    {/* Text Channels */}
                    <div>
                        <div className="flex items-center justify-between px-3 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[1.5px] text-gray-500">القنوات النصية</span>
                            <button onClick={() => { setNewChannelType("text"); setShowAddChannel(true); }} aria-label="إضافة قناة نصية" className="text-gray-500 hover:text-foreground transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="space-y-[3px]">
                            {channels.filter(c => c.type === "text").map((ch) => (
                                <button
                                    key={ch.id}
                                    onClick={() => setActiveChannelId(ch.id)}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 text-right",
                                        activeChannelId === ch.id
                                            ? "bg-primary/15 text-primary"
                                            : "text-gray-500 hover:text-foreground hover:bg-white/5"
                                    )}
                                >
                                    <Hash className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-[13px] font-bold truncate">{ch.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Voice Channels */}
                    <div>
                        <div className="flex items-center justify-between px-3 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[1.5px] text-gray-500">الغرف الصوتية</span>
                            <button onClick={() => { setNewChannelType("voice"); setShowAddChannel(true); }} aria-label="إضافة غرفة صوتية" className="text-gray-500 hover:text-foreground transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="space-y-[3px]">
                            {channels.filter(c => c.type === "voice").map((ch) => (
                                <button
                                    key={ch.id}
                                    onClick={() => setActiveChannelId(ch.id)}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 text-right",
                                        activeChannelId === ch.id
                                            ? "bg-success/10 text-success border border-success/15"
                                            : "text-gray-500 hover:text-foreground hover:bg-white/5"
                                    )}
                                >
                                    <Volume2 className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-[13px] font-bold truncate">{ch.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* User Card — replace CURRENT_USER with real session */}
                <section className="p-3 border-t border-white/5 bg-background/40 backdrop-blur-xl">
                    <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition-all cursor-pointer group">
                        <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-primary to-indigo-600 p-[1.5px]">
                                <div className="w-full h-full rounded-[10px] bg-background flex items-center justify-center overflow-hidden">
                                    <img
                                        src={currentUserAvatar}
                                        alt={currentUserName}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success border-2 border-background rounded-full" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-foreground truncate">{currentUserName}</p>
                            <p className="text-[10px] text-success/80 font-bold tracking-wide">متصل</p>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                aria-label="كتم الصوت"
                                onClick={() => setIsMuted(!isMuted)}
                                className={cn("p-1.5 rounded-lg transition-all", isMuted ? "text-accent bg-accent/15" : "text-gray-400 hover:text-foreground hover:bg-white/5")}
                            >
                                <Mic className="w-4 h-4" />
                            </button>
                            <button
                                aria-label="الإعدادات"
                                onClick={() => setShowThemePanel(true)}
                                className="p-1.5 text-gray-400 hover:text-foreground hover:bg-white/5 rounded-lg transition-all"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </section>
            </motion.aside>

            {/* ──── Main Content ──── */}
            <main className="flex-1 relative flex flex-col bg-background/60 z-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeChannelId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 h-full"
                    >
                        {activeChannel.type === "text" ? (
                            <ChatArea channelId={activeChannel.id} channelName={activeChannel.name} />
                        ) : (
                            <VoiceRoom roomId={activeChannel.id} roomName={activeChannel.name} />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* ──── Theme Panel ──── */}
                <AnimatePresence>
                    {showThemePanel && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
                            onClick={() => setShowThemePanel(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.93, y: 24 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.93, y: 24 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md bg-secondary/90 backdrop-blur-2xl border border-white/10 rounded-[28px] overflow-hidden shadow-2xl"
                            >
                                <div className="p-6 flex flex-col gap-5">
                                    {/* Close */}
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                                            <Paintbrush className="w-5 h-5 text-primary" />
                                            تخصيص الواجهة
                                        </h2>
                                        <button
                                            aria-label="إغلاق"
                                            onClick={() => setShowThemePanel(false)}
                                            className="p-1.5 text-gray-400 hover:text-foreground bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <Plus className="w-4 h-4 rotate-45" />
                                        </button>
                                    </div>

                                    <p className="text-xs text-success font-bold flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4" />
                                        جميع ميزات التخصيص مجانية 100% — بدون اشتراك
                                    </p>

                                    {/* Theme buttons */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {THEMES.map((t) => {
                                            const Icon = t.icon;
                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setTheme(t.id)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all",
                                                        theme === t.id
                                                            ? "border-primary bg-primary/10"
                                                            : "border-white/5 bg-white/5 hover:border-white/15"
                                                    )}
                                                >
                                                    <div className={cn("w-10 h-10 rounded-xl border border-white/10", t.preview)} />
                                                    <Icon className={cn("w-4 h-4", theme === t.id ? "text-primary" : "text-gray-400")} />
                                                    <span className={cn("text-xs font-bold", theme === t.id ? "text-primary" : "text-gray-400")}>{t.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Privacy note */}
                                    <div className="p-3 rounded-xl bg-success/10 border border-success/15 text-xs text-success/80 font-medium leading-relaxed">
                                        🔒 على عكس ديسكورد وغيره، ALO.SA لا يجمع بياناتك ولا يبيعها. كل الاتصالات الصوتية مشفرة بـ WebRTC.
                                    </div>

                                    <button
                                        onClick={() => setShowThemePanel(false)}
                                        className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        تطبيق
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                    {showAddChannel && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
                            onClick={() => setShowAddChannel(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 10 }}
                                animate={{ scale: 1, y: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-sm bg-secondary border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6"
                            >
                                <h2 className="text-lg font-black text-foreground mb-4">إنشاء قناة جديدة</h2>
                                <form onSubmit={handleCreateChannel} className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1.5 block">النوع</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setNewChannelType("text")} className={cn("flex-1 py-2 rounded-xl text-sm font-bold border", newChannelType === "text" ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-transparent text-gray-400")}>نصية</button>
                                            <button type="button" onClick={() => setNewChannelType("voice")} className={cn("flex-1 py-2 rounded-xl text-sm font-bold border", newChannelType === "voice" ? "bg-success/20 border-success text-success" : "bg-white/5 border-transparent text-gray-400")}>صوتية</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1.5 block">اسم القناة</label>
                                        <input autoFocus type="text" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="مثال: نقاشات-عامة" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button type="button" onClick={() => setShowAddChannel(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">إلغاء</button>
                                        <button type="submit" disabled={!newChannelName.trim()} className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">إنشاء</button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
