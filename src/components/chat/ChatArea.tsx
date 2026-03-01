"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Smile, Paperclip, Hash, Users,
    Search, Phone, Video,
    Mic, MicOff, Camera,
    CameraOff, PhoneOff, Volume2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";

// ─────────────────────────────────────────────────────────
// TODO: Replace these with real auth — e.g. next-auth session
// ─────────────────────────────────────────────────────────
const SESSION_USER = {
    name: "أنت",
    avatarSeed: "user-default",
};

interface Message {
    id: string;
    text: string;
    sender: string;
    avatar?: string;
    channelId: string;
    createdAt: string;
}

interface ChatAreaProps {
    channelId: string;
    channelName: string;
}

export function ChatArea({ channelId, channelName }: ChatAreaProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [activeCall, setActiveCall] = useState<"voice" | "video" | null>(null);
    const [isCamOn, setIsCamOn] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Socket.io connection ──
    useEffect(() => {
        setMessages([]);

        if (socketRef.current) socketRef.current.disconnect();

        socketRef.current = io(process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001", {
            reconnectionAttempts: 5,
            timeout: 6000,
        });

        const socket = socketRef.current;

        socket.on("connect", () => {
            setSocketConnected(true);
            socket.emit("join-channel", channelId); // channel_id in Supabase
        });

        socket.on("disconnect", () => setSocketConnected(false));

        socket.on("history", (history: Message[]) => setMessages(history));

        socket.on("message", (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
        });

        socket.on("typing", (data: { user: string; typing: boolean; channelId: string }) => {
            if (data.user === SESSION_USER.name || data.channelId !== channelId) return;
            setTypingUsers((prev) => {
                const next = new Set(prev);
                data.typing ? next.add(data.user) : next.delete(data.user);
                return next;
            });
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("history");
            socket.off("message");
            socket.off("typing");
            socket.disconnect();
        };
    }, [channelId]);

    // ── Auto-scroll ──
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typingUsers]);

    // ── Send message ──
    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !socketRef.current) return;

        socketRef.current?.emit("message", {
            text: inputValue.trim(),
            sender: SESSION_USER.name,
            channel_id: channelId,
            avatar: SESSION_USER.avatarSeed,
        });
        setInputValue("");
        socketRef.current.emit("typing", { user: SESSION_USER.name, typing: false, channelId });
    };

    // ── Typing indicator ──
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (!socketRef.current) return;

        socketRef.current?.emit("typing", { user: SESSION_USER.name, typing: e.target.value.length > 0, channel_id: channelId });

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            socketRef.current?.emit("typing", { user: SESSION_USER.name, typing: false, channelId });
        }, 3000);
    };

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden" dir="rtl">

            {/* ──── Header ──── */}
            <header className="h-14 px-5 flex items-center justify-between border-b border-white/5 glass-premium sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/15">
                        <Hash className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold text-[14px] text-foreground leading-tight">{channelName}</h2>
                        <p className="text-[10px] text-gray-500">
                            {socketConnected ? (
                                <span className="text-success font-bold">● متصل بالسيرفر</span>
                            ) : (
                                <span className="text-accent font-bold">○ غير متصل — تأكد من تشغيل السيرفر</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        aria-label="بدء مكالمة صوتية"
                        onClick={() => setActiveCall("voice")}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                        <Phone className="w-4 h-4" />
                    </button>
                    <button
                        aria-label="بدء مكالمة فيديو"
                        onClick={() => setActiveCall("video")}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                        <Video className="w-4 h-4" />
                    </button>
                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    <button aria-label="البحث" className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <Search className="w-4 h-4" />
                    </button>
                    <button aria-label="عرض الأعضاء" className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <Users className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* ──── Messages ──── */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4 no-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40 select-none pointer-events-none">
                        <Hash className="w-16 h-16 text-gray-600" strokeWidth={1} />
                        <p className="text-gray-500 font-bold text-sm">لا توجد رسائل بعد. كن أول من يتحدث!</p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        const isMe = msg.sender === SESSION_USER.name;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={cn(
                                    "flex gap-3 max-w-[85%]",
                                    isMe ? "flex-row-reverse mr-auto ml-0" : "flex-row ml-auto mr-0"
                                )}
                            >
                                <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden border border-white/5 bg-secondary-light self-start mt-1">
                                    <img
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.avatar || msg.sender}`}
                                        alt={msg.sender}
                                    />
                                </div>
                                <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                    <div className="flex items-center gap-2 px-1">
                                        <span className={cn("text-[11px] font-bold", isMe ? "text-primary" : "text-gray-400")}>
                                            {isMe ? "أنت" : msg.sender}
                                        </span>
                                        <span className="text-[9px] text-gray-600">
                                            {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed border",
                                        isMe
                                            ? "bg-primary text-white rounded-tr-sm border-primary/50"
                                            : "bg-secondary-light text-foreground rounded-tl-sm border-white/5"
                                    )}>
                                        {msg.text}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Typing indicator */}
                {typingUsers.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-[11px] text-gray-500 font-medium px-2"
                    >
                        <div className="flex gap-[3px] items-end h-3">
                            {[0, 0.15, 0.3].map((delay, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: [3, 10, 3] }}
                                    transition={{ repeat: Infinity, duration: 0.8, delay }}
                                    className="w-1 bg-primary/60 rounded-full"
                                />
                            ))}
                        </div>
                        <span>{[...typingUsers].join("، ")} {typingUsers.size === 1 ? "يكتب..." : "يكتبون..."}</span>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ──── Input ──── */}
            <div className="px-4 md:px-8 py-4 border-t border-white/5 bg-background/80 backdrop-blur-xl">
                <form onSubmit={handleSend} className="flex items-center gap-3 bg-secondary-light/60 border border-white/5 rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                    <button type="button" aria-label="إرفاق ملف" className="p-1.5 text-gray-400 hover:text-white transition-colors">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <button type="button" aria-label="إيموجي" className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors">
                        <Smile className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder={`رسالة إلى #${channelName}...`}
                        className="flex-1 bg-transparent border-none focus:outline-none text-[14px] text-foreground placeholder-gray-500 py-1.5 font-medium"
                    />
                    <button
                        type="submit"
                        aria-label="إرسال"
                        disabled={!inputValue.trim()}
                        className={cn(
                            "p-2.5 rounded-xl transition-all",
                            inputValue.trim()
                                ? "bg-primary text-white hover:bg-primary-dark shadow-lg"
                                : "bg-white/5 text-gray-600 opacity-40 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-4 h-4 rotate-180" />
                    </button>
                </form>
            </div>

            {/* ──── Call Overlay ──── */}
            <AnimatePresence>
                {activeCall && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-8"
                    >
                        <div className="text-center space-y-2">
                            <div className="w-2.5 h-2.5 bg-accent rounded-full animate-pulse mx-auto" />
                            <p className="text-xs font-black text-white/60 uppercase tracking-[3px]">
                                مكالمة {activeCall === "video" ? "فيديو" : "صوتية"} — جاري الاتصال
                            </p>
                        </div>

                        {/* Self avatar */}
                        <div className="w-28 h-28 rounded-[36px] bg-gradient-to-tr from-primary to-indigo-600 p-1.5 shadow-xl shadow-primary/20">
                            <div className="w-full h-full rounded-[30px] bg-background overflow-hidden">
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${SESSION_USER.avatarSeed}`}
                                    alt="أنت"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        <p className="text-lg font-black text-foreground">أنت</p>

                        {/* Controls */}
                        <div className="flex items-center gap-4">
                            <button
                                aria-label={isMuted ? "إلغاء الكتم" : "كتم"}
                                onClick={() => setIsMuted(!isMuted)}
                                className={cn("p-4 rounded-2xl transition-all", isMuted ? "bg-accent/20 text-accent border border-accent/20" : "bg-white/10 text-white hover:bg-white/15")}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>

                            {activeCall === "video" && (
                                <button
                                    aria-label={isCamOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
                                    onClick={() => setIsCamOn(!isCamOn)}
                                    className={cn("p-4 rounded-2xl transition-all", !isCamOn ? "bg-accent/20 text-accent border border-accent/20" : "bg-white/10 text-white hover:bg-white/15")}
                                >
                                    {isCamOn ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
                                </button>
                            )}

                            <button
                                aria-label="إنهاء المكالمة"
                                onClick={() => { setActiveCall(null); setIsMuted(false); setIsCamOn(false); }}
                                className="p-5 bg-accent hover:bg-red-500 text-white rounded-2xl shadow-lg transition-all"
                            >
                                <PhoneOff className="w-7 h-7" />
                            </button>

                            <button aria-label="السماعة" className="p-4 bg-white/10 text-white hover:bg-white/15 rounded-2xl transition-all">
                                <Volume2 className="w-6 h-6" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
