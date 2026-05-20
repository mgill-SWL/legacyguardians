import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { prisma } from "./lib/prisma";
import { getResend } from "./lib/resend";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      // We override email sending to use Resend instead of SMTP.
      async sendVerificationRequest({ identifier, url, provider }) {
        const resend = getResend();
        const from = provider.from ?? process.env.EMAIL_FROM;
        if (!from) throw new Error("EMAIL_FROM is required");

        const { host } = new URL(url);
        const subject = `Sign in to ${host}`;

        await resend.emails.send({
          from,
          to: identifier,
          subject,
          text: `Sign in to ${host}\n${url}\n\nThis link will expire shortly.`,
          html: `<p>Sign in to <strong>${host}</strong></p><p><a href="${url}">Click here to sign in</a></p><p style="color:#666">This link will expire shortly.</p>`,
        });
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/unauthorized",
  },
  callbacks: {
    async signIn({ account, email }) {
      // Allow only Speedwell Law staff emails for now.
      // Note: for the Email provider, NextAuth calls signIn twice:
      // 1) verification request (email.verificationRequest=true)
      // 2) callback after magic link click
      if (account?.provider === "email" && email?.verificationRequest) {
        const address = (account.providerAccountId || "").toLowerCase();
        const allowedDomains = ["speedwelllaw.com"]; // TODO: expand/parameterize
        const domain = address.split("@").pop() || "";
        return allowedDomains.includes(domain);
      }

      return true;
    },
  },
  events: {
    async createUser({ user }) {
      const email = user.email?.toLowerCase() || "";
      if (!email.endsWith("@speedwelllaw.com")) return;

      const firm = await prisma.firm.findUnique({ where: { slug: "SWL" }, select: { id: true } });
      if (!firm) return;

      await prisma.user.update({
        where: { id: user.id },
        data: { activeFirmId: firm.id },
      });

      await prisma.firmMember.upsert({
        where: { firmId_userId: { firmId: firm.id, userId: user.id } },
        update: {},
        create: {
          firmId: firm.id,
          userId: user.id,
          role: "MEMBER",
          kind: "STAFF",
        },
      });
    },
  },
};
