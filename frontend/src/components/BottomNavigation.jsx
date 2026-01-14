import { useNavigate, useLocation } from "react-router-dom";
import { Home, Grid3X3, Users, Wallet, User as UserIcon, LayoutDashboard, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isProvider } = useAuth();

  // Different nav items for providers vs users - using new /user/* and /provider/* paths
  const userNavItems = [
    { path: "/user/home", icon: Home, label: "Home", legacyPaths: ["/home"] },
    { path: "/user/services", icon: Grid3X3, label: "Services", legacyPaths: ["/services"] },
    { path: "/user/providers", icon: Users, label: "Providers", legacyPaths: ["/providers", "/stylists"] },
    { path: "/user/wallet", icon: Wallet, label: "Wallet", legacyPaths: ["/wallet"] },
    { path: "/profile", icon: UserIcon, label: "Profile", legacyPaths: [] },
  ];

  const providerNavItems = [
    { path: "/provider/dashboard", icon: LayoutDashboard, label: "Dashboard", legacyPaths: ["/dashboard"] },
    { path: "/provider/services", icon: Grid3X3, label: "Services", legacyPaths: ["/my-services"] },
    { path: "/user/wallet", icon: Wallet, label: "Wallet", legacyPaths: ["/wallet"] },
    { path: "/profile", icon: Settings, label: "Settings", legacyPaths: [] },
  ];

  const navItems = isProvider ? providerNavItems : userNavItems;

  const isActive = (item) => {
    const currentPath = location.pathname;
    // Check primary path
    if (currentPath === item.path || currentPath.startsWith(item.path + "/")) return true;
    // Check legacy paths
    for (const legacy of item.legacyPaths || []) {
      if (currentPath === legacy || currentPath.startsWith(legacy + "/")) return true;
    }
    // Check root path
    if (item.path === "/user/home" && currentPath === "/") return true;
    if (item.path === "/provider/dashboard" && currentPath === "/") return true;
    return false;
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
