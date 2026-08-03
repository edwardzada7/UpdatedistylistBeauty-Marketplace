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
  { value: "all", label: "All posts" },
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

export default function AdminFeedModerationScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [editCaption, setEditCaption] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(key);
  }, [navigate]);

  const loadPosts = useCallback(
    async (key, filter = statusFilter) => {
      if (!key) return;
      try {
        setRefreshing(true);
        const resp = await adminAPI.feedPosts.list(key, filter, 100, 0);
        setPosts(resp.data?.posts || []);
      } catch (e) {
        if (e?.response?.status === 401) {
          sessionStorage.removeItem(ADMIN_KEY_STORAGE);
          toast.error("Session expired — please log in again");
          navigate("/admin", { replace: true });
          return;
        }
        toast.error(e?.response?.data?.detail || "Failed to load feed posts");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [navigate, statusFilter]
  );

  useEffect(() => {
    if (adminKey) {
      loadPosts(adminKey, statusFilter);
    }
  }, [adminKey, loadPosts, statusFilter]);

  const openPost = useCallback((post) => {
    setViewing(post);
    setEditCaption(post.caption || "");
    setEditActive(Boolean(post.is_active));
  }, []);

  const updatePost = useCallback(async () => {
    if (!viewing || !adminKey) return;
    setUpdating(true);
    try {
      await adminAPI.feedPosts.update(adminKey, viewing.id, {
        caption: editCaption.trim() || null,
        is_active: editActive,
      });
      toast.success("Feed post updated");
      setViewing(null);
      loadPosts(adminKey, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update post");
    } finally {
      setUpdating(false);
    }
  }, [adminKey, editCaption, editActive, loadPosts, statusFilter, viewing]);

  const toggleActive = useCallback(async (post) => {
    if (!adminKey) return;
    setUpdating(true);
    try {
      await adminAPI.feedPosts.update(adminKey, post.id, { is_active: !post.is_active });
      toast.success(`Post ${post.is_active ? "hidden" : "activated"}`);
      loadPosts(adminKey, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update post");
    } finally {
      setUpdating(false);
    }
  }, [adminKey, loadPosts, statusFilter]);

  const filteredPosts = useMemo(() => posts, [posts]);

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
              <h1 className="text-xl font-bold">Feed Moderation</h1>
              <p className="text-xs text-gray-500">Manage provider feed posts and visibility.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadPosts(adminKey, statusFilter)} disabled={refreshing}>
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
              <CardTitle className="text-base">Feed Posts</CardTitle>
              <CardDescription>Review active and inactive posts made by providers.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="feed-status-filter" className="text-xs">Filter</Label>
              <select
                id="feed-status-filter"
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
            {filteredPosts.length === 0 ? (
              <p className="text-sm text-gray-500 py-12 text-center">No feed posts found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Caption</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-mono text-xs">#{post.id}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{post.provider_name || post.provider_auth_id || "Unknown"}</div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[28rem] truncate">{post.caption || "—"}</TableCell>
                        <TableCell>{statusBadge(post.is_active)}</TableCell>
                        <TableCell className="text-xs text-gray-500">{post.created_at ? new Date(post.created_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openPost(post)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-gray-800 hover:bg-gray-900 text-white" onClick={() => toggleActive(post)} disabled={updating}>
                            {post.is_active ? "Hide" : "Activate"}
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
                <DialogTitle>Feed Post #{viewing.id}</DialogTitle>
                <DialogDescription>
                  Provider: {viewing.provider_name || viewing.provider_auth_id}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="post-caption">Caption</Label>
                  <Textarea
                    id="post-caption"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="post-active">Visibility</Label>
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
              </div>
              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setViewing(null)} disabled={updating}>
                  Cancel
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={updatePost} disabled={updating}>
                  {updating ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
