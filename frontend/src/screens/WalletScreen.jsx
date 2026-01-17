import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, Wallet, Plus, ArrowUpRight, ArrowDownLeft, 
  Clock, CheckCircle, Loader2, RefreshCcw,
  Lock, TrendingUp, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { walletsAPI, paymentsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENCY, QUICK_TOPUP_AMOUNTS } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

export default function WalletScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userData, isProvider } = useAuth();
  
  const [wallet, setWallet] = useState({
    available_balance: 0,
    escrow_balance: 0,
    total_balance: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Fetch wallet data function
  const fetchWalletData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Fetch wallet balances
      const walletResponse = await walletsAPI.getMyWallet(user.id);
      setWallet(walletResponse.data);
      
      // Fetch transactions
      const txResponse = await walletsAPI.getTransactions(user.id, 50);
      setTransactions(txResponse.data || []);
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      // Set default values on error
      setWallet({
        available_balance: 0,
        escrow_balance: 0,
        total_balance: 0
      });
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Check for payment callback on mount
  useEffect(() => {
    const reference = searchParams.get("reference");
    const trxref = searchParams.get("trxref");
    
    const verifyPayment = async (ref) => {
      setVerifyingPayment(true);
      try {
        const response = await paymentsAPI.verify(ref);
        if (response.data.status === "success") {
          toast.success(`Payment successful! ${CURRENCY}${response.data.amount?.toLocaleString()} added to your wallet.`);
        } else {
          toast.error(`Payment ${response.data.status}: ${response.data.message}`);
        }
        // Clear URL params and refresh
        navigate("/wallet", { replace: true });
      } catch (error) {
        console.error("Payment verification failed:", error);
        toast.error("Failed to verify payment. Please contact support if funds were deducted.");
      } finally {
        setVerifyingPayment(false);
      }
    };
    
    if (reference || trxref) {
      verifyPayment(reference || trxref);
    }
  }, [searchParams, navigate]);

  // Fetch wallet data on user change
  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user, fetchWalletData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount < 100) {
      toast.error("Minimum top-up amount is ₦100");
      return;
    }

    if (!userData?.email) {
      toast.error("User email not found. Please complete your profile.");
      return;
    }

    setProcessingPayment(true);
    try {
      const response = await paymentsAPI.initialize({
        amount: amount,
        email: userData.email,
        purpose: "wallet_topup"
      });

      if (response.data.status && response.data.authorization_url) {
        toast.info("Redirecting to payment page...");
        // Redirect to Paystack checkout
        window.location.href = response.data.authorization_url;
      } else {
        toast.error(response.data.message || "Failed to initialize payment");
      }
    } catch (error) {
      console.error("Payment initialization failed:", error);
      const errorMsg = error.response?.data?.detail || "Failed to initialize payment";
      toast.error(errorMsg);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleQuickTopUp = (amount) => {
    setTopUpAmount(amount.toString());
    setShowTopUpModal(true);
  };

  const getTransactionIcon = (type, direction) => {
    if (type === "TOPUP" || type === "ESCROW_REFUND") {
      return <ArrowDownLeft className="h-4 w-4" />;
    }
    if (type === "EARNINGS") {
      return <TrendingUp className="h-4 w-4" />;
    }
    if (type === "ESCROW_HOLD" || type === "ESCROW_RELEASE") {
      return <Lock className="h-4 w-4" />;
    }
    if (direction === "CREDIT") {
      return <ArrowDownLeft className="h-4 w-4" />;
    }
    return <ArrowUpRight className="h-4 w-4" />;
  };

  const getTransactionColor = (type, direction) => {
    if (type === "TOPUP" || type === "EARNINGS" || type === "ESCROW_REFUND") {
      return "bg-green-100 text-green-600";
    }
    if (type === "ESCROW_HOLD") {
      return "bg-amber-100 text-amber-600";
    }
    if (type === "ESCROW_RELEASE") {
      return "bg-blue-100 text-blue-600";
    }
    if (direction === "CREDIT") {
      return "bg-green-100 text-green-600";
    }
    return "bg-red-100 text-red-600";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading wallet..." />;
  }

  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Verifying payment...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your transaction</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 pb-24 md:pb-8">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              data-testid="wallet-back-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">My Wallet</h1>
              <p className="text-xs text-gray-500">{isProvider ? "Earnings & Payments" : "Your Balance"}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={refreshing}
            data-testid="wallet-refresh-btn"
          >
            <RefreshCcw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-6 w-6" />
              <span className="text-purple-200 text-sm">
                {isProvider ? "Total Earnings" : "Total Balance"}
              </span>
            </div>
            
            <div className="space-y-4">
              {/* Available Balance */}
              <div>
                <p className="text-purple-200 text-sm">Available Balance</p>
                <p className="text-4xl font-bold" data-testid="available-balance">
                  {CURRENCY}{(wallet.available_balance || 0).toLocaleString()}
                </p>
              </div>
              
              {/* Escrow Balance (for customers) */}
              {!isProvider && wallet.escrow_balance > 0 && (
                <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-purple-200" />
                    <span className="text-purple-200 text-sm">In Escrow</span>
                  </div>
                  <span className="font-semibold" data-testid="escrow-balance">
                    {CURRENCY}{(wallet.escrow_balance || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Top Up Button (for customers only) */}
            {!isProvider && (
              <Button 
                className="w-full mt-6 bg-white text-purple-700 hover:bg-purple-50"
                onClick={() => setShowTopUpModal(true)}
                data-testid="topup-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Top Up Wallet
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick Top Up (for customers) */}
        {!isProvider && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                Quick Top Up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_TOPUP_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    className="border-purple-200 hover:bg-purple-50 hover:border-purple-400"
                    onClick={() => handleQuickTopUp(amount)}
                    data-testid={`quick-topup-${amount}`}
                  >
                    {CURRENCY}{amount.toLocaleString()}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description={isProvider ? "Your earnings will appear here" : "Your transactions will appear here after you make a payment"}
              />
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, idx) => (
                  <div
                    key={tx.id || idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    data-testid={`transaction-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${getTransactionColor(tx.type, tx.direction)}`}>
                        {getTransactionIcon(tx.type, tx.direction)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.description || tx.type}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDate(tx.created_at)}
                        </div>
                      </div>
                    </div>
                    <p className={`font-semibold ${
                      tx.direction === "CREDIT" ? "text-green-600" : "text-red-600"
                    }`}>
                      {tx.direction === "CREDIT" ? "+" : "-"}{CURRENCY}{(tx.amount || 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-purple-600" />
                Top Up Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Amount ({CURRENCY})
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="mt-1"
                  min="100"
                  data-testid="topup-amount-input"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum: {CURRENCY}100</p>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-3 gap-2">
                {[1000, 2000, 5000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setTopUpAmount(amount.toString())}
                    className="text-xs"
                  >
                    {CURRENCY}{amount.toLocaleString()}
                  </Button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowTopUpModal(false);
                    setTopUpAmount("");
                  }}
                  disabled={processingPayment}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleTopUp}
                  disabled={processingPayment || !topUpAmount}
                  data-testid="confirm-topup-btn"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Pay {topUpAmount ? `${CURRENCY}${parseFloat(topUpAmount).toLocaleString()}` : ""}
                    </>
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-center text-gray-500">
                You will be redirected to Paystack for secure payment
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
