import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminGuard } from "@/components/auth/auth-guard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </AdminGuard>
  );
}
