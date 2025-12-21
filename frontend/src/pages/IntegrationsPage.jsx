import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const IntegrationsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/settings">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
          <p className="text-gray-600 mb-8">Connect and manage your external services</p>

          <div className="space-y-4">
            <Link to="/settings/integrations/database">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="database-integration-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Database className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <CardTitle>Database</CardTitle>
                        <CardDescription>
                          Supabase PostgreSQL Database
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage your Supabase database integration with full CRUD operations for users, stylists, and wallets.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Users</Badge>
                    <Badge variant="secondary">Stylists</Badge>
                    <Badge variant="secondary">Wallets</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;