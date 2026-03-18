import { useState } from "react";
import { useListCourses, useGetCourseReport } from "@workspace/api-client-react";
import { FileText, Download, Calendar, BookOpen, Clock, Users, UserX, CheckCircle2, XCircle } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

type ReportType = "full" | "daily" | "weekly" | "custom";

export default function Reports() {
  const { data: courses = [] } = useListCourses();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("full");
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split("T")[0]);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split("T")[0]);

  const getDateRange = (): { startDate?: string; endDate?: string } => {
    if (reportType === "full") return {};
    if (reportType === "daily") return { startDate: singleDate, endDate: singleDate };
    if (reportType === "weekly") {
      const d = new Date(singleDate);
      const start = startOfWeek(d, { weekStartsOn: 1 });
      const end = endOfWeek(d, { weekStartsOn: 1 });
      return { startDate: format(start, "yyyy-MM-dd"), endDate: format(end, "yyyy-MM-dd") };
    }
    return { startDate: customStart, endDate: customEnd };
  };

  const { startDate, endDate } = getDateRange();
  const courseIdNum = selectedCourseId ? Number(selectedCourseId) : undefined;

  const { data: report, isLoading, refetch } = useGetCourseReport(
    courseIdNum!,
    { startDate, endDate },
    { enabled: false }
  );

  const handleGenerate = () => {
    if (!selectedCourseId) return;
    refetch();
  };

  const handleDownloadPDF = async () => {
    if (!report) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    // === HEADER ===
    doc.setFillColor(67, 97, 238);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("IT Training Report", margin, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${report.companyName} — ${report.courseName} (${report.batch})`, margin, 24);
    const dateRangeLabel = report.startDate && report.endDate
      ? `${format(new Date(report.startDate), "dd MMM yyyy")} – ${format(new Date(report.endDate), "dd MMM yyyy")}`
      : "Full Course";
    doc.text(`Period: ${dateRangeLabel}`, margin, 31);

    let y = 46;

    // === SUMMARY BOX ===
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Summary", margin, y);
    y += 6;

    const totalPresent = report.sessions.reduce((acc, s) => acc + s.studentsCount, 0);
    const totalAbsent = report.sessions.reduce((acc, s) => acc + s.studentsAbsent, 0);
    const avgAtt = report.sessions.length > 0
      ? Math.round((totalPresent / (totalPresent + totalAbsent || 1)) * 100)
      : 0;

    autoTable(doc, {
      startY: y,
      head: [["Total Sessions", "Hours Taught", "Total Hours", "Remaining Hours", "Avg Attendance"]],
      body: [[
        String(report.sessions.length),
        `${report.hoursUsed}h`,
        `${report.totalHours}h`,
        `${report.hoursRemaining}h`,
        `${avgAtt}%`,
      ]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [67, 97, 238], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // === SESSIONS TABLE ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Session Log", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Hours", "Present", "Absent", "Att%", "Notes"]],
      body: report.sessions.map((s) => {
        const attPct = s.studentsCount + s.studentsAbsent > 0
          ? Math.round((s.studentsCount / (s.studentsCount + s.studentsAbsent)) * 100)
          : 100;
        return [
          format(new Date(s.date), "dd MMM yyyy"),
          `${s.hoursTeached}h`,
          String(s.studentsCount),
          String(s.studentsAbsent),
          `${attPct}%`,
          s.notes ?? "",
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [67, 97, 238], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // === PER SESSION ATTENDANCE DETAIL ===
    for (const session of report.sessions) {
      if (session.attendance.length === 0) continue;

      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(67, 97, 238);
      doc.text(`Attendance — ${format(new Date(session.date), "dd MMM yyyy")} (${session.hoursTeached}h)`, margin, y);
      y += 5;
      doc.setTextColor(30, 30, 30);

      autoTable(doc, {
        startY: y,
        head: [["#", "Student Name", "Status", "Remark"]],
        body: session.attendance.map((a, i) => [
          String(i + 1),
          a.studentName,
          a.isPresent ? "Present" : "Absent",
          a.remark ?? "",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 120, 200], textColor: 255 },
        bodyStyles: { textColor: [30, 30, 30] },
        columnStyles: {
          2: {
            fontStyle: "bold",
          }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            const val = data.cell.text[0];
            data.cell.styles.textColor = val === "Present" ? [16, 130, 80] : [200, 40, 40];
          }
        },
        margin: { left: margin, right: margin },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // === STUDENT OVERALL SUMMARY ===
    if (report.students.length > 0 && report.sessions.some(s => s.attendance.length > 0)) {
      if (y > 220) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text("Student Attendance Summary", margin, y);
      y += 6;

      const studentSummary = report.students.map((student) => {
        let present = 0, absent = 0;
        for (const s of report.sessions) {
          const rec = s.attendance.find((a) => a.studentId === student.id);
          if (rec) rec.isPresent ? present++ : absent++;
        }
        const total = present + absent;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        return [student.name, String(present), String(absent), String(total), `${pct}%`];
      });

      autoTable(doc, {
        startY: y,
        head: [["Student Name", "Present", "Absent", "Total Sessions", "Attendance %"]],
        body: studentSummary,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [67, 97, 238], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { left: margin, right: margin },
      });
    }

    // === FOOTER ===
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Generated ${format(new Date(), "dd MMM yyyy, HH:mm")} — Page ${i} of ${pageCount}`,
        pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" }
      );
    }

    const fileName = `${report.companyName}-${report.courseName}-${report.batch}-${reportType}-report.pdf`
      .replace(/\s+/g, "_");
    doc.save(fileName);
  };

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Generate and download detailed PDF reports for any course.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Report Settings</h2>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Select Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="flex h-11 w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="" disabled>Choose a course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName} — {c.name} ({c.batch})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Report Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["full", "daily", "weekly", "custom"] as ReportType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReportType(type)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${
                      reportType === type
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/30 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {type === "full" ? "Full Course" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {(reportType === "daily" || reportType === "weekly") && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {reportType === "daily" ? "Date" : "Any date in the week"}
                </label>
                <Input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
              </div>
            )}

            {reportType === "custom" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Start Date</label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">End Date</label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </div>
            )}

            <Button onClick={handleGenerate} className="w-full" disabled={!selectedCourseId || isLoading}>
              {isLoading ? "Loading..." : "Preview Report"}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          {!report && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full min-h-64 bg-card border border-dashed border-border rounded-2xl text-center p-8">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-bold text-foreground mb-1">No report generated yet</p>
              <p className="text-sm text-muted-foreground">Select a course and report type, then click Preview Report.</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-64 bg-card border border-border rounded-2xl">
              <div className="text-center text-muted-foreground">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium">Loading report data...</p>
              </div>
            </div>
          )}

          {report && !isLoading && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              {/* Report header */}
              <div className="bg-primary p-5 sm:p-6 text-primary-foreground">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider mb-1">{report.companyName}</p>
                    <h2 className="text-xl font-bold">{report.courseName}</h2>
                    <p className="text-primary-foreground/80 text-sm mt-0.5">Batch: {report.batch}</p>
                    {report.startDate && (
                      <p className="text-primary-foreground/70 text-xs mt-1">
                        {format(new Date(report.startDate), "dd MMM yyyy")} – {report.endDate ? format(new Date(report.endDate), "dd MMM yyyy") : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleDownloadPDF}
                    className="bg-white text-primary hover:bg-white/90 shrink-0 w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  {[
                    { label: "Sessions", value: report.sessions.length, icon: Calendar },
                    { label: "Hours Taught", value: `${report.hoursUsed}h`, icon: Clock },
                    { label: "Remaining", value: `${report.hoursRemaining}h`, icon: Clock },
                    { label: "Students", value: report.students.length, icon: Users },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-white/70 text-xs">{s.label}</p>
                      <p className="text-white font-bold text-lg">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions detail */}
              <div className="p-4 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {report.sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No sessions found for this period.</p>
                ) : (
                  report.sessions.map((session) => (
                    <div key={session.id} className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-secondary/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary p-2 rounded-lg text-center min-w-[44px]">
                            <p className="text-xs font-bold uppercase">{format(new Date(session.date), "MMM")}</p>
                            <p className="text-base font-bold leading-none">{format(new Date(session.date), "dd")}</p>
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{format(new Date(session.date), "EEEE, dd MMM yyyy")}</p>
                            {session.notes && <p className="text-xs text-muted-foreground">{session.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span className="flex items-center gap-1.5 text-primary font-bold">
                            <Clock className="w-3.5 h-3.5" /> {session.hoursTeached}h
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <Users className="w-3.5 h-3.5" /> {session.studentsCount} present
                          </span>
                          {session.studentsAbsent > 0 && (
                            <span className="flex items-center gap-1.5 text-destructive font-medium">
                              <UserX className="w-3.5 h-3.5" /> {session.studentsAbsent} absent
                            </span>
                          )}
                        </div>
                      </div>

                      {session.attendance.length > 0 && (
                        <div className="divide-y divide-border">
                          {session.attendance.map((a) => (
                            <div key={a.id} className="flex items-center px-4 py-2.5 gap-3">
                              {a.isPresent
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                              <span className={`text-sm font-medium flex-1 ${a.isPresent ? "text-foreground" : "text-muted-foreground line-through"}`}>{a.studentName}</span>
                              {a.remark && <span className="text-xs text-muted-foreground italic">{a.remark}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Student summary */}
                {report.students.length > 0 && report.sessions.some(s => s.attendance.length > 0) && (
                  <div>
                    <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Student Summary
                    </h3>
                    <div className="space-y-2">
                      {report.students.map((student) => {
                        let present = 0, absent = 0;
                        for (const s of report.sessions) {
                          const rec = s.attendance.find((a) => a.studentId === student.id);
                          if (rec) rec.isPresent ? present++ : absent++;
                        }
                        const total = present + absent;
                        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                        return (
                          <div key={student.id} className="flex items-center gap-3 px-4 py-2.5 bg-secondary/30 rounded-xl border border-border/50">
                            <span className="font-medium text-sm text-foreground flex-1">{student.name}</span>
                            <span className="text-xs text-emerald-600 font-bold">{present}P</span>
                            <span className="text-xs text-destructive font-bold">{absent}A</span>
                            <div className="w-16">
                              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-center text-muted-foreground mt-0.5">{pct}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
