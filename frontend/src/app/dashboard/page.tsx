import { Dashboard } from "@/components/dashboard";
import { RequireSession } from "@/components/require-session";
import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-static";

export const metadata = {
  title: "Dashboard — Prelegal",
};

export default async function DashboardPage() {
  const catalog = await loadCatalog();

  return (
    <RequireSession>
      <Dashboard catalog={catalog} />
    </RequireSession>
  );
}
