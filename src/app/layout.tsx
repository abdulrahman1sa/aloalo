import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ALO.SA | منصة المحادثة المستقبلية",
  description: "الجيل القادم من منصات المحادثة للمجتمعات العربية — خصوصية تامة ومجاني 100%",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="ar" dir="rtl">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>

          {/* شريط المصادقة — يظهر فقط قبل تسجيل الدخول */}
          <SignedOut>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020202]">
              <div className="flex flex-col items-center gap-8 text-center">
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                    <span className="text-white font-black text-3xl tracking-tight">A</span>
                  </div>
                  <h1 className="text-2xl font-black text-white">ALO.SA</h1>
                  <p className="text-gray-500 text-sm font-medium">منصة التواصل العربية · خصوصية تامة · مجاني 100%</p>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3 w-64">
                  <SignInButton mode="modal">
                    <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-lg shadow-indigo-600/20">
                      تسجيل الدخول
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-base transition-all">
                      إنشاء حساب جديد
                    </button>
                  </SignUpButton>
                </div>

                <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                  بالتسجيل، أنت توافق على شروط الخدمة.<br />
                  لا نبيع بياناتك أبداً — خصوصيتك هي أولويتنا.
                </p>
              </div>
            </div>
          </SignedOut>

          {/* التطبيق الكامل — يظهر فقط بعد تسجيل الدخول */}
          <SignedIn>
            {/* زر المستخدم في الزاوية */}
            <div className="fixed top-3 left-3 z-[9998]">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 rounded-xl",
                  }
                }}
              />
            </div>
            {children}
          </SignedIn>

        </body>
      </html>
    </ClerkProvider>
  );
}
