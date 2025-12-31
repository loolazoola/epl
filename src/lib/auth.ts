import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getOrCreateUserProfile } from "@/lib/user";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("SignIn callback triggered:", { user: user.email, account: account?.provider });
      
      if (account?.provider === "google" && user.email) {
        try {
          const { user: dbUser, error } = await getOrCreateUserProfile({
            email: user.email,
            name: user.name || "",
            avatar_url: user.image || null,
          });

          if (error || !dbUser) {
            console.error("Error in signIn callback:", error);
            return false;
          }

          console.log("User created/retrieved successfully:", dbUser.email);
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      console.log("SignIn rejected: not Google provider or no email");
      return false;
    },
    async jwt({ token, user }) {
      if (user && user.email) {
        console.log("JWT callback triggered for user:", user.email);
        // Fetch user data from our database to include in token
        const { getOrCreateUserProfile } = await import("@/lib/user");
        const { user: dbUser } = await getOrCreateUserProfile({
          email: user.email,
          name: user.name || "",
          avatar_url: user.image || null,
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.totalPoints = dbUser.total_points;
          console.log("JWT token updated with user data");
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.totalPoints = token.totalPoints as number;
        console.log("Session callback completed for user:", session.user.email);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};