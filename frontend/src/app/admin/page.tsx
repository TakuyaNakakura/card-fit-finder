import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { isAdminConsoleEnabled } from "@/lib/server-flags";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminPage() {
  if (!isAdminConsoleEnabled()) {
    notFound();
  }

  return <AdminConsole />;
}
