import { useNavigate, useLocation } from "react-router-dom";
import { Home, Grid3X3, Users, Wallet, User as UserIcon, LayoutDashboard, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isProvider } = useAuth();

  // Different nav items for providers vs users
  const userNavItems = [
    { path: "/home", icon: Home, label: "Home" },
    { path: "/services", icon: Grid3X3, label: "Services" },
    { path: "/providers", icon: Users, label: "Providers" },
    { path: "/wallet", icon: Wallet, label: "Wallet" },
    { path: "/profile", icon: UserIcon, label: "Profile" },
  ];

  const providerNavItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/my-services", icon: Grid3X3, label: "Services" },
    { path: "/wallet", icon: Wallet, label: "Wallet" },
    { path: "/profile", icon: Settings, label: "Settings" },
  ];

  const navItems = isProvider ? providerNavItems : userNavItems;

  const isActive = (path) => {
    if (path === "/home" && location.pathname === "/") return true;
    if (path === "/dashboard" && location.pathname === "/") return true;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg sm:hidden z-50">
      <nav className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                active
                  ? "text-purple-600"
                  : "text-gray-600 hover:text-purple-500"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5px]" : ""}`} />
              <span className={`text-xs ${active ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNavigation;
