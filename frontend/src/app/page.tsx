"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth/session";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getSession() ? "/dashboard/" : "/login/");
  }, [router]);

  return <p className="p-8 text-sm text-brand-gray">Loading…</p>;
}
