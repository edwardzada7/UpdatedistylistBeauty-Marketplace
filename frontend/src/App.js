import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import SettingsPage from "@/pages/SettingsPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import DatabasePage from "@/pages/DatabasePage";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/integrations" element={<IntegrationsPage />} />
          <Route path="/settings/integrations/database" element={<DatabasePage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;