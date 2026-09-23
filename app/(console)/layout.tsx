import { ConsoleSidebar } from "@/components/console/sidebar";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <ConsoleSidebar />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
