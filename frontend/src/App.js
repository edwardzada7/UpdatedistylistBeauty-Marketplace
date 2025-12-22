import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomeScreen from "@/screens/HomeScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import StylistsListScreen from "@/screens/StylistsListScreen";
import StylistProfileScreen from "@/screens/StylistProfileScreen";
import WalletScreen from "@/screens/WalletScreen";
import { Toaster } from "@/components/ui/sonner";

// Mock current user - In production, this would come from auth
const MOCK_USER = {
  id: 11,
  auth_id: "demo-user-auth-id",
  name: "Sarah Johnson",
  email: "sarah@example.com",
  phone: "+2348012345678",
  role: "customer"
};

function App() {
  const [currentUser, setCurrentUser] = useState(MOCK_USER);

  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          <Route path="/" element={<HomeScreen currentUser={currentUser} />} />
          <Route path="/profile" element={<ProfileScreen currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
          <Route path="/stylists" element={<StylistsListScreen currentUser={currentUser} />} />
          <Route path="/stylists/:userId" element={<StylistProfileScreen currentUser={currentUser} />} />
          <Route path="/wallet" element={<WalletScreen currentUser={currentUser} />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;