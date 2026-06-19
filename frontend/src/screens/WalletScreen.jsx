import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, Wallet, Plus, ArrowUpRight, ArrowDownLeft, 
  Clock, CheckCircle, Loader2, RefreshCcw,
  Lock, TrendingUp, CreditCard, Banknote, Building2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { walletsAPI, paymentsAPI, withdrawalsAPI, providersAPI } from "@/services/api";
import { settingsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENCY, QUICK_TOPUP_AMOUNTS } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

// ====================================================================
// Transaction display helpers (Phase: Wallet & Earnings Fix)
// Backend now returns normalized `type` (TOPUP, ESCROW_HOLD, ESCROW_RELEASE,
// REFUND, WITHDRAWAL, PAYOUT, ADJUSTMENT) and uppercase `direction` (CREDIT/DEBIT).
// ====================================================================
const TX_LABELS = {
  TOPUP: "Wallet Top-Up",
  ESCROW_HOLD: "Escrow Hold",
  ESCROW_RELEASE: "Escrow Release",
  REFUND: "Refund",
  WITHDRAWAL: "Withdrawal",
  PAYOUT: "Payout",
  ADJUSTMENT: "Adjustment",
};

const TX_ICON = (type, direction) => {
  if (type === "ESCROW_RELEASE") return <TrendingUp className="h-4 w-4" />;
  if (type === "ESCROW_HOLD") return <Lock className="h-4 w-4" />;
  if (type === "WITHDRAWAL" || type === "PAYOUT") return <Banknote className="h-4 w-4" />;
  if (type === "REFUND") return <ArrowDownLeft className="h-4 w-4" />;
  if (type === "TOPUP") return <Plus className="h-4 w-4" />;
  return (direction || "").toUpperCase() === "CREDIT"
    ? <ArrowDownLeft className="h-4 w-4" />
    : <ArrowUpRight className="h-4 w-4" />;
};

