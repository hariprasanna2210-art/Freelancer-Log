import { Sidebar } from "./sidebar";
import { motion } from "framer-motion";

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        {/* Subtle decorative background blur */}
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/3 opacity-50" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl -z-10 translate-y-1/3 -translate-x-1/4 opacity-50" />
        
        <div className="max-w-7xl mx-auto p-8 lg:p-12 relative z-10">
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
