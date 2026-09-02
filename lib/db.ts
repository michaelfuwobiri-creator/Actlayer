import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Set it in Vercel -> Project -> Settings -> Environment Variables (Neon connection string)."
  );
}

export const sql = neon(process.env.DATABASE_URL);
