import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    try {
        const count = await prisma.message.count();
        console.log("SUCCESS! Message count:", count);
    } catch (e) {
        console.error("PRISMA TEST FAILED", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
