import { useListCompanies, useListCourses, useListSessions } from "@workspace/api-client-react";
import { Building2, BookOpen, Clock, Users, CalendarCheck, TrendingUp } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: companies = [], isLoading: loadingComps } = useListCompanies();
  const { data: courses = [], isLoading: loadingCourses } = useListCourses();
  const { data: sessions = [], isLoading: loadingSessions } = useListSessions();

  const totalHoursTaught = sessions.reduce((acc, curr) => acc + curr.hoursTeached, 0);
  const activeCourses = courses.filter(c => c.hoursRemaining > 0).length;
  const totalStudentsTaught = sessions.reduce((acc, curr) => acc + curr.studentsCount, 0);

  const stats = [
    { label: "Total Companies", value: companies.length, icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active Courses", value: activeCourses, icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Sessions Logged", value: sessions.length, icon: CalendarCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Hours Taught", value: totalHoursTaught, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  const recentSessions = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <PageLayout>
      <div className="mb-8 relative overflow-hidden rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground p-6 sm:p-8 shadow-xl shadow-primary/20">
        <div className="absolute inset-0 opacity-20 bg-[url('/images/dashboard-pattern.png')] bg-cover bg-center mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-1 sm:mb-2">Welcome back!</h1>
            <p className="text-primary-foreground/80 text-sm sm:text-base max-w-md">You've taught {totalStudentsTaught} total students across {courses.length} courses.</p>
          </div>
          <div className="flex sm:inline-flex p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/20 items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-white/80">This Month</p>
              <p className="text-lg sm:text-xl font-bold font-display">{sessions.length} Sessions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold font-display text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
          <h2 className="text-lg font-bold font-display">Recent Sessions</h2>
        </div>
        <div className="divide-y divide-border">
          {recentSessions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No sessions logged yet.</div>
          ) : (
            recentSessions.map((session) => (
              <div key={session.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-secondary/40 transition-colors gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="bg-secondary p-2 sm:p-3 rounded-xl text-center min-w-[52px] sm:min-w-16 flex-shrink-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase">{format(new Date(session.date), 'MMM')}</p>
                    <p className="text-base sm:text-lg font-bold text-foreground leading-tight">{format(new Date(session.date), 'dd')}</p>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground text-sm sm:text-base truncate">{session.courseName} <span className="text-muted-foreground font-normal text-xs sm:text-sm">({session.batch})</span></h3>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" /> <span className="truncate">{session.companyName}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-foreground">{session.studentsCount} Students</p>
                    <p className="text-xs text-destructive">{session.studentsAbsent} Absent</p>
                  </div>
                  <div className="bg-primary/10 text-primary font-bold px-2.5 py-1.5 rounded-lg text-xs sm:text-sm whitespace-nowrap">
                    {session.hoursTeached} {session.hoursTeached === 1 ? 'hr' : 'hrs'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}
