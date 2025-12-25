import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Wallet, Plus, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { walletsAPI } from "@/services/api";
import { CURRENCY, MIN_TOPUP_AMOUNT, QUICK_TOPUP_AMOUNTS, TOAST_MESSAGES } from "@/utils/constants";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNavigation from "@/components/BottomNavigation";

const WalletScreen = ({ currentUser }) => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const response = await walletsAPI.getByAuthId(currentUser.auth_id);
      setWallet(response.data);
    } catch (error) {
      // If wallet doesn't exist, create one
      if (error.response?.status === 404) {
        await createWallet();
      } else {
        console.error("Failed to fetch wallet:", error);
        toast.error("Failed to load wallet");
      }
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    try {
      const response = await walletsAPI.create({
        user_auth_id: currentUser.auth_id,
        balance: 0.0,
      });
      setWallet(response.data);
      toast.success("Wallet created successfully!");
    } catch (error) {
      console.error("Failed to create wallet:", error);
      toast.error("Failed to create wallet");
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);

    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount < MIN_TOPUP_AMOUNT) {
      toast.error(`Minimum top-up amount is ${CURRENCY}${MIN_TOPUP_AMOUNT}`);
      return;
    }

    setProcessing(true);

    try {
      const response = await walletsAPI.topUp(wallet.id, amount);
      setWallet((prev) => ({ ...prev, balance: response.data.new_balance }));
      toast.success(`${CURRENCY}${amount.toLocaleString()} added to your wallet!`);
      setIsTopUpOpen(false);
      setTopUpAmount("");
    } catch (error) {
      console.error("Failed to top up wallet:", error);
      toast.error(TOAST_MESSAGES.WALLET_TOPUP_FAILED);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading wallet..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">My Wallet</h1>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 pb-24 sm:pb-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-purple-600 to-pink-600 text-white border-0 shadow-xl" data-testid="balance-card">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-purple-100 text-sm mb-2">Available Balance</p>
                  <p className="text-4xl font-bold">
                    {CURRENCY}{wallet?.balance?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
              <Button
                onClick={() => setIsTopUpOpen(true)}
                className="w-full bg-white text-purple-600 hover:bg-purple-50"
                size="lg"
                data-testid="topup-btn"
              >
                <Plus className="mr-2 h-5 w-5" />
                Top Up Wallet
              </Button>
            </CardContent>
          </Card>

          {/* Quick Top-Up */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Top-Up</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_TOPUP_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    className="h-16 text-lg font-semibold"
                    onClick={() => {
                      setTopUpAmount(amount.toString());
                      setIsTopUpOpen(true);
                    }}
                    data-testid={`quick-topup-${amount}`}
                  >
                    {CURRENCY}{amount.toLocaleString()}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Top up your wallet to book stylists instantly</li>
                    <li>• Secure payments with no hidden fees</li>
                    <li>• Pay only for confirmed bookings</li>
                    <li>• Refunds processed within 24 hours</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs mt-1">Transaction history coming in Phase 2</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top-Up Dialog */}
      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent data-testid="topup-dialog">
          <DialogHeader>
            <DialogTitle>Top Up Wallet</DialogTitle>
            <DialogDescription>
              Add funds to your wallet for seamless bookings
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTopUp}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="amount">Amount (NGN) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min={MIN_TOPUP_AMOUNT}
                  step="100"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder={`Enter amount (min. ${CURRENCY}${MIN_TOPUP_AMOUNT})`}
                  required
                  data-testid="topup-amount-input"
                  className="mt-2"
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Amount to add</span>
                  <span className="font-medium">
                    {CURRENCY}{topUpAmount ? parseFloat(topUpAmount).toLocaleString() : "0"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Processing fee</span>
                  <span className="font-medium text-green-600">{CURRENCY}0.00</span>
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">
                    {CURRENCY}{topUpAmount ? parseFloat(topUpAmount).toLocaleString() : "0"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                🛡️ This is a simulation. In production, integrate with payment gateway.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTopUpOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={processing}
                data-testid="confirm-topup-btn"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Top-Up"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default WalletScreen;