import { useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { motion } from "framer-motion";
import { Menu, BookOpen } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/companies": "Companies",
  "/courses": "Courses",
  "/sessions": "Sessions Log",
};

export function PageLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const title = pageTitles[location] ?? "ProTracker";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar drawer */}
      <Sidebar isMobile isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 relative overflow-y-auto flex flex-col min-w-0">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl -z-10 translate-y-1/3 -translate-x-1/4 opacity-50 pointer-events-none" />

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground">{title}</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-10 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
