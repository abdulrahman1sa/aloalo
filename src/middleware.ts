import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
    matcher: [
        // تخطى ملفات Next.js الداخلية والملفات الثابتة
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // دائماً شغّل لمسارات API
        "/(api|trpc)(.*)",
    ],
};
