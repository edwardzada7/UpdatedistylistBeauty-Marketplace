import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WalletsTab = () => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [formData, setFormData] = useState({
    auth_id: "",
    balance: "",
    currency: "USD",
  });

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/wallets`);
      setWallets(response.data);
    } catch (error) {
      console.error("Failed to fetch wallets:", error);
      toast.error("Failed to load wallets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        auth_id: formData.auth_id,
        balance: parseFloat(formData.balance) || 0.0,
        currency: formData.currency,
      };
      await axios.post(`${API}/wallets`, payload);
      toast.success("Wallet created successfully");
      setIsCreateOpen(false);
      setFormData({ auth_id: "", balance: "", currency: "USD" });
      fetchWallets();
    } catch (error) {
      console.error("Failed to create wallet:", error);
      toast.error(error.response?.data?.detail || "Failed to create wallet");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        balance: parseFloat(formData.balance),
        currency: formData.currency,
      };
      await axios.put(`${API}/wallets/${editingWallet.id}`, payload);
      toast.success("Wallet updated successfully");
      setIsEditOpen(false);
      setEditingWallet(null);
      setFormData({ auth_id: "", balance: "", currency: "USD" });
      fetchWallets();
    } catch (error) {
      console.error("Failed to update wallet:", error);
      toast.error(error.response?.data?.detail || "Failed to update wallet");
    }
  };

  const handleDelete = async (walletId) => {
    if (!window.confirm("Are you sure you want to delete this wallet?")) return;
    try {
      await axios.delete(`${API}/wallets/${walletId}`);
      toast.success("Wallet deleted successfully");
      fetchWallets();
    } catch (error) {
      console.error("Failed to delete wallet:", error);
      toast.error(error.response?.data?.detail || "Failed to delete wallet");
    }
  };

  const openEditDialog = (wallet) => {
    setEditingWallet(wallet);
    setFormData({
      auth_id: wallet.auth_id,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
    });
    setIsEditOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Wallets</h3>
          <p className="text-sm text-gray-600">Manage user wallet balances</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" data-testid="create-wallet-btn">
              <Plus className="h-4 w-4" />
              Create Wallet
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="create-wallet-dialog">
            <DialogHeader>
              <DialogTitle>Create New Wallet</DialogTitle>
              <DialogDescription>
                Add a new wallet for a user
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="wallet-auth-id">Auth ID *</Label>
                  <Input
                    id="wallet-auth-id"
                    value={formData.auth_id}
                    onChange={(e) => setFormData({ ...formData, auth_id: e.target.value })}
                    placeholder="user-auth-id-123"
                    required
                    data-testid="wallet-auth-id-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must match an existing user's auth_id</p>
                </div>
                <div>
                  <Label htmlFor="balance">Initial Balance</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    placeholder="0.00"
                    data-testid="wallet-balance-input"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger data-testid="wallet-currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" data-testid="submit-create-wallet-btn">Create Wallet</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading wallets...
          </CardContent>
        </Card>
      ) : wallets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No wallets found. Create your first wallet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table data-testid="wallets-table">
            <TableHeader>
              <TableRow>
                <TableHead>Balance</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Auth ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((wallet) => (
                <TableRow key={wallet.id} data-testid={`wallet-row-${wallet.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-lg">{wallet.balance.toFixed(2)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{wallet.currency}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {wallet.auth_id.substring(0, 12)}...
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(wallet.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(wallet)}
                        data-testid={`edit-wallet-${wallet.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(wallet.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-wallet-${wallet.id}`}
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
        <DialogContent data-testid="edit-wallet-dialog">
          <DialogHeader>
            <DialogTitle>Edit Wallet</DialogTitle>
            <DialogDescription>
              Update wallet balance and currency
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-balance">Balance *</Label>
                <Input
                  id="edit-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" data-testid="submit-edit-wallet-btn">Update Wallet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletsTab;
