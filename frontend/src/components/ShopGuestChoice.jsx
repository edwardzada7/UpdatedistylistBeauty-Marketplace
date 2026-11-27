import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { guestChoiceMade, rememberGuestChoice } from "@/utils/guestShop";

/** Shown once per visit to signed-out shoppers: Sign up / Sign in / Continue as guest. */
export default function ShopGuestChoice() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [open, setOpen] = useState(() => !guestChoiceMade());
  if (loading || isAuthenticated || !open) return null;

  const go = (path) => {
    rememberGuestChoice();
    try { sessionStorage.setItem("POST_LOGIN_REDIRECT", window.location.pathname); } catch (_) { /* ignore */ }
    navigate(path);
  };
  const guest = () => { rememberGuestChoice(); setOpen(false); };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="shop-guest-choice">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-xl font-bold text-center">Welcome to the iStylist Shop</h2>
        <p className="text-sm text-gray-600 text-center mt-2">
          Shop right away as a guest, or create an account to track orders, save favourites and ask sellers questions.
        </p>
        <Button className="w-full mt-5 bg-pink-600 hover:bg-pink-700 h-11 text-base" onClick={guest} data-testid="continue-guest">Continue as guest</Button>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="outline" onClick={() => go("/signup")}>Sign up</Button>
          <Button variant="outline" onClick={() => go("/login")}>Sign in</Button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">Guests can browse and buy. Asking questions, reviews and saving need an account.</p>
      </div>
    </div>
  );
}
