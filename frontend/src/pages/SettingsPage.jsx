import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, Plug } from "lucide-react";

const SettingsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 mb-8">Manage your application configuration</p>

          <div className="space-y-4">
            <Link to="/settings/integrations">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="integrations-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <Plug className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle>Integrations</CardTitle>
                      <CardDescription>
                        Configure third-party integrations and services
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Manage database connections, API integrations, and external services.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;