import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "GUEST_PROMPT_DISMISSED";

/** Slim banner for signed-out visitors: "Sign up or sign in for more". Hidden for signed-in users. */
export default function GuestPromptBar() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch (_) { return false; }
  });
  if (loading || isAuthenticated || hidden) return null;

  const goAuth = (path) => {
    try { sessionStorage.setItem("POST_LOGIN_REDIRECT", window.location.pathname); } catch (_) { /* storage unavailable */ }
    navigate(path);
  };
  const dismiss = () => {
    setHidden(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch (_) { /* storage unavailable */ }
  };

  return (
    <div className="bg-purple-700 text-white" data-testid="guest-prompt-bar">
      <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Sign up or sign in for more: book stylists, chat, save favourites &amp; more.</p>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-white text-purple-700 hover:bg-white/90 h-8" onClick={() => goAuth("/signup")}>Sign up</Button>
          <Button size="sm" variant="outline" className="bg-transparent text-white border-white/70 hover:bg-white/10 h-8" onClick={() => goAuth("/login")}>Sign in</Button>
          <button type="button" aria-label="Dismiss" className="p-1 opacity-80 hover:opacity-100" onClick={dismiss}><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
