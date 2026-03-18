import { useState } from "react";
import { useListCompanies, useCreateCompany, useDeleteCompany, getListCompaniesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Trash2 } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { format } from "date-fns";

export default function Companies() {
  const queryClient = useQueryClient();
  const { data: companies = [], isLoading } = useListCompanies();
  const createMutation = useCreateCompany();
  const deleteMutation = useDeleteCompany();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    createMutation.mutate({ data: { name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        setIsAddOpen(false);
        setName("");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this company?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      }
    });
  };

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Companies</h1>
          <p className="text-muted-foreground mt-1">Manage your client organizations.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Company
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-secondary/50 rounded-2xl animate-pulse" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border border-dashed">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No companies yet</h3>
          <p className="text-muted-foreground mt-1 mb-6">Add your first client to start tracking courses.</p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline">Add your first company</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div key={company.id} className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg transition-all duration-300 group relative">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-display text-foreground">{company.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">Added {format(new Date(company.createdAt), 'MMM d, yyyy')}</p>
              
              <button 
                onClick={() => handleDelete(company.id)}
                disabled={deleteMutation.isPending}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Company" description="Create a new client profile.">
        <form onSubmit={handleCreate} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Company Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Acme Corp" 
              autoFocus
              required
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Save Company</Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}
