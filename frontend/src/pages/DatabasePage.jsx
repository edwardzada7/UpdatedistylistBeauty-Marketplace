import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Database, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import UsersTab from "@/components/database/UsersTab";
import StylistsTab from "@/components/database/StylistsTab";
import WalletsTab from "@/components/database/WalletsTab";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DatabasePage = () => {
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [dbInfo, setDbInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("users");

  const testConnection = async () => {
    setConnectionStatus("checking");
    try {
      const response = await axios.get(`${API}/test-connection`);
      setDbInfo(response.data);
      setConnectionStatus("connected");
      toast.success("Database connection successful");
    } catch (error) {
      console.error("Connection test failed:", error);
      setConnectionStatus("disconnected");
      toast.error("Database connection failed");
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/settings/integrations">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Integrations
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Database Integration</h1>
              <p className="text-gray-600">Manage your Supabase PostgreSQL database</p>
            </div>
            <Button
              onClick={testConnection}
              variant="outline"
              className="flex items-center gap-2"
              disabled={connectionStatus === "checking"}
              data-testid="test-connection-btn"
            >
              <RefreshCw className={`h-4 w-4 ${connectionStatus === "checking" ? "animate-spin" : ""}`} />
              Test Connection
            </Button>
          </div>

          {/* Connection Status Card */}
          <Card className="mb-8" data-testid="connection-status-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-indigo-600" />
                  <div>
                    <CardTitle>Connection Status</CardTitle>
                    <CardDescription>Supabase PostgreSQL Database</CardDescription>
                  </div>
                </div>
                {connectionStatus === "connected" && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {connectionStatus === "disconnected" && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Disconnected
                  </Badge>
                )}
                {connectionStatus === "checking" && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Checking...
                  </Badge>
                )}
              </div>
            </CardHeader>
            {dbInfo && (
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Database Type</p>
                    <p className="font-medium">{dbInfo.database}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">URL</p>
                    <p className="font-medium text-xs truncate">{dbInfo.url}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Setup Instructions Alert */}
          {connectionStatus === "disconnected" && (
            <Alert className="mb-8 border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-800">
                <strong>Setup Required:</strong> Please run the SQL setup script in your Supabase dashboard.
                <br />
                <span className="text-sm">
                  Go to SQL Editor in Supabase and execute the script from <code className="bg-amber-100 px-1 rounded">/app/backend/setup_supabase.sql</code>
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* CRUD Tabs */}
          <Card data-testid="database-tables-card">
            <CardHeader>
              <CardTitle>Manage Tables</CardTitle>
              <CardDescription>
                Create, read, update, and delete records in your database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="users" data-testid="users-tab">Users</TabsTrigger>
                  <TabsTrigger value="stylists" data-testid="stylists-tab">Stylists</TabsTrigger>
                  <TabsTrigger value="wallets" data-testid="wallets-tab">Wallets</TabsTrigger>
                </TabsList>
                <TabsContent value="users" className="mt-6">
                  <UsersTab />
                </TabsContent>
                <TabsContent value="stylists" className="mt-6">
                  <StylistsTab />
                </TabsContent>
                <TabsContent value="wallets" className="mt-6">
                  <WalletsTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DatabasePage;
