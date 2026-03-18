import { useState } from "react";
import { useListCourses, useCreateCourse, useDeleteCourse, useListCompanies, getListCoursesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, Trash2, Clock, Building2 } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatHours } from "@/lib/utils";

export default function Courses() {
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading } = useListCourses();
  const { data: companies = [] } = useListCompanies();
  const createMutation = useCreateCourse();
  const deleteMutation = useDeleteCourse();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Form State
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [batch, setBatch] = useState("");
  const [totalHours, setTotalHours] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !name || !batch || !totalHours) return;
    
    createMutation.mutate({ 
      data: { 
        companyId: Number(companyId), 
        name, 
        batch, 
        totalHours: Number(totalHours) 
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        setIsAddOpen(false);
        // Reset form
        setName(""); setBatch(""); setTotalHours(""); setCompanyId("");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
      }
    });
  };

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Courses</h1>
          <p className="text-muted-foreground mt-1">Manage batches and track hour budgets.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Course
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map(i => <div key={i} className="h-48 bg-secondary/50 rounded-2xl animate-pulse" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border border-dashed">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No courses tracked yet</h3>
          <p className="text-muted-foreground mt-1 mb-6">Create a course to start logging hours against it.</p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline">Add your first course</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {courses.map((course) => {
            const pct = Math.min((course.hoursUsed / course.totalHours) * 100, 100);
            const isCompleted = course.hoursRemaining <= 0;

            return (
              <div key={course.id} className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg transition-shadow relative group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-md inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {course.companyName}
                      </span>
                      {isCompleted && (
                        <span className="bg-emerald-500/10 text-emerald-600 text-xs font-bold px-2 py-1 rounded-md">
                          Completed
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold font-display text-foreground">{course.name}</h3>
                    <p className="text-sm font-medium text-muted-foreground mt-0.5">Batch: {course.batch}</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(course.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-6 p-4 bg-secondary/40 rounded-xl border border-border/50">
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Progress
                    </span>
                    <span className="text-foreground">{formatHours(course.hoursUsed)} / {formatHours(course.totalHours)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <p className="text-sm font-medium text-muted-foreground">
                      <span className="text-foreground font-bold">{formatHours(course.hoursRemaining)}</span> remaining
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">{Math.round(pct)}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Course">
        <form onSubmit={handleCreate} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Client Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="flex h-12 w-full rounded-xl border-2 border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
              required
            >
              <option value="" disabled>Select a company</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Course Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. React Advanced" 
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Batch Name</label>
              <Input 
                value={batch} 
                onChange={(e) => setBatch(e.target.value)} 
                placeholder="e.g. B2-Morning" 
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Total Hours</label>
              <Input 
                type="number"
                min="1"
                value={totalHours} 
                onChange={(e) => setTotalHours(e.target.value)} 
                placeholder="e.g. 60" 
                required
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Save Course</Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}
