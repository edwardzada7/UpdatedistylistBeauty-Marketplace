import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { shopApi, lineKey } from "@/services/shopApi";
import { setPendingGuestOrder, saveGuestShopOrder } from "@/utils/guestShop";
import { formatNaira } from "@/screens/ShopScreen";
import ShopHeader from "@/components/ShopHeader";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

export const PENDING_ORDER_KEY = "istylist_pending_shop_order";

export default function CartScreen() {
  const navigate = useNavigate();
  const { lines, setQuantity, removeItem, total } = useCart();
  const { isAuthenticated, userData, user, isProvider } = useAuth();
  const [address, setAddress] = useState({ street: "", city: "", state: "", phone: userData?.phone || "" });
  const [guest, setGuest] = useState({ name: "", email: "" });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  const ownItem = userData?.auth_id && lines.some((l) => l.stylistAuthId === userData.auth_id);

  const checkout = async () => {
    setError(null);
    if (!isAuthenticated) {
      const { street, city, state, phone } = Object.fromEntries(Object.entries(address).map(([k, v]) => [k, v.trim()]));
      const name = guest.name.trim();
      const gemail = guest.email.trim();
      if (!name || !/^\S+@\S+\.\S+$/.test(gemail)) { setError("Enter your name and a valid email. We send your order link there."); return; }
      if (!street || !city || !state || !phone) { setError("Please complete every delivery field."); return; }
      setPaying(true);
      try {
        const r = await shopApi.createGuestOrder({ lines, name, email: gemail, phone, address: `${street}, ${city}, ${state}` });
        if (!r.authorization_url) throw new Error("Could not start payment. Please try again.");
        setPendingGuestOrder({ orderId: r.order_id, token: r.access_token });
        saveGuestShopOrder({ orderId: r.order_id, token: r.access_token, total: r.total_amount, at: Date.now() });
        window.location.href = r.authorization_url;
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || "Could not start checkout. Please try again.");
        setPaying(false);
      }
      return;
    }
    if (isProvider) {
      setError("Provider accounts can't place customer orders. Please use a customer account.");
      return;
    }
    const email = userData?.email || user?.email;
    if (!email || !userData?.auth_id) {
      setError("Please complete your profile before paying.");
      return;
    }
    if (ownItem) {
      setError("Remove your own products from the cart. You can't buy from yourself.");
      return;
    }
    const { street, city, state, phone } = Object.fromEntries(Object.entries(address).map(([k, v]) => [k, v.trim()]));
    if (!street || !city || !state || !phone) {
      setError("Please complete every delivery field.");
      return;
    }
    setPaying(true);
    try {
      const { orderId, items, amount } = await shopApi.createOrder({
        customerAuthId: userData.auth_id,
        lines,
        shippingAddress: `${street}, ${city}, ${state}`,
        note: `Phone: ${phone}`,
      });
      const url = await shopApi.startPayment({ orderId, amount, email, items });
      try {
        localStorage.setItem(PENDING_ORDER_KEY, String(orderId));
      } catch {
        /* optional - verification also works from the payment reference */
      }
      window.location.href = url;
    } catch (err) {
      console.error("[shop] checkout failed", err);
      setError(err?.response?.data?.detail || err?.message || "Could not start checkout. Please try again.");
      setPaying(false);
    }
  };

  if (lines.length === 0)
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
        <ShopHeader title="Cart" backTo="/shop" />
        <div className="text-center py-20">
          <ShoppingBag className="h-14 w-14 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 mb-4">Your cart is empty.</p>
          <Button onClick={() => navigate("/shop")}>Browse the shop</Button>
        </div>
        <BottomNavSpacer />
        <BottomNavigation />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      <ShopHeader title="Cart" subtitle={`${lines.length} ${lines.length === 1 ? "item" : "items"}`} backTo="/shop" />
      <div className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-3xl space-y-6">
        <div className="space-y-3">
          {lines.map((l) => {
            const key = lineKey(l);
            return (
              <div key={key} className="bg-white rounded-xl border p-3 flex gap-3" data-testid="cart-line">
                <div className="h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-6 w-6 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{l.name}</p>
                  {l.sellerName && <p className="text-xs text-gray-500 truncate">by {l.sellerName}</p>}
                  <p className="text-pink-600 font-bold mt-1">{formatNaira(l.price)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border rounded-lg">
                      <Button variant="ghost" size="sm" onClick={() => setQuantity(key, l.quantity - 1)} aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></Button>
                      <span className="w-7 text-center text-sm font-medium">{l.quantity}</span>
                      <Button variant="ghost" size="sm" onClick={() => setQuantity(key, l.quantity + 1)} aria-label="Increase"><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(key)} aria-label={`Remove ${l.name}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Delivery details</h2>
          {!isAuthenticated && (
            <>
              <p className="text-xs text-gray-500">Checking out as a guest. <button type="button" className="underline text-pink-600" onClick={() => navigate("/login")}>Sign in</button> or <button type="button" className="underline text-pink-600" onClick={() => navigate("/signup")}>sign up</button> to track orders in your account.</p>
              <div><Label htmlFor="g-name">Full name</Label><Input id="g-name" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} /></div>
              <div><Label htmlFor="g-email">Email (your order link is sent here)</Label><Input id="g-email" type="email" value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} /></div>
            </>
          )}
          {[
            ["street", "Street address"],
            ["city", "City"],
            ["state", "State"],
            ["phone", "Phone number"],
          ].map(([field, label]) => (
            <div key={field}>
              <Label htmlFor={`addr-${field}`}>{label}</Label>
              <Input id={`addr-${field}`} value={address[field]} type={field === "phone" ? "tel" : "text"} onChange={(e) => setAddress((a) => ({ ...a, [field]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span data-testid="cart-total">{formatNaira(total)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">You'll pay securely with Paystack. Delivery arrangements are made with the seller after payment.</p>
          {error && <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>}
          <Button className="w-full mt-4 bg-pink-600 hover:bg-pink-700" onClick={checkout} disabled={paying} data-testid="checkout-button">
            {paying ? "Starting payment..." : `Pay ${formatNaira(total)}${isAuthenticated ? "" : " as guest"}`}
          </Button>
        </div>
      </div>
      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}
