"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Copy, CheckCircle, X, Link2, Share2 } from "lucide-react";
import { useState } from "react";

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    channelId: string;
    channelName: string;
    channelType: "text" | "voice";
}

export function InviteModal({ isOpen, onClose, channelId, channelName, channelType }: InviteModalProps) {
    const [copied, setCopied] = useState(false);

    const inviteLink = typeof window !== "undefined"
        ? `${window.location.origin}/?channel=${channelId}`
        : "";

    const handleCopy = async () => {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `انضم إلى ${channelName} في ALO.SA`,
                text: `تمت دعوتك للانضمام إلى ${channelType === "voice" ? "الغرفة الصوتية" : "قناة"} "${channelName}" في ALO.SA`,
                url: inviteLink,
            });
        } else {
            handleCopy();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.92, y: 24, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.92, y: 24, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl shadow-black/50"
                    >
                        {/* Header */}
                        <div className="relative px-6 pt-6 pb-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                                    <Link2 className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white">دعوة إلى {channelName}</h2>
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        {channelType === "voice" ? "🎙️ غرفة صوتية" : "# قناة نصية"} — الرابط صالح للجميع
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="إغلاق"
                                className="absolute top-5 left-5 p-1.5 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-[13px] text-gray-400 leading-relaxed">
                                شارك هذا الرابط مع أصدقائك ليتمكنوا من الانضمام فوراً دون الحاجة لإعداد أي شيء.
                            </p>

                            {/* Link Box */}
                            <div className="flex items-center gap-2 bg-black/30 border border-white/8 rounded-2xl p-1.5 pr-4">
                                <p className="flex-1 text-[12px] text-gray-300 font-mono truncate" dir="ltr">
                                    {inviteLink}
                                </p>
                                <button
                                    onClick={handleCopy}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all flex-shrink-0
                                        ${copied
                                            ? "bg-success/20 text-success border border-success/30"
                                            : "bg-primary text-white hover:bg-indigo-500"
                                        }
                                    `}
                                >
                                    {copied
                                        ? <><CheckCircle className="w-3.5 h-3.5" />تم النسخ!</>
                                        : <><Copy className="w-3.5 h-3.5" />نسخ</>
                                    }
                                </button>
                            </div>

                            {/* Note */}
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-white/3 border border-white/5 rounded-xl">
                                <span className="text-base">🔒</span>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    هذا الرابط آمن — يحتاج المدعو لتسجيل دخول قبل الانضمام
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleShare}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl text-[13px] font-bold transition-all border border-white/5 hover:border-white/10"
                                >
                                    <Share2 className="w-4 h-4" />
                                    مشاركة
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-indigo-500 text-white rounded-2xl text-[13px] font-bold transition-all shadow-lg shadow-primary/20"
                                >
                                    {copied ? <><CheckCircle className="w-4 h-4" />تم!</> : <><Copy className="w-4 h-4" />نسخ الرابط</>}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
