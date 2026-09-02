"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed.");
      router.push(`/report/${data.id}`);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="h-16 flex items-center px-6 border-b border-black/[0.06]">
        <span className="font-black tracking-tight text-lg">ActLayer</span>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[40px] sm:text-[56px] font-black tracking-tight leading-[1.05] max-w-3xl">
          Is your AI product breaking the EU AI Act?
        </h1>
        <p className="mt-4 text-black/60 max-w-xl text-[16px]">
          Scan any site for EU AI Act transparency gaps and GDPR/cookie-consent issues in under a minute.
          Free scan, exact fixes for what's missing.
        </p>

        <form onSubmit={handleScan} className="mt-8 flex w-full max-w-md gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourdomain.com"
            className="flex-1 h-12 rounded-full px-5 border border-black/15 outline-none focus:border-black/40"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="h-12 px-6 rounded-full bg-black text-white font-bold disabled:opacity-50"
          >
            {loading ? "Scanning…" : "Scan free"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <p className="mt-10 text-[12px] text-black/35">
          A technical/content scan, not legal advice. Built with{" "}
          <a href="https://gysm.io" className="underline hover:text-black">GYSM.IO</a>.
        </p>
      </main>
    </div>
  );
}
