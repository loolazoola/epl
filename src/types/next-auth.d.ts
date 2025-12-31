import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      totalPoints: number;
    };
  }

  interface JWT {
    userId?: string;
    totalPoints?: number;
  }
}