import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, BookOpen, CalendarDays, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Courses", href: "/courses", icon: BookOpen },
  { name: "Sessions Log", href: "/sessions", icon: CalendarDays },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-72 flex-col bg-card border-r border-border">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display leading-tight">ProTracker</h1>
            <p className="text-xs text-muted-foreground font-medium">Freelance IT Classes</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-4">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform duration-300", isActive ? "" : "group-hover:scale-110")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-secondary/50 rounded-2xl p-4 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold shadow-inner">
              TD
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Trainer Dash</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
