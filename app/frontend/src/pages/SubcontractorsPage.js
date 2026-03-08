import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Edit,
  Users,
  Building2,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  
  const [formData, setFormData] = useState({
    company_name: '',
    trade_type: '',
    contact_name: '',
    email: '',
    phone: '',
    is_preferred: false,
    is_nominated: false,
    notes: '',
    typical_lead_time_days: '',
    typical_crew_size: '',
  });

  useEffect(() => {
    fetchSubcontractors();
  }, []);

  const fetchSubcontractors = async () => {
    try {
      const response = await api.get('/subcontractors');
      setSubcontractors(response.data);
    } catch (error) {
      toast.error('Failed to load subcontractors');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      trade_type: '',
      contact_name: '',
      email: '',
      phone: '',
      is_preferred: false,
      is_nominated: false,
      notes: '',
      typical_lead_time_days: '',
      typical_crew_size: '',
    });
    setEditingSub(null);
  };

  const handleOpenDialog = (sub = null) => {
    if (sub) {
      setEditingSub(sub);
      setFormData({
        company_name: sub.company_name,
        trade_type: sub.trade_type,
        contact_name: sub.contact_name || '',
        email: sub.email || '',
        phone: sub.phone || '',
        is_preferred: sub.is_preferred,
        is_nominated: sub.is_nominated,
        notes: sub.notes || '',
        typical_lead_time_days: sub.typical_lead_time_days?.toString() || '',
        typical_crew_size: sub.typical_crew_size?.toString() || '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const payload = {
      ...formData,
      typical_lead_time_days: formData.typical_lead_time_days ? parseInt(formData.typical_lead_time_days) : null,
      typical_crew_size: formData.typical_crew_size ? parseInt(formData.typical_crew_size) : null,
    };

    try {
      if (editingSub) {
        const response = await api.put(`/subcontractors/${editingSub.id}`, payload);
        setSubcontractors(subcontractors.map(s => s.id === editingSub.id ? response.data : s));
        toast.success('Subcontractor updated');
      } else {
        const response = await api.post('/subcontractors', payload);
        setSubcontractors([...subcontractors, response.data]);
        toast.success('Subcontractor added');
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubs = subcontractors.filter(sub =>
    sub.company_name.toLowerCase().includes(search.toLowerCase()) ||
    sub.trade_type.toLowerCase().includes(search.toLowerCase())
  );

  const trades = [...new Set(subcontractors.map(s => s.trade_type))];

  return (
    <div className="space-y-6" data-testid="subcontractors-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Subcontractors</h1>
          <p className="text-muted-foreground mt-1">Manage your subcontractor database</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="add-sub-btn">
              <Plus className="mr-2 h-4 w-4" />
              Add Subcontractor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{editingSub ? 'Edit Subcontractor' : 'Add Subcontractor'}</DialogTitle>
                <DialogDescription>
                  Enter the subcontractor details
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Company *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g. BOP Linings"
                    required
                    data-testid="sub-company"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Trade *</Label>
                  <Input
                    value={formData.trade_type}
                    onChange={(e) => setFormData({ ...formData, trade_type: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g. Gib Linings"
                    required
                    data-testid="sub-trade"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Contact</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="col-span-3"
                    placeholder="Contact name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="col-span-3"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="col-span-3"
                    placeholder="+64 21 xxx xxxx"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Lead Time</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input
                      type="number"
                      value={formData.typical_lead_time_days}
                      onChange={(e) => setFormData({ ...formData, typical_lead_time_days: e.target.value })}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">working days</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Crew Size</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input
                      type="number"
                      value={formData.typical_crew_size}
                      onChange={(e) => setFormData({ ...formData, typical_crew_size: e.target.value })}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">typical</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Preferred</Label>
                  <div className="col-span-3">
                    <Switch
                      checked={formData.is_preferred}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_preferred: checked })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Nominated</Label>
                  <div className="col-span-3">
                    <Switch
                      checked={formData.is_nominated}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_nominated: checked })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="col-span-3"
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} data-testid="save-sub-btn">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingSub ? 'Update' : 'Add'} Subcontractor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subcontractors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="search-subs"
        />
      </div>

      {/* Subcontractors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredSubs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No subcontractors found</h3>
            <p className="text-muted-foreground text-center mt-2">
              {search ? 'Try adjusting your search' : 'Add your first subcontractor to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubs.map((sub) => (
            <Card key={sub.id} className="card-hover" data-testid={`sub-card-${sub.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {sub.is_nominated && <Badge>Nominated</Badge>}
                    {sub.is_preferred && <Badge variant="outline">Preferred</Badge>}
                  </div>
                  <Badge variant={sub.is_active ? 'secondary' : 'outline'}>
                    {sub.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{sub.company_name}</CardTitle>
                <CardDescription>{sub.trade_type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sub.contact_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{sub.contact_name}</span>
                  </div>
                )}
                {sub.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{sub.phone}</span>
                  </div>
                )}
                {sub.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{sub.email}</span>
                  </div>
                )}
                {(sub.typical_lead_time_days || sub.typical_crew_size) && (
                  <div className="flex gap-4 text-sm text-muted-foreground pt-2 border-t">
                    {sub.typical_lead_time_days && (
                      <span>{sub.typical_lead_time_days} day lead</span>
                    )}
                    {sub.typical_crew_size && (
                      <span>{sub.typical_crew_size} crew</span>
                    )}
                  </div>
                )}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleOpenDialog(sub)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
