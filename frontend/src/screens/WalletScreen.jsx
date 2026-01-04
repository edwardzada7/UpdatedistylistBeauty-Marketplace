import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { walletsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME, CURRENCY, QUICK_TOPUP_AMOUNTS } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

export default function WalletScreen() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  // Placeholder transaction history for Phase 1
  const placeholderTransactions = [
    { id: 1, type: "credit", amount: 5000, description: "Wallet Top-up", date: "2024-01-15", status: "completed" },
    { id: 2, type: "debit", amount: 2500, description: "Service Payment - Hair Styling", date: "2024-01-14", status: "completed" },
    { id: 3, type: "credit", amount: 10000, description: "Wallet Top-up", date: "2024-01-10", status: "completed" },
  ];

  useEffect(() => {
    if (user) {
      fetchWallet();
    }
  }, [user]);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      // Try to get wallet by auth ID
      const response = await walletsAPI.getByAuthId(user.id);
      setWallet(response.data);
    } catch (error) {
      console.error("Failed to fetch wallet:", error);
      // Create a placeholder wallet display
      setWallet({ balance: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = (amount) => {
    toast.info(`Payment gateway coming in Phase 2! Selected: ${CURRENCY}${amount.toLocaleString()}`);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading wallet..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">My Wallet</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 text-white mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-purple-200 text-sm">Available Balance</p>
                <p className="text-3xl font-bold">
                  {CURRENCY}{(wallet?.balance || 0).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                className="flex-1 bg-white text-purple-700 hover:bg-purple-50"
                onClick={() => handleTopUp(5000)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Top Up
              </Button>
              <Button 
                variant="outline"
                className="flex-1 border-white/30 text-white hover:bg-white/10"
                onClick={() => toast.info("Withdrawal coming in Phase 2!")}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Top-up */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Quick Top-up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_TOPUP_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  className="h-12 text-sm font-medium hover:bg-purple-50 hover:border-purple-300"
                  onClick={() => handleTopUp(amount)}
                >
                  {CURRENCY}{(amount / 1000).toFixed(0)}k
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Transaction History</CardTitle>
              <Button variant="link" size="sm" className="text-purple-600">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {placeholderTransactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description="Your transaction history will appear here"
              />
            ) : (
              <div className="space-y-3">
                {placeholderTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        tx.type === "credit" 
                          ? "bg-green-100 text-green-600" 
                          : "bg-red-100 text-red-600"
                      }`}>
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {tx.date}
                        </div>
                      </div>
                    </div>
                    <p className={`font-semibold ${
                      tx.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}>
                      {tx.type === "credit" ? "+" : "-"}{CURRENCY}{tx.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Phase 2 Notice */}
            <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-sm text-purple-700 text-center">
                💳 Full payment integration coming in Phase 2
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
}
