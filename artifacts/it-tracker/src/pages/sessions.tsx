import { useState, useEffect } from "react";
import {
  useListSessions, useCreateSession, useDeleteSession, useListCourses,
  useListStudents, useSaveSessionAttendance,
  getListSessionsQueryKey, getListCoursesQueryKey, getListStudentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, Users, UserX, Trash2, StickyNote, CheckCircle2, XCircle } from "lucide-react";
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
  const saveAttendanceMutation = useSaveSessionAttendance();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hoursTeached, setHoursTeached] = useState("1");
  const [notes, setNotes] = useState("");

  // Attendance state: { studentId -> { isPresent, remark } }
  const [attendance, setAttendance] = useState<Record<number, { isPresent: boolean; remark: string }>>({});

  const { data: courseStudents = [] } = useListStudents(
    courseId ? { courseId: Number(courseId) } : {},
  );

  // When course changes, reset attendance with all students present
  useEffect(() => {
    const init: Record<number, { isPresent: boolean; remark: string }> = {};
    for (const s of courseStudents) init[s.id] = { isPresent: true, remark: "" };
    setAttendance(init);
  }, [courseStudents]);

  const activeCourses = courses.filter((c) => c.hoursRemaining > 0);
  const presentCount = Object.values(attendance).filter((a) => a.isPresent).length;
  const absentCount = Object.values(attendance).filter((a) => !a.isPresent).length;

  const studentsCount = courseStudents.length > 0 ? courseStudents.length : Number(hoursTeached);
  const studentsAbsent = absentCount;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !date || !hoursTeached) return;

    const totalStudents = courseStudents.length > 0 ? courseStudents.length : 1;
    const absent = courseStudents.length > 0 ? absentCount : 0;

    createMutation.mutate({
      data: {
        courseId: Number(courseId),
        date,
        hoursTeached: Number(hoursTeached),
        studentsCount: totalStudents,
        studentsAbsent: absent,
        notes: notes || undefined,
      }
    }, {
      onSuccess: async (session) => {
        // Save attendance if we have students
        if (courseStudents.length > 0) {
          const attendancePayload = courseStudents.map((s) => ({
            studentId: s.id,
            isPresent: attendance[s.id]?.isPresent ?? true,
            remark: attendance[s.id]?.remark || undefined,
          }));
          await saveAttendanceMutation.mutateAsync({
            sessionId: session.id,
            data: attendancePayload,
          });
        }
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        setIsAddOpen(false);
        setCourseId(""); setHoursTeached("1"); setNotes(""); setAttendance({});
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this log? This will also restore the hours to the course budget.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
      }
    });
  };

  const togglePresent = (studentId: number) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], isPresent: !prev[studentId]?.isPresent },
    }));
  };

  const setRemark = (studentId: number, remark: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], remark },
    }));
  };

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">Daily Log</h1>
          <p className="text-muted-foreground mt-1">Record classes and mark student attendance.</p>
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
                <div key={session.id} className="p-4 sm:p-6 group hover:bg-secondary/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <div className="bg-primary/5 text-primary p-2 sm:p-3 rounded-xl min-w-[52px] text-center border border-primary/10 flex-shrink-0">
                      <p className="text-xs font-bold uppercase tracking-wider">{format(new Date(session.date), "MMM")}</p>
                      <p className="text-lg sm:text-xl font-bold font-display leading-none mt-0.5">{format(new Date(session.date), "dd")}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{session.companyName}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-xs font-medium text-muted-foreground">{session.batch}</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">{session.courseName}</h3>
                      {session.notes && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
                          <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {session.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto flex-shrink-0 bg-secondary/50 p-2.5 sm:p-3 rounded-xl border border-border/50">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-bold text-foreground">{formatHours(session.hoursTeached)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{session.studentsCount} present</span>
                      </div>
                      {session.studentsAbsent > 0 && (
                        <div className="flex items-center gap-2 text-xs text-destructive font-medium">
                          <UserX className="w-3.5 h-3.5" />
                          <span>{session.studentsAbsent} absent</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(session.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors sm:opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setCourseId(""); setAttendance({}); }} title="Log Daily Session">
        {loadingCourses ? (
          <p className="p-4 text-center text-muted-foreground">Loading courses...</p>
        ) : courses.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Create a course first before logging a session.</p>
            <Button variant="outline" onClick={() => window.location.href = "/courses"}>Go to Courses</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Select Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none"
                required
              >
                <option value="" disabled>Choose an active course</option>
                {activeCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName} — {c.name} ({c.batch}) • {c.hoursRemaining}h left</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Hours Taught</label>
                <Input type="number" min="0.5" step="0.5" value={hoursTeached} onChange={(e) => setHoursTeached(e.target.value)} required />
              </div>
            </div>

            {/* Attendance section — only if course has students */}
            {courseId && courseStudents.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Attendance</label>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <span className="text-emerald-600">{presentCount} present</span>
                    <span className="text-destructive">{absentCount} absent</span>
                  </div>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 border border-border rounded-xl p-3 bg-secondary/20">
                  {courseStudents.map((student) => {
                    const att = attendance[student.id] ?? { isPresent: true, remark: "" };
                    return (
                      <div key={student.id} className={`rounded-lg border p-2.5 transition-colors ${att.isPresent ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"}`}>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => togglePresent(student.id)}
                            className="flex-shrink-0 transition-transform hover:scale-110"
                          >
                            {att.isPresent
                              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              : <XCircle className="w-5 h-5 text-destructive" />}
                          </button>
                          <span className="font-medium text-sm text-foreground flex-1">{student.name}</span>
                        </div>
                        {!att.isPresent && (
                          <input
                            type="text"
                            value={att.remark}
                            onChange={(e) => setRemark(student.id, e.target.value)}
                            placeholder="Reason / remark (optional)"
                            className="mt-2 w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-card focus:outline-none focus:border-primary"
                          />
                        )}
                        {att.isPresent && (
                          <input
                            type="text"
                            value={att.remark}
                            onChange={(e) => setRemark(student.id, e.target.value)}
                            placeholder="Remark (optional)"
                            className="mt-2 w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-card focus:outline-none focus:border-primary"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {courseId && courseStudents.length === 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                No students enrolled in this course yet. Add students in the Courses page to mark attendance.
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Topics covered, issues, etc."
                className="flex w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none resize-none min-h-20"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => { setIsAddOpen(false); setCourseId(""); setAttendance({}); }}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending || saveAttendanceMutation.isPending}>Save Log</Button>
            </div>
          </form>
        )}
      </Modal>
    </PageLayout>
  );
}
