import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RefreshCcw, Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const STATUS_OPTIONS = [
  { value: "all", label: "All products" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
];

function statusBadge(isActive) {
  return (
    <Badge className={isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

export default function AdminShopModerationScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [editPrice, setEditPrice] = useState(0);
  const [editStock, setEditStock] = useState(0);
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editApproved, setEditApproved] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(key);
  }, [navigate]);

  const loadServices = useCallback(
    async (key, filter = statusFilter) => {
      if (!key) return;
      try {
        setRefreshing(true);
        const resp = await adminAPI.shopServices.list(key, filter, 100, 0);
        setServices(resp.data?.services || []);
      } catch (e) {
        if (e?.response?.status === 401) {
          sessionStorage.removeItem(ADMIN_KEY_STORAGE);
          toast.error("Session expired — please log in again");
          navigate("/admin", { replace: true });
          return;
        }
        toast.error(e?.response?.data?.detail || "Failed to load shop services");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [navigate, statusFilter]
  );

  useEffect(() => {
    if (adminKey) {
      loadServices(adminKey, statusFilter);
    }
  }, [adminKey, loadServices, statusFilter]);

  const openService = useCallback((service) => {
    setViewing(service);
    setEditPrice(service.price || 0);
    setEditStock(service.stock || 0);
    setEditDescription(service.description || "");
    setEditActive(Boolean(service.is_active));
    setEditApproved(Boolean(service.is_approved));
  }, []);

  const updateService = useCallback(async () => {
    if (!viewing || !adminKey) return;
    setUpdating(true);
    try {
      await adminAPI.shopServices.update(adminKey, viewing.id, {
        price: Number(editPrice) || 0,
        description: editDescription.trim() || null,
        stock: Number(editStock) || 0,
        is_active: editActive,
      });
      toast.success("Product updated");
      setViewing(null);
      loadServices(adminKey, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update service");
    } finally {
      setUpdating(false);
    }
  }, [adminKey, editPrice, editDescription, editStock, editActive, loadServices, statusFilter, viewing]);

  const toggleActive = useCallback(async (service) => {
    if (!adminKey) return;
    setUpdating(true);
    try {
      await adminAPI.shopServices.update(adminKey, service.id, { is_active: !service.is_active });
      toast.success(`Product ${service.is_active ? "hidden" : "activated"}`);
      loadServices(adminKey, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update product");
    } finally {
      setUpdating(false);
    }
  }, [adminKey, loadServices, statusFilter]);

  const performAction = useCallback(async (service, action) => {
    if (!adminKey) return;
    setUpdating(true);
    try {
      await adminAPI.shopServices.update(adminKey, service.id, { action });
      toast.success(`Action ${action} performed`);
      loadServices(adminKey, statusFilter);
      setViewing(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setUpdating(false);
    }
  }, [adminKey, loadServices, statusFilter]);

  const filteredServices = useMemo(() => services, [services]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Shop Moderation</h1>
              <p className="text-xs text-gray-500">Manage marketplace product listings and visibility.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadServices(adminKey, statusFilter)} disabled={refreshing}>
              <RefreshCcw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => { sessionStorage.removeItem(ADMIN_KEY_STORAGE); navigate("/admin", { replace: true }); }}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Shop Products</CardTitle>
              <CardDescription>Review marketplace product listings and moderate as needed.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="shop-status-filter" className="text-xs">Filter</Label>
              <select
                id="shop-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm bg-white"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredServices.length === 0 ? (
              <p className="text-sm text-gray-500 py-12 text-center">No shop services found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-mono text-xs">#{service.id}</TableCell>
                        <TableCell className="text-sm">
                          {service.seller_name || service.seller_id || "Unknown"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[28rem] truncate flex items-center gap-2">
                          {service.image_urls && service.image_urls[0] ? (
                            <img src={service.image_urls[0]} alt={service.name} className="h-8 w-8 object-cover rounded" />
                          ) : null}
                          <div className="truncate">{service.name}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">₦{Number(service.price || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{service.stock ?? 0}</TableCell>
                        <TableCell>{service.is_approved ? <Badge className="bg-blue-100 text-blue-800">Approved</Badge> : <Badge className="bg-yellow-100 text-yellow-800">Unapproved</Badge>}</TableCell>
                        <TableCell>{statusBadge(service.is_active)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openService(service)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-gray-800 hover:bg-gray-900 text-white" onClick={() => toggleActive(service)} disabled={updating}>
                            {service.is_active ? "Hide" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!viewing} onOpenChange={(open) => { if (!open && !updating) setViewing(null); }}>
        <DialogContent>
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>Product #{viewing.id}</DialogTitle>
                <DialogDescription>
                  Seller: {viewing.seller_name || viewing.seller_id}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {viewing.image_urls && viewing.image_urls[0] ? (
                  <img src={viewing.image_urls[0]} alt={viewing.name} className="w-full h-48 object-cover rounded" />
                ) : null}
                <div>
                  <Label htmlFor="service-price">Price</Label>
                  <Input
                    id="service-price"
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="service-stock">Stock</Label>
                  <Input
                    id="service-stock"
                    type="number"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="service-description">Description</Label>
                  <Textarea
                    id="service-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <Label>Visibility</Label>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        className={`rounded-md px-3 py-2 border ${editActive ? "border-green-500 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700"}`}
                        onClick={() => setEditActive(true)}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-3 py-2 border ${!editActive ? "border-red-500 bg-red-50 text-red-700" : "border-gray-300 bg-white text-gray-700"}`}
                        onClick={() => setEditActive(false)}
                      >
                        Inactive
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Approval</Label>
                    <div className="mt-2">
                      <Badge className={editApproved ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}>
                        {editApproved ? "Approved" : "Unapproved"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setViewing(null)} disabled={updating}>
                  Cancel
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={updateService} disabled={updating}>
                  {updating ? "Saving…" : "Save Changes"}
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => performAction(viewing, 'approve')} disabled={updating}>
                  Approve
                </Button>
                <Button className="bg-yellow-600 hover:bg-yellow-700 text-white" onClick={() => performAction(viewing, 'unapprove')} disabled={updating}>
                  Unapprove
                </Button>
                <Button className="bg-gray-800 hover:bg-black text-white" onClick={() => performAction(viewing, 'hide')} disabled={updating}>
                  Hide
                </Button>
                <Button className="bg-green-800 hover:bg-green-900 text-white" onClick={() => performAction(viewing, 'restore')} disabled={updating}>
                  Restore
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
