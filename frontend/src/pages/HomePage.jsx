import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Database, Users, Wallet } from "lucide-react";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Supabase Integration</h1>
          <Link to="/settings">
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Supabase Integration
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Manage your database, users, stylists, and wallets seamlessly
          </p>
          <Link to="/settings/integrations/database">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
              <Database className="mr-2 h-5 w-5" />
              Configure Database
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow" data-testid="users-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Users</CardTitle>
              </div>
              <CardDescription>
                Manage user accounts and profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create, view, update, and delete user records with authentication support.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="stylists-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Stylists</CardTitle>
              </div>
              <CardDescription>
                Manage stylist profiles and services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Track stylist specialties, rates, and availability linked to user accounts.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="wallets-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Wallets</CardTitle>
              </div>
              <CardDescription>
                Manage user wallet balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Handle financial transactions and wallet balances for each user.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HomePage;