const TX_COLOR = (type, direction) => {
  const dir = (direction || "").toUpperCase();
  if (type === "ESCROW_RELEASE") return "bg-emerald-100 text-emerald-700";
  if (type === "TOPUP" || type === "REFUND") return "bg-green-100 text-green-700";
  if (type === "ESCROW_HOLD") return "bg-amber-100 text-amber-700";
  if (type === "WITHDRAWAL" || type === "PAYOUT") return "bg-indigo-100 text-indigo-700";
  if (type === "ADJUSTMENT") return "bg-gray-100 text-gray-700";
  return dir === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
};

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
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  // Provider earnings summary (only used when isProvider)
  const [earnings, setEarnings] = useState({
    total_earnings: 0,
    last_7_days_earnings: 0,
    last_30_days_earnings: 0,
    pending_withdrawals_total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  
  // Withdrawal state (for providers)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  // Phase 7 - admin-configured withdrawal fee settings (live preview)
  const [feeSettings, setFeeSettings] = useState({
    fee_percentage: 0,
    min_withdrawal: 0,
    max_withdrawal: null,
    currency: "NGN",
  });
  useEffect(() => {
    let cancelled = false;
    settingsAPI
      .getWithdrawalFee()
      .then((res) => {
        if (!cancelled) setFeeSettings(res.data || feeSettings);
      })
      .catch(() => { /* keep defaults */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch wallet data function
  const fetchWalletData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Fetch wallet balances
      const walletResponse = await walletsAPI.getMyWallet(user.id);
      setWallet(walletResponse.data);
      
      // Fetch transactions (same auth_id for both customer and provider)
      const txResponse = await walletsAPI.getTransactions(user.id, 50);
      setTransactions(txResponse.data || []);
      
      // For providers, also fetch withdrawal requests + earnings summary
      if (isProvider) {
        try {
          const withdrawalResponse = await withdrawalsAPI.getMyRequests(user.id, 20);
          setWithdrawalRequests(withdrawalResponse.data || []);
        } catch (err) {
          console.error("Failed to fetch withdrawal requests:", err);
          setWithdrawalRequests([]);
        }

        try {
          const metricsResp = await providersAPI.getDashboardMetrics(user.id);
          const m = metricsResp.data || {};
          setEarnings({
            total_earnings: Number(m.total_earnings) || 0,
            last_7_days_earnings: Number(m.last_7_days_earnings) || 0,
            last_30_days_earnings: Number(m.last_30_days_earnings) || 0,
            pending_withdrawals_total: Number(m.pending_withdrawals_total) || 0,
          });
        } catch (err) {
          console.error("Failed to fetch earnings metrics:", err);
          setEarnings({
            total_earnings: 0,
            last_7_days_earnings: 0,
            last_30_days_earnings: 0,
            pending_withdrawals_total: 0,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      // Set default values on error
      setWallet({
        available_balance: 0,
        escrow_balance: 0,
        total_balance: 0
      });
      setTransactions([]);
      setWithdrawalRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isProvider]);

  // Check for payment callback on mount.
  // Flutterwave appends: ?status=successful&tx_ref=...&transaction_id=...
  // Legacy Paystack appended: ?reference=...&trxref=...
  // We accept all of them so we can roll back without breaking the redirect.
  useEffect(() => {
    const reference = searchParams.get("reference");
    const trxref = searchParams.get("trxref");
    const txRef = searchParams.get("tx_ref");
    const transactionId = searchParams.get("transaction_id");
    const flwStatus = searchParams.get("status"); // 'successful' | 'cancelled' | 'failed'

    const ref = reference || trxref || txRef;
    if (!ref && !transactionId) return;

    // If user cancelled at the gateway, skip verify and just clean the URL.
    if (flwStatus && flwStatus !== "successful" && flwStatus !== "completed") {
      toast.error(`Payment ${flwStatus}. No funds were deducted.`);
      navigate("/wallet", { replace: true });
      return;
    }

    const verifyPayment = async () => {
      setVerifyingPayment(true);
      try {
        const response = await paymentsAPI.verify(ref, transactionId);
        if (response.data.status === "success") {
          toast.success(
            `Payment successful! ${CURRENCY}${response.data.amount?.toLocaleString()} added to your wallet.`
          );
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

    verifyPayment();
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
        purpose: "wallet_topup",
        name: userData.name || undefined,
        phone: userData.phone || undefined,
        // Bring the user back to this exact screen after payment.
        redirect_url: `${window.location.origin}/wallet`,
      });

      if (response.data.status && response.data.authorization_url) {
        toast.info("Redirecting to secure payment page...");
        // Redirect to Flutterwave hosted checkout
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

  // Handle withdrawal request (for providers)
  const handleWithdrawRequest = async () => {
    const amount = parseFloat(withdrawAmount);
    
    // Validation
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (amount > (wallet.available_balance || 0)) {
      toast.error("Insufficient balance");
      return;
    }
    
    if (!bankName.trim()) {
      toast.error("Please enter your bank name");
      return;
    }
    
    if (!accountName.trim()) {
      toast.error("Please enter the account holder name");
      return;
    }
    
    if (!accountNumber || accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      toast.error("Please enter a valid 10-digit account number");
      return;
    }
    
    setProcessingWithdraw(true);
    try {
      const response = await withdrawalsAPI.request(user.id, {
        amount,
        bank_name: bankName.trim(),
        account_name: accountName.trim(),
        account_number: accountNumber,
        note: withdrawNote.trim() || null
      });
      
      if (response.data.ok) {
        toast.success("Withdrawal request submitted successfully!");
        // Reset form
        setWithdrawAmount("");
        setBankName("");
        setAccountName("");
        setAccountNumber("");
        setWithdrawNote("");
        setShowWithdrawModal(false);
        // Refresh data
        fetchWalletData();
      } else {
        toast.error(response.data.message || "Failed to submit withdrawal request");
      }
    } catch (error) {
      console.error("Withdrawal request failed:", error);
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === "object" && errorDetail.message) {
        // Phase 7 - structured errors (below_minimum, above_maximum, kyc_required, etc.)
        toast.error(errorDetail.message);
      } else if (typeof errorDetail === "object" && errorDetail.error === "Insufficient balance") {
        toast.error(`${errorDetail.error}. Available: ${CURRENCY}${errorDetail.available?.toLocaleString()}`);
      } else {
        toast.error(typeof errorDetail === "string" ? errorDetail : "Failed to submit withdrawal request");
      }
    } finally {
      setProcessingWithdraw(false);
    }
  };

  const getWithdrawalStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">Pending</span>;
      case "approved":
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Approved</span>;
      case "rejected":
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Rejected</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">{status}</span>;
    }
  };

  const getTransactionIcon = (type, direction) => TX_ICON(type, direction);

  const getTransactionColor = (type, direction) => TX_COLOR(type, direction);

  const getTransactionLabel = (tx) => {
    const label = TX_LABELS[tx?.type] || "Transaction";
    if (tx?.booking_id) return `${label} • Booking #${tx.booking_id}`;
    return label;
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

            {/* Withdraw Button (for providers only) */}
            {isProvider && (
              <Button 
                className="w-full mt-6 bg-white text-purple-700 hover:bg-purple-50"
                onClick={() => setShowWithdrawModal(true)}
                disabled={(wallet.available_balance || 0) <= 0}
                data-testid="withdraw-btn"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Withdraw Funds
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Provider Earnings Summary (only for providers) */}
        {isProvider && (
          <Card data-testid="earnings-summary-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Earnings Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 rounded-lg p-3" data-testid="earnings-total">
                  <p className="text-[11px] text-emerald-700 font-medium uppercase tracking-wide">All Time</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-700 truncate">
                    {CURRENCY}{(earnings.total_earnings || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3" data-testid="earnings-30d">
                  <p className="text-[11px] text-indigo-700 font-medium uppercase tracking-wide">30 Days</p>
                  <p className="text-base sm:text-lg font-bold text-indigo-700 truncate">
                    {CURRENCY}{(earnings.last_30_days_earnings || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3" data-testid="earnings-7d">
                  <p className="text-[11px] text-purple-700 font-medium uppercase tracking-wide">7 Days</p>
                  <p className="text-base sm:text-lg font-bold text-purple-700 truncate">
                    {CURRENCY}{(earnings.last_7_days_earnings || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Secondary row: escrow + pending withdrawals */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(wallet.escrow_balance || 0) > 0 && (
                  <div className="flex items-center justify-between bg-amber-50 rounded-lg p-2.5" data-testid="provider-escrow">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                      <Lock className="h-3 w-3" /> In Escrow
                    </span>
                    <span className="text-sm font-bold text-amber-800">
                      {CURRENCY}{(wallet.escrow_balance || 0).toLocaleString()}
                    </span>
                  </div>
                )}
                {(earnings.pending_withdrawals_total || 0) > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg p-2.5" data-testid="pending-withdrawals">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-blue-800">
                      <Clock className="h-3 w-3" /> Pending Withdrawal
                    </span>
                    <span className="text-sm font-bold text-blue-800">
                      {CURRENCY}{(earnings.pending_withdrawals_total || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Withdrawal Requests (for providers) */}
        {isProvider && withdrawalRequests.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Withdrawal Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {withdrawalRequests.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    data-testid={`withdrawal-request-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <Banknote className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {CURRENCY}{(req.amount || req.gross_amount || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {req.bank_name} • ****{req.account_number?.slice(-4)}
                        </p>
                        {/* Phase 7 - Fee breakdown if recorded */}
                        {(req.fee_amount != null || req.net_amount != null) && (
                          <p className="text-xs text-gray-600 mt-1" data-testid={`req-fee-breakdown-${idx}`}>
                            Fee: {CURRENCY}{Number(req.fee_amount || 0).toLocaleString()}
                            <span className="mx-1">•</span>
                            Received: <span className="font-medium text-purple-700">
                              {CURRENCY}{Number(req.net_amount ?? req.amount ?? 0).toLocaleString()}
                            </span>
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDate(req.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getWithdrawalStatusBadge(req.status)}
                    </div>
                  </div>
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
                {transactions.map((tx, idx) => {
                  const dir = (tx.direction || "").toUpperCase();
                  const isCredit = dir === "CREDIT";
                  return (
                    <div
                      key={tx.id || idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`transaction-${idx}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-full flex-shrink-0 ${getTransactionColor(tx.type, dir)}`}>
                          {getTransactionIcon(tx.type, dir)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {getTransactionLabel(tx)}
                          </p>
                          {tx.description && (
                            <p className="text-xs text-gray-500 truncate">{tx.description}</p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDate(tx.created_at)}
                            {tx.status && tx.status !== "completed" && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 uppercase">
                                {tx.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className={`font-semibold whitespace-nowrap ${
                        isCredit ? "text-green-600" : "text-red-600"
                      }`}>
                        {isCredit ? "+" : "-"}{CURRENCY}{(tx.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
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
                You will be redirected to Flutterwave for secure payment
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdrawal Modal (for providers) */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-purple-600" />
                Withdraw Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Available balance display */}
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Available Balance</p>
                <p className="text-xl font-bold text-purple-700">
                  {CURRENCY}{(wallet.available_balance || 0).toLocaleString()}
                </p>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Amount ({CURRENCY})</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="Enter amount to withdraw"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="100"
                  max={wallet.available_balance || 0}
                  data-testid="withdraw-amount-input"
                />
                {feeSettings.min_withdrawal > 0 && (
                  <p className="text-xs text-gray-500" data-testid="min-withdrawal-hint">
                    Minimum withdrawal: {CURRENCY}{Number(feeSettings.min_withdrawal).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Phase 7 - Live Fee Preview */}
              {withdrawAmount && Number(withdrawAmount) > 0 && (() => {
                const gross = Math.round(parseFloat(withdrawAmount) * 100) / 100;
                const feePct = Number(feeSettings.fee_percentage) || 0;
                const fee = Math.round(gross * (feePct / 100) * 100) / 100;
                const net = Math.max(0, Math.round((gross - fee) * 100) / 100);
                return (
                  <div
                    className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-sm space-y-1"
                    data-testid="withdraw-fee-preview"
                  >
                    <div className="flex justify-between">
                      <span className="text-gray-700">Requested Amount:</span>
                      <span className="font-semibold" data-testid="preview-gross">
                        {CURRENCY}{gross.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">
                        Platform Fee ({feePct}%):
                      </span>
                      <span className="font-semibold text-amber-700" data-testid="preview-fee">
                        {CURRENCY}{fee.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-purple-200">
                      <span className="text-gray-900 font-medium">Amount You Will Receive:</span>
                      <span className="font-bold text-purple-700" data-testid="preview-net">
                        {CURRENCY}{net.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Bank Name */}
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input
                  id="bank-name"
                  type="text"
                  placeholder="e.g., GTBank, First Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  data-testid="bank-name-input"
                />
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Holder Name</Label>
                <Input
                  id="account-name"
                  type="text"
                  placeholder="Name on the bank account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  data-testid="account-name-input"
                />
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <Label htmlFor="account-number">Account Number</Label>
                <Input
                  id="account-number"
                  type="text"
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setAccountNumber(val);
                  }}
                  maxLength={10}
                  data-testid="account-number-input"
                />
              </div>

              {/* Note (optional) */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-note">Note (optional)</Label>
                <Input
                  id="withdraw-note"
                  type="text"
                  placeholder="Any additional notes"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  data-testid="withdraw-note-input"
                />
              </div>

              {/* Info message */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Withdrawal requests are processed manually via bank transfer. 
                  Please allow 24-48 hours for review and processing.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount("");
                    setBankName("");
                    setAccountName("");
                    setAccountNumber("");
                    setWithdrawNote("");
                  }}
                  disabled={processingWithdraw}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleWithdrawRequest}
                  disabled={processingWithdraw || !withdrawAmount || !bankName || !accountName || !accountNumber}
                  data-testid="confirm-withdraw-btn"
                >
                  {processingWithdraw ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
