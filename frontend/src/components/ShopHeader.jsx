import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ShopHeader({ title, subtitle, backTo = "/user/home", children }) {
  const navigate = useNavigate();
  const { count } = useCart();
  const { isAuthenticated } = useAuth();
  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(backTo)} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
          {isAuthenticated && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/shop/orders")} data-testid="shop-orders-button" aria-label="My orders">
              <Package className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="relative" onClick={() => navigate("/shop/cart")} data-testid="shop-cart-button" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-600 text-white text-[10px] font-bold flex items-center justify-center">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>
        </div>
        {children}
      </div>
    </header>
  );
}
