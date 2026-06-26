import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Shield, LogOut, Save, FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { legalPagesAPI, legalAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

/**
 * AdminLegalEditorScreen - Phase 9 Legal Page Editor
 * 
 * Edit legal pages: Privacy, Terms, Community Guidelines, Refund Policy
 */
export default function AdminLegalEditorScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("privacy");
  const [saving, setSaving] = useState(false);

  const [pages, setPages] = useState({
    privacy: { content: "", last_updated: null },
    terms: { content: "", last_updated: null },
    "community-guidelines": { content: "", last_updated: null },
    "refund-policy": { content: "", last_updated: null },
  });

  const [editedContent, setEditedContent] = useState("");

  useEffect(() => {
    const k = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!k) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(k);
  }, [navigate]);

  const loadAllPages = useCallback(async () => {
    try {
      setLoading(true);
      // Load all legal pages
      const slugs = ["privacy", "terms", "community-guidelines", "refund-policy"];
      const responses = await Promise.all(
        slugs.map((slug) => legalAPI.get(slug).catch(() => null))
      );

      const newPages = {};
      slugs.forEach((slug, idx) => {
        const resp = responses[idx];
        if (resp?.data) {
          newPages[slug] = {
            content: resp.data.content || "",
            last_updated: resp.data.last_updated,
          };
        } else {
          newPages[slug] = { content: "", last_updated: null };
        }
      });

      setPages(newPages);
      setEditedContent(newPages[activeTab]?.content || "");
    } catch (e) {
      toast.error("Failed to load legal pages");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadAllPages();
  }, [loadAllPages]);

  // Update edited content when tab changes
  useEffect(() => {
    setEditedContent(pages[activeTab]?.content || "");
  }, [activeTab, pages]);

  const handleSave = useCallback(async () => {
    if (!adminKey) return;

    try {
      setSaving(true);
      await legalPagesAPI.adminUpdate(adminKey, activeTab, editedContent);
      
      // Update local state
      setPages((prev) => ({
        ...prev,
        [activeTab]: {
          content: editedContent,
          last_updated: new Date().toISOString(),
        },
      }));

      toast.success(`${getPageTitle(activeTab)} updated successfully`);
    } catch (e) {
      if (e?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        toast.error("Session expired");
        navigate("/admin", { replace: true });
      } else {
        toast.error(e?.response?.data?.detail || "Failed to update page");
      }
    } finally {
      setSaving(false);
    }
  }, [adminKey, activeTab, editedContent, navigate]);

  const getPageTitle = (slug) => {
    const titles = {
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      "community-guidelines": "Community Guidelines",
      "refund-policy": "Refund Policy",
    };
    return titles[slug] || slug;
  };

  const hasUnsavedChanges = editedContent !== (pages[activeTab]?.content || "");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Legal Pages Editor</h1>
                <p className="text-xs text-gray-500">Edit platform legal documents</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                  navigate("/admin");
                }}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {hasUnsavedChanges && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center text-yellow-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="privacy">
              <FileText className="h-4 w-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="terms">
              <FileText className="h-4 w-4 mr-2" />
              Terms
            </TabsTrigger>
            <TabsTrigger value="community-guidelines">
              <FileText className="h-4 w-4 mr-2" />
              Guidelines
            </TabsTrigger>
            <TabsTrigger value="refund-policy">
              <FileText className="h-4 w-4 mr-2" />
              Refund
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{getPageTitle(activeTab)}</CardTitle>
                    {pages[activeTab]?.last_updated && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last updated: {new Date(pages[activeTab].last_updated).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Write or paste your legal content below. Supports plain text and Markdown.
                    </p>
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      placeholder={`Enter ${getPageTitle(activeTab)} content...`}
                      rows={25}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {editedContent.length} characters
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <a
                      href={`/${activeTab}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 hover:underline"
                    >
                      Preview live page →
                    </a>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditedContent(pages[activeTab]?.content || "")}
                        disabled={!hasUnsavedChanges}
                      >
                        Reset
                      </Button>
                      <Button onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
