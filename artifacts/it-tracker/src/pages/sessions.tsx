import { useState } from "react";
import { 
  useListSessions, useCreateSession, useDeleteSession, useListCourses,
  getListSessionsQueryKey, getListCoursesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, Users, UserX, Trash2, StickyNote } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { format } from "date-fns";
import { formatHours } from "@/lib/utils";

export default function Sessions() {
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading: loadingSessions } = useListSessions();
  const { data: courses = [], isLoading: loadingCourses } = useListCourses();
  
  const createMutation = useCreateSession();
  const deleteMutation = useDeleteSession();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Form State
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [hoursTeached, setHoursTeached] = useState("1");
  const [studentsCount, setStudentsCount] = useState("");
  const [studentsAbsent, setStudentsAbsent] = useState("0");
  const [notes, setNotes] = useState("");

  const activeCourses = courses.filter(c => c.hoursRemaining > 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !date || !hoursTeached || !studentsCount || !studentsAbsent) return;
    
    createMutation.mutate({ 
      data: { 
        courseId: Number(courseId),
        date: new Date(date).toISOString(),
        hoursTeached: Number(hoursTeached),
        studentsCount: Number(studentsCount),
        studentsAbsent: Number(studentsAbsent),
        notes: notes || undefined
      } 
    }, {
      onSuccess: () => {
        // Invalidate both lists since logging a session updates course hours too
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        setIsAddOpen(false);
        // Keep date but reset others
        setHoursTeached("1"); setStudentsCount(""); setStudentsAbsent("0"); setNotes("");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this log? This will restore the hours to the course budget.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
      }
    });
  };

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Daily Log</h1>
          <p className="text-muted-foreground mt-1">Record your classes and deduct hours from courses.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Log Session
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {loadingSessions ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No sessions logged</h3>
            <p className="text-muted-foreground mt-1 mb-6">Start logging your daily classes to track progress.</p>
            <Button onClick={() => setIsAddOpen(true)} variant="outline">Log your first session</Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {[...sessions]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((session) => (
              <div key={session.id} className="p-6 group hover:bg-secondary/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="flex items-start gap-4">
                  <div className="bg-primary/5 text-primary p-3 rounded-xl min-w-16 text-center border border-primary/10">
                    <p className="text-xs font-bold uppercase tracking-wider">{format(new Date(session.date), 'MMM')}</p>
                    <p className="text-xl font-bold font-display leading-none mt-0.5">{format(new Date(session.date), 'dd')}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{session.companyName}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="text-xs font-medium text-muted-foreground">{session.batch}</span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground leading-tight">{session.courseName}</h3>
                    {session.notes && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1.5">
                        <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {session.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-8 self-end md:self-auto bg-secondary/50 p-3 rounded-xl border border-border/50">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-bold text-foreground">{formatHours(session.hoursTeached)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{session.studentsCount} Students</span>
                    </div>
                    {session.studentsAbsent > 0 && (
                      <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                        <UserX className="w-4 h-4" />
                        <span>{session.studentsAbsent} Absent</span>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(session.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors md:opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Log Daily Session">
        {loadingCourses ? (
          <p className="p-4 text-center text-muted-foreground">Loading courses...</p>
        ) : courses.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">You need to create a course before logging a session.</p>
            <Button variant="outline" onClick={() => window.location.href='/courses'}>Go to Courses</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Select Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
                required
              >
                <option value="" disabled>Choose an active course</option>
                {activeCourses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} - {c.name} ({c.batch}) • {c.hoursRemaining}h left
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Date</label>
                <Input 
                  type="date"
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Hours Taught</label>
                <Input 
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={hoursTeached} 
                  onChange={(e) => setHoursTeached(e.target.value)} 
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Total Students</label>
                <Input 
                  type="number"
                  min="1"
                  value={studentsCount} 
                  onChange={(e) => setStudentsCount(e.target.value)} 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Students Absent</label>
                <Input 
                  type="number"
                  min="0"
                  value={studentsAbsent} 
                  onChange={(e) => setStudentsAbsent(e.target.value)} 
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Topics covered, issues, etc."
                className="flex w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 resize-none min-h-24"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Save Log</Button>
            </div>
          </form>
        )}
      </Modal>
    </PageLayout>
  );
}
