import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { staffAPI, providerServicesAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Pencil, Trash2, Calendar, ListChecks, User, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const blankWeekly = () =>
  DAYS.map((_, i) => ({ day_of_week: i, is_available: false, start_time: "09:00", end_time: "17:00" }));

export default function ProviderStaffScreen() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const authId = userData?.auth_id;
  const providerId = userData?.id;

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);

  // Profile dialog
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(null); // null=create
  const [profileForm, setProfileForm] = useState({
    name: "", role: "", photo_url: "", bio: "", is_active: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Services dialog
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesEditing, setServicesEditing] = useState(null);
  const [servicesSelected, setServicesSelected] = useState({});
  const [savingServices, setSavingServices] = useState(false);

  // Availability dialog
  const [availOpen, setAvailOpen] = useState(false);
  const [availEditing, setAvailEditing] = useState(null);
  const [weekly, setWeekly] = useState(blankWeekly());
  const [savingAvail, setSavingAvail] = useState(false);

  const servicesMap = useMemo(() => {
    const m = {};
    (services || []).forEach((s) => {
      m[s.id] = s;
    });
    return m;
  }, [services]);

  const loadStaff = async () => {
    if (!authId) return;
    try {
      const res = await staffAPI.listMine(authId, true);
      setStaff(res.data?.staff || []);
    } catch (e) {
      const msg = e?.response?.data?.detail || "";
      if (msg.includes("migration") || e?.response?.status === 503) {
        toast.error("Multi-staff not enabled yet. Run the SQL migration in Supabase.");
      } else {
        toast.error("Failed to load staff");
      }
      setStaff([]);
    }
  };

  const loadServices = async () => {
    if (!providerId) return;
    try {
      const res = await providerServicesAPI.getByProviderId(providerId);
      // Map sub_service_name into a simple list of services owned by the provider.
      // We bind staff_services.service_id to the services table id (services.id).
      // But the provider-services endpoint returns provider_services records.
      // For business catalog selection here we use the same IDs that bookings use.
      // The bookings flow uses services.id. The provider_services table is separate.
      // To stay safe we'll show whatever items are returned (id + sub_service_name).
      setServices(
        (res.data || []).map((s) => ({
          id: s.id,
          name: s.sub_service_name || s.name || `Service #${s.id}`,
          price: s.price,
          duration_minutes: s.duration_minutes,
          is_active: s.is_active,
        }))
      );
    } catch {
      setServices([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStaff(), loadServices()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authId, providerId]);

  // ---------- Profile create/edit ----------
  const openCreateStaff = () => {
    setProfileEditing(null);
    setProfileForm({ name: "", role: "", photo_url: "", bio: "", is_active: true });
    setProfileOpen(true);
  };

  const openEditStaff = (s) => {
    setProfileEditing(s);
    setProfileForm({
      name: s.name || "",
      role: s.role || "",
      photo_url: s.photo_url || "",
      bio: s.bio || "",
      is_active: !!s.is_active,
    });
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingProfile(true);
    try {
      if (profileEditing) {
        await staffAPI.update(profileEditing.id, authId, profileForm);
        toast.success("Staff updated");
      } else {
        await staffAPI.create(authId, profileForm);
        toast.success("Staff added");
      }
      setProfileOpen(false);
      await loadStaff();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save staff");
    } finally {
      setSavingProfile(false);
    }
  };

  const removeStaff = async (s) => {
    if (!window.confirm(`Hide ${s.name} from booking? (Soft-delete: keeps history.)`)) return;
    try {
      await staffAPI.remove(s.id, authId, false);
      toast.success("Staff hidden");
      await loadStaff();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to remove staff");
    }
  };

  // ---------- Services picker ----------
  const openServices = (s) => {
    setServicesEditing(s);
    const initial = {};
    (s.service_ids || []).forEach((id) => {
      initial[id] = true;
    });
    setServicesSelected(initial);
    setServicesOpen(true);
  };

  const saveServices = async () => {
    if (!servicesEditing) return;
    setSavingServices(true);
    try {
      const ids = Object.keys(servicesSelected)
        .filter((k) => servicesSelected[k])
        .map((k) => parseInt(k, 10));
      await staffAPI.setServices(servicesEditing.id, authId, ids);
      toast.success("Services updated");
      setServicesOpen(false);
      await loadStaff();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save services");
    } finally {
      setSavingServices(false);
    }
  };

  // ---------- Availability ----------
  const openAvailability = async (s) => {
    setAvailEditing(s);
    try {
      const res = await staffAPI.get(s.id);
      const existing = res.data?.weekly || [];
      const map = {};
      existing.forEach((d) => {
        map[d.day_of_week] = d;
      });
      const merged = blankWeekly().map((d) => {
        const found = map[d.day_of_week];
        if (!found) return d;
        return {
          day_of_week: d.day_of_week,
          is_available: !!found.is_available,
          start_time: (found.start_time || "09:00").slice(0, 5),
          end_time: (found.end_time || "17:00").slice(0, 5),
        };
      });
      setWeekly(merged);
    } catch {
      setWeekly(blankWeekly());
    }
    setAvailOpen(true);
  };

  const updateWeekly = (idx, patch) => {
    setWeekly((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const saveAvailability = async () => {
    if (!availEditing) return;
    setSavingAvail(true);
    try {
      await staffAPI.setAvailability(availEditing.id, authId, weekly);
      toast.success("Availability saved");
      setAvailOpen(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save availability");
    } finally {
      setSavingAvail(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading staff..." />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/provider/dashboard")}
              data-testid="staff-back-btn"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Manage Staff</h1>
          </div>
          <Button
            onClick={openCreateStaff}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="staff-add-btn"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Staff
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-3" data-testid="staff-list">
        {staff.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <User className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">No staff yet</p>
              <p className="text-sm">
                Add stylists or barbers who work under your salon. Customers will be able to book a specific staff member.
              </p>
            </CardContent>
          </Card>
        ) : (
          staff.map((s) => (
            <Card key={s.id} data-testid={`staff-row-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{s.name}</h3>
                      {!s.is_active && (
                        <Badge variant="secondary" className="text-xs">Hidden</Badge>
                      )}
                    </div>
                    {s.role && <p className="text-sm text-gray-500">{s.role}</p>}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3 w-3" /> {(s.service_ids || []).length} services
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditStaff(s)}
                    data-testid={`staff-edit-${s.id}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openServices(s)}
                    data-testid={`staff-services-${s.id}`}
                  >
                    <ListChecks className="h-3 w-3 mr-1" /> Services
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAvailability(s)}
                    data-testid={`staff-availability-${s.id}`}
                  >
                    <Calendar className="h-3 w-3 mr-1" /> Schedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeStaff(s)}
                    data-testid={`staff-remove-${s.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Hide
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md" data-testid="staff-profile-dialog">
          <DialogHeader>
            <DialogTitle>{profileEditing ? "Edit Staff" : "Add Staff"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="staff-name">Name *</Label>
              <Input
                id="staff-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="e.g. Jane Doe"
                data-testid="staff-name-input"
              />
            </div>
            <div>
              <Label htmlFor="staff-role">Role</Label>
              <Input
                id="staff-role"
                value={profileForm.role}
                onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                placeholder="e.g. Senior Stylist"
                data-testid="staff-role-input"
              />
            </div>
            <div>
              <Label htmlFor="staff-photo">Photo URL</Label>
              <Input
                id="staff-photo"
                value={profileForm.photo_url}
                onChange={(e) => setProfileForm({ ...profileForm, photo_url: e.target.value })}
                placeholder="https://..."
                data-testid="staff-photo-input"
              />
            </div>
            <div>
              <Label htmlFor="staff-bio">Bio</Label>
              <Textarea
                id="staff-bio"
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                rows={3}
                data-testid="staff-bio-input"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="staff-active">Visible to customers</Label>
              <Switch
                id="staff-active"
                checked={profileForm.is_active}
                onCheckedChange={(v) => setProfileForm({ ...profileForm, is_active: v })}
                data-testid="staff-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="staff-save-btn"
            >
              {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {profileEditing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Services Dialog */}
      <Dialog open={servicesOpen} onOpenChange={setServicesOpen}>
        <DialogContent className="max-w-md" data-testid="staff-services-dialog">
          <DialogHeader>
            <DialogTitle>
              Services {servicesEditing ? `for ${servicesEditing.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {services.length === 0 ? (
              <p className="text-sm text-gray-500">
                Add services in "My Services" first, then assign them here.
              </p>
            ) : (
              services.map((sv) => (
                <label
                  key={sv.id}
                  className="flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Checkbox
                    checked={!!servicesSelected[sv.id]}
                    onCheckedChange={(v) =>
                      setServicesSelected({ ...servicesSelected, [sv.id]: !!v })
                    }
                    data-testid={`staff-service-cb-${sv.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sv.name}</p>
                    <p className="text-xs text-gray-500">{sv.duration_minutes} min</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicesOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveServices}
              disabled={savingServices || services.length === 0}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="staff-services-save-btn"
            >
              {savingServices && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability Dialog */}
      <Dialog open={availOpen} onOpenChange={setAvailOpen}>
        <DialogContent className="max-w-md" data-testid="staff-availability-dialog">
          <DialogHeader>
            <DialogTitle>
              Schedule {availEditing ? `for ${availEditing.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {weekly.map((d, i) => (
              <div key={d.day_of_week} className="border rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium w-12">{DAYS[d.day_of_week]}</span>
                  <Switch
                    checked={d.is_available}
                    onCheckedChange={(v) => updateWeekly(i, { is_available: v })}
                    data-testid={`staff-day-toggle-${d.day_of_week}`}
                  />
                </div>
                {d.is_available && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      type="time"
                      value={d.start_time}
                      onChange={(e) => updateWeekly(i, { start_time: e.target.value })}
                      className="flex-1"
                      data-testid={`staff-day-start-${d.day_of_week}`}
                    />
                    <Input
                      type="time"
                      value={d.end_time}
                      onChange={(e) => updateWeekly(i, { end_time: e.target.value })}
                      className="flex-1"
                      data-testid={`staff-day-end-${d.day_of_week}`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveAvailability}
              disabled={savingAvail}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="staff-availability-save-btn"
            >
              {savingAvail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}
