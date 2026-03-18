import { useState } from "react";
import { useListCourses, useGetCourseReport, useListStudents } from "@workspace/api-client-react";
import { FileText, Download, Calendar, Clock, Users, UserX, CheckCircle2, XCircle, User } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, startOfWeek, endOfWeek } from "date-fns";

type ReportType = "full" | "daily" | "weekly" | "custom" | "allStudents" | "singleStudent";

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: "full", label: "Full Course" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "custom", label: "Custom" },
  { key: "allStudents", label: "All Students" },
  { key: "singleStudent", label: "Single Student" },
];

function addPdfFooter(doc: any, pageW: number) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated ${format(new Date(), "dd MMM yyyy, HH:mm")} — Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }
}

function pdfHeader(doc: any, pageW: number, margin: number, title: string, subtitle: string, period: string) {
  doc.setFillColor(67, 97, 238);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, margin, 24);
  doc.text(period, margin, 31);
  doc.setTextColor(30, 30, 30);
}

export default function Reports() {
  const { data: courses = [] } = useListCourses();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("full");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split("T")[0]);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split("T")[0]);

  const courseIdNum = selectedCourseId ? Number(selectedCourseId) : undefined;
  const { data: courseStudents = [] } = useListStudents(
    courseIdNum ? { courseId: courseIdNum } : {},
    { enabled: !!courseIdNum }
  );

  const getDateRange = (): { startDate?: string; endDate?: string } => {
    if (reportType === "full" || reportType === "allStudents" || reportType === "singleStudent") return {};
    if (reportType === "daily") return { startDate: singleDate, endDate: singleDate };
    if (reportType === "weekly") {
      const d = new Date(singleDate);
      return {
        startDate: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    return { startDate: customStart, endDate: customEnd };
  };

  const { startDate, endDate } = getDateRange();

  const { data: report, isLoading, refetch } = useGetCourseReport(
    courseIdNum!,
    { startDate, endDate },
    { enabled: false }
  );

  const handleGenerate = () => {
    if (!selectedCourseId) return;
    if (reportType === "singleStudent" && !selectedStudentId) return;
    refetch();
  };

  // Computed: per-student stats from report
  const studentStats = report
    ? report.students.map((student) => {
        let present = 0, absent = 0;
        const sessionRows: { date: string; hoursTeached: number; isPresent: boolean; remark?: string }[] = [];
        for (const s of report.sessions) {
          const rec = s.attendance.find((a) => a.studentId === student.id);
          if (rec) {
            rec.isPresent ? present++ : absent++;
            sessionRows.push({ date: s.date, hoursTeached: s.hoursTeached, isPresent: rec.isPresent, remark: rec.remark });
          }
        }
        const total = present + absent;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        return { student, present, absent, total, pct, sessionRows };
      })
    : [];

  const singleStudentData = selectedStudentId
    ? studentStats.find((s) => s.student.id === Number(selectedStudentId))
    : null;

  const handleDownloadPDF = async () => {
    if (!report) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    const courseInfo = `${report.companyName} — ${report.courseName} (${report.batch})`;
    const periodLabel =
      report.startDate && report.endDate
        ? `${format(new Date(report.startDate), "dd MMM yyyy")} – ${format(new Date(report.endDate), "dd MMM yyyy")}`
        : "Full Course";

    // ── ALL STUDENTS REPORT ──────────────────────────────────────
    if (reportType === "allStudents") {
      pdfHeader(doc, pageW, margin, "All Students Attendance Report", courseInfo, `Period: ${periodLabel}`);
      let y = 46;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Overall Attendance Summary", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["#", "Student Name", "Present", "Absent", "Total Sessions", "Attendance %", "Status"]],
        body: studentStats.map((s, i) => [
          String(i + 1),
          s.student.name,
          String(s.present),
          String(s.absent),
          String(s.total),
          `${s.pct}%`,
          s.pct >= 75 ? "Good" : s.pct >= 50 ? "Average" : "Poor",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [67, 97, 238], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const val = data.cell.text[0];
            data.cell.styles.textColor =
              val === "Good" ? [16, 130, 80] : val === "Average" ? [180, 100, 0] : [200, 40, 40];
            data.cell.styles.fontStyle = "bold";
          }
        },
        margin: { left: margin, right: margin },
      });

      // Class-level summary stats
      y = (doc as any).lastAutoTable.finalY + 10;
      const totalSessions = report.sessions.length;
      const avgPct = studentStats.length > 0
        ? Math.round(studentStats.reduce((a, s) => a + s.pct, 0) / studentStats.length)
        : 0;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Class Summary", margin, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Total Students", "Total Sessions", "Avg Attendance %", "Hours Taught", "Hours Remaining"]],
        body: [[String(report.students.length), String(totalSessions), `${avgPct}%`, `${report.hoursUsed}h`, `${report.hoursRemaining}h`]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [67, 97, 238], textColor: 255 },
        margin: { left: margin, right: margin },
      });

      addPdfFooter(doc, pageW);
      doc.save(`${report.companyName}-${report.courseName}-${report.batch}-all-students.pdf`.replace(/\s+/g, "_"));
      return;
    }

    // ── SINGLE STUDENT REPORT ────────────────────────────────────
    if (reportType === "singleStudent" && singleStudentData) {
      const { student, present, absent, total, pct, sessionRows } = singleStudentData;
      pdfHeader(doc, pageW, margin, "Student Attendance Report", courseInfo, `Student: ${student.name}`);
      let y = 46;

      // Student info card
      autoTable(doc, {
        startY: y,
        head: [["Student Name", "Course", "Batch", "Present", "Absent", "Attendance %"]],
        body: [[student.name, report.courseName, report.batch, String(present), String(absent), `${pct}%`]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [67, 97, 238], textColor: 255 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Session-wise Attendance", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["#", "Date", "Hours", "Status", "Remarks"]],
        body: sessionRows.map((r, i) => [
          String(i + 1),
          format(new Date(r.date), "EEE, dd MMM yyyy"),
          `${r.hoursTeached}h`,
          r.isPresent ? "Present" : "Absent",
          r.remark ?? "",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [67, 97, 238], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 3) {
            data.cell.styles.textColor =
              data.cell.text[0] === "Present" ? [16, 130, 80] : [200, 40, 40];
            data.cell.styles.fontStyle = "bold";
          }
        },
        margin: { left: margin, right: margin },
      });

      addPdfFooter(doc, pageW);
      doc.save(`${student.name}-${report.courseName}-${report.batch}-attendance.pdf`.replace(/\s+/g, "_"));
      return;
    }

    // ── STANDARD COURSE REPORT ───────────────────────────────────
    pdfHeader(doc, pageW, margin, "IT Training Report", courseInfo, `Period: ${periodLabel}`);
    let y = 46;

    const totalPresent = report.sessions.reduce((acc, s) => acc + s.studentsCount, 0);
    const totalAbsent = report.sessions.reduce((acc, s) => acc + s.studentsAbsent, 0);
    const avgAtt = report.sessions.length > 0
      ? Math.round((totalPresent / (totalPresent + totalAbsent || 1)) * 100) : 0;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Summary", margin, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Total Sessions", "Hours Taught", "Total Hours", "Remaining Hours", "Avg Attendance"]],
      body: [[String(report.sessions.length), `${report.hoursUsed}h`, `${report.totalHours}h`, `${report.hoursRemaining}h`, `${avgAtt}%`]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [67, 97, 238], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Session Log", margin, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Hours", "Present", "Absent", "Att%", "Notes"]],
      body: report.sessions.map((s) => {
        const attPct = s.studentsCount + s.studentsAbsent > 0
          ? Math.round((s.studentsCount / (s.studentsCount + s.studentsAbsent)) * 100) : 100;
        return [format(new Date(s.date), "dd MMM yyyy"), `${s.hoursTeached}h`, String(s.studentsCount), String(s.studentsAbsent), `${attPct}%`, s.notes ?? ""];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [67, 97, 238], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    for (const session of report.sessions) {
      if (session.attendance.length === 0) continue;
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(67, 97, 238);
      doc.text(`Attendance — ${format(new Date(session.date), "dd MMM yyyy")} (${session.hoursTeached}h)`, margin, y);
      y += 5; doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: y,
        head: [["#", "Student Name", "Status", "Remark"]],
        body: session.attendance.map((a, i) => [String(i + 1), a.studentName, a.isPresent ? "Present" : "Absent", a.remark ?? ""]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 120, 200], textColor: 255 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.textColor = data.cell.text[0] === "Present" ? [16, 130, 80] : [200, 40, 40];
          }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (studentStats.length > 0 && report.sessions.some(s => s.attendance.length > 0)) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30, 30, 30);
      doc.text("Student Attendance Summary", margin, y); y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Student Name", "Present", "Absent", "Total", "Attendance %"]],
        body: studentStats.map((s) => [s.student.name, String(s.present), String(s.absent), String(s.total), `${s.pct}%`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [67, 97, 238], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { left: margin, right: margin },
      });
    }

    addPdfFooter(doc, pageW);
    doc.save(`${report.companyName}-${report.courseName}-${report.batch}-${reportType}-report.pdf`.replace(/\s+/g, "_"));
  };

  const canGenerate = !!selectedCourseId && !isLoading &&
    (reportType !== "singleStudent" || !!selectedStudentId);

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
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Report Settings
            </h2>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Select Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedStudentId(""); }}
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
                {REPORT_TYPES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReportType(key)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      reportType === key
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/30 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date picker for daily / weekly */}
            {(reportType === "daily" || reportType === "weekly") && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {reportType === "daily" ? "Date" : "Any date in the week"}
                </label>
                <Input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
              </div>
            )}

            {/* Custom range */}
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

            {/* Single student picker */}
            {reportType === "singleStudent" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Select Student</label>
                {!selectedCourseId ? (
                  <p className="text-xs text-muted-foreground">Select a course first.</p>
                ) : courseStudents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No students enrolled in this course.</p>
                ) : (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="flex h-11 w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="" disabled>Choose a student...</option>
                    {courseStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <Button onClick={handleGenerate} className="w-full" disabled={!canGenerate}>
              {isLoading ? "Loading..." : "Preview Report"}
            </Button>
          </div>
        </div>

        {/* Preview panel */}
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

              {/* ── ALL STUDENTS PREVIEW ──────────────────── */}
              {reportType === "allStudents" && (
                <>
                  <div className="bg-primary p-5 text-primary-foreground">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <p className="text-primary-foreground/70 text-xs uppercase tracking-wider mb-1">{report.companyName}</p>
                        <h2 className="text-xl font-bold">{report.courseName} — All Students</h2>
                        <p className="text-primary-foreground/80 text-sm mt-0.5">Batch: {report.batch}</p>
                      </div>
                      <Button onClick={handleDownloadPDF} className="bg-white text-primary hover:bg-white/90 shrink-0 w-full sm:w-auto">
                        <Download className="w-4 h-4" /> Download PDF
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {[
                        { label: "Students", value: report.students.length },
                        { label: "Sessions", value: report.sessions.length },
                        { label: "Avg Attendance", value: studentStats.length > 0 ? `${Math.round(studentStats.reduce((a, s) => a + s.pct, 0) / studentStats.length)}%` : "—" },
                      ].map((s) => (
                        <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                          <p className="text-white/70 text-xs">{s.label}</p>
                          <p className="text-white font-bold text-lg">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 sm:p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {studentStats.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No students enrolled or no attendance recorded.</p>
                    ) : studentStats.map((s, i) => (
                      <div key={s.student.id} className="flex items-center gap-3 sm:gap-4 px-4 py-3 bg-secondary/30 rounded-xl border border-border/50">
                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="font-semibold text-sm text-foreground flex-1 min-w-0 truncate">{s.student.name}</span>
                        <span className="text-xs text-emerald-600 font-bold whitespace-nowrap">{s.present} P</span>
                        <span className="text-xs text-destructive font-bold whitespace-nowrap">{s.absent} A</span>
                        <div className="w-20 flex-shrink-0">
                          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.pct >= 75 ? "bg-emerald-500" : s.pct >= 50 ? "bg-amber-400" : "bg-destructive"}`}
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                          <p className={`text-xs text-center font-bold mt-0.5 ${s.pct >= 75 ? "text-emerald-600" : s.pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
                            {s.pct}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── SINGLE STUDENT PREVIEW ────────────────── */}
              {reportType === "singleStudent" && (
                <>
                  {singleStudentData ? (
                    <>
                      <div className="bg-primary p-5 text-primary-foreground">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div>
                            <p className="text-primary-foreground/70 text-xs uppercase tracking-wider mb-1">{report.companyName} — {report.courseName}</p>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-white" />
                              </div>
                              <h2 className="text-xl font-bold">{singleStudentData.student.name}</h2>
                            </div>
                            <p className="text-primary-foreground/80 text-sm mt-0.5">Batch: {report.batch}</p>
                          </div>
                          <Button onClick={handleDownloadPDF} className="bg-white text-primary hover:bg-white/90 shrink-0 w-full sm:w-auto">
                            <Download className="w-4 h-4" /> Download PDF
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-3 mt-4">
                          {[
                            { label: "Sessions", value: singleStudentData.total },
                            { label: "Present", value: singleStudentData.present },
                            { label: "Absent", value: singleStudentData.absent },
                            { label: "Attendance", value: `${singleStudentData.pct}%` },
                          ].map((s) => (
                            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                              <p className="text-white/70 text-xs">{s.label}</p>
                              <p className="text-white font-bold text-base sm:text-lg">{s.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 sm:p-6 space-y-2 max-h-[60vh] overflow-y-auto">
                        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-primary" /> Session History
                        </h3>
                        {singleStudentData.sessionRows.length === 0 ? (
                          <p className="text-center text-muted-foreground py-6 text-sm">No attendance records found.</p>
                        ) : singleStudentData.sessionRows.map((row, i) => (
                          <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${row.isPresent ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"}`}>
                            {row.isPresent
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                            <span className="text-sm font-semibold text-foreground flex-1">
                              {format(new Date(row.date), "EEE, dd MMM yyyy")}
                            </span>
                            <span className="text-xs text-primary font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {row.hoursTeached}h
                            </span>
                            {row.remark && <span className="text-xs text-muted-foreground italic ml-1">{row.remark}</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Select a student from the settings panel to see their report.
                    </div>
                  )}
                </>
              )}

              {/* ── STANDARD COURSE REPORT PREVIEW ────────── */}
              {reportType !== "allStudents" && reportType !== "singleStudent" && (
                <>
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
                      <Button onClick={handleDownloadPDF} className="bg-white text-primary hover:bg-white/90 shrink-0 w-full sm:w-auto">
                        <Download className="w-4 h-4" /> Download PDF
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      {[
                        { label: "Sessions", value: report.sessions.length },
                        { label: "Hours Taught", value: `${report.hoursUsed}h` },
                        { label: "Remaining", value: `${report.hoursRemaining}h` },
                        { label: "Students", value: report.students.length },
                      ].map((s) => (
                        <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                          <p className="text-white/70 text-xs">{s.label}</p>
                          <p className="text-white font-bold text-lg">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {report.sessions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No sessions found for this period.</p>
                    ) : report.sessions.map((session) => (
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
                            <span className="flex items-center gap-1.5 text-primary font-bold"><Clock className="w-3.5 h-3.5" /> {session.hoursTeached}h</span>
                            <span className="flex items-center gap-1.5 text-emerald-600 font-medium"><Users className="w-3.5 h-3.5" /> {session.studentsCount} present</span>
                            {session.studentsAbsent > 0 && (
                              <span className="flex items-center gap-1.5 text-destructive font-medium"><UserX className="w-3.5 h-3.5" /> {session.studentsAbsent} absent</span>
                            )}
                          </div>
                        </div>
                        {session.attendance.length > 0 && (
                          <div className="divide-y divide-border">
                            {session.attendance.map((a) => (
                              <div key={a.id} className="flex items-center px-4 py-2.5 gap-3">
                                {a.isPresent ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                                <span className={`text-sm font-medium flex-1 ${a.isPresent ? "text-foreground" : "text-muted-foreground line-through"}`}>{a.studentName}</span>
                                {a.remark && <span className="text-xs text-muted-foreground italic">{a.remark}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {studentStats.length > 0 && report.sessions.some(s => s.attendance.length > 0) && (
                      <div>
                        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" /> Student Summary
                        </h3>
                        <div className="space-y-2">
                          {studentStats.map((s) => (
                            <div key={s.student.id} className="flex items-center gap-3 px-4 py-2.5 bg-secondary/30 rounded-xl border border-border/50">
                              <span className="font-medium text-sm text-foreground flex-1">{s.student.name}</span>
                              <span className="text-xs text-emerald-600 font-bold">{s.present}P</span>
                              <span className="text-xs text-destructive font-bold">{s.absent}A</span>
                              <div className="w-16">
                                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${s.pct >= 75 ? "bg-emerald-500" : s.pct >= 50 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${s.pct}%` }} />
                                </div>
                                <p className="text-xs text-center text-muted-foreground mt-0.5">{s.pct}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
