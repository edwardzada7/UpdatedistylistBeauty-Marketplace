import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Scissors } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StylistsTab = () => {
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStylist, setEditingStylist] = useState(null);
  const [formData, setFormData] = useState({
    auth_id: "",
    name: "",
    specialty: "",
    bio: "",
    hourly_rate: "",
  });

  const fetchStylists = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/stylists`);
      setStylists(response.data);
    } catch (error) {
      console.error("Failed to fetch stylists:", error);
      toast.error("Failed to load stylists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStylists();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      };
      await axios.post(`${API}/stylists`, payload);
      toast.success("Stylist created successfully");
      setIsCreateOpen(false);
      setFormData({ auth_id: "", name: "", specialty: "", bio: "", hourly_rate: "" });
      fetchStylists();
    } catch (error) {
      console.error("Failed to create stylist:", error);
      toast.error(error.response?.data?.detail || "Failed to create stylist");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        specialty: formData.specialty,
        bio: formData.bio,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      };
      await axios.put(`${API}/stylists/${editingStylist.id}`, payload);
      toast.success("Stylist updated successfully");
      setIsEditOpen(false);
      setEditingStylist(null);
      setFormData({ auth_id: "", name: "", specialty: "", bio: "", hourly_rate: "" });
      fetchStylists();
    } catch (error) {
      console.error("Failed to update stylist:", error);
      toast.error(error.response?.data?.detail || "Failed to update stylist");
    }
  };

  const handleDelete = async (stylistId) => {
    if (!window.confirm("Are you sure you want to delete this stylist?")) return;
    try {
      await axios.delete(`${API}/stylists/${stylistId}`);
      toast.success("Stylist deleted successfully");
      fetchStylists();
    } catch (error) {
      console.error("Failed to delete stylist:", error);
      toast.error(error.response?.data?.detail || "Failed to delete stylist");
    }
  };

  const openEditDialog = (stylist) => {
    setEditingStylist(stylist);
    setFormData({
      auth_id: stylist.auth_id,
      name: stylist.name,
      specialty: stylist.specialty,
      bio: stylist.bio || "",
      hourly_rate: stylist.hourly_rate || "",
    });
    setIsEditOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Stylists</h3>
          <p className="text-sm text-gray-600">Manage stylist profiles</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" data-testid="create-stylist-btn">
              <Plus className="h-4 w-4" />
              Create Stylist
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="create-stylist-dialog">
            <DialogHeader>
              <DialogTitle>Create New Stylist</DialogTitle>
              <DialogDescription>
                Add a new stylist profile
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                <div>
                  <Label htmlFor="stylist-auth-id">Auth ID *</Label>
                  <Input
                    id="stylist-auth-id"
                    value={formData.auth_id}
                    onChange={(e) => setFormData({ ...formData, auth_id: e.target.value })}
                    placeholder="user-auth-id-123"
                    required
                    data-testid="stylist-auth-id-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must match an existing user's auth_id</p>
                </div>
                <div>
                  <Label htmlFor="stylist-name">Name *</Label>
                  <Input
                    id="stylist-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Smith"
                    required
                    data-testid="stylist-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="specialty">Specialty *</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="Hair Styling, Makeup, etc."
                    required
                    data-testid="stylist-specialty-input"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Professional bio..."
                    rows={3}
                    data-testid="stylist-bio-input"
                  />
                </div>
                <div>
                  <Label htmlFor="hourly-rate">Hourly Rate (USD)</Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    placeholder="50.00"
                    data-testid="stylist-rate-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" data-testid="submit-create-stylist-btn">Create Stylist</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading stylists...
          </CardContent>
        </Card>
      ) : stylists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Scissors className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No stylists found. Create your first stylist profile.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table data-testid="stylists-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Auth ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stylists.map((stylist) => (
                <TableRow key={stylist.id} data-testid={`stylist-row-${stylist.id}`}>
                  <TableCell className="font-medium">{stylist.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{stylist.specialty}</Badge>
                  </TableCell>
                  <TableCell>
                    {stylist.hourly_rate ? (
                      <span className="font-medium">${stylist.hourly_rate}/hr</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {stylist.auth_id.substring(0, 12)}...
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(stylist.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(stylist)}
                        data-testid={`edit-stylist-${stylist.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(stylist.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-stylist-${stylist.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent data-testid="edit-stylist-dialog">
          <DialogHeader>
            <DialogTitle>Edit Stylist</DialogTitle>
            <DialogDescription>
              Update stylist information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
              <div>
                <Label htmlFor="edit-stylist-name">Name *</Label>
                <Input
                  id="edit-stylist-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-specialty">Specialty *</Label>
                <Input
                  id="edit-specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-bio">Bio</Label>
                <Textarea
                  id="edit-bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-hourly-rate">Hourly Rate (USD)</Label>
                <Input
                  id="edit-hourly-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" data-testid="submit-edit-stylist-btn">Update Stylist</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StylistsTab;