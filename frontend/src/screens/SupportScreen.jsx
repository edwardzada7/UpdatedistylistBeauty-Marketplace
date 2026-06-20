import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, LifeBuoy, Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supportAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import Footer from "@/components/Footer";

const CATEGORIES = [
  { value: "account",          label: "Account" },
  { value: "booking",          label: "Booking" },
  { value: "payment",          label: "Payment" },
  { value: "provider",         label: "Provider" },
  { value: "technical_issue",  label: "Technical Issue" },
  { value: "abuse_report",     label: "Abuse Report" },
  { value: "other",            label: "Other" },
];

export default function SupportScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, userData } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: params.get("category") || "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    // Prefill name + email when logged in
    setForm((f) => ({
      ...f,
      name: f.name || userData?.name || user?.user_metadata?.full_name || "",
      email: f.email || userData?.email || user?.email || "",
    }));
  }, [user, userData]);

  const handleChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.category || !form.subject.trim() || !form.message.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      await supportAPI.create({
        user_auth_id: userData?.auth_id || user?.id || null,
        name: form.name.trim(),
        email: form.email.trim(),
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Failed to submit ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="support-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-bold">Contact Support</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        {submitted ? (
          <Card data-testid="support-success-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                We received your message
              </CardTitle>
              <CardDescription>
                Our team typically replies within 1 business day at <strong>{form.email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/")} data-testid="support-go-home-btn">
                  Back to Home
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    setSubmitted(false);
                    setForm((f) => ({ ...f, subject: "", message: "" }));
                  }}
                  data-testid="support-new-ticket-btn"
                >
                  Submit another
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How can we help?</CardTitle>
              <CardDescription>
                Send us a message — accounts, bookings, payments, abuse reports, or anything else.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="support-form">
                <div>
                  <Label htmlFor="s-name">Your Name *</Label>
                  <Input
                    id="s-name"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="mt-2"
                    data-testid="support-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="s-email">Email *</Label>
                  <Input
                    id="s-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="mt-2"
                    data-testid="support-email-input"
                  />
                </div>
                <div>
                  <Label htmlFor="s-category">Category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => handleChange("category", v)}
                  >
                    <SelectTrigger id="s-category" className="mt-2" data-testid="support-category-select">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="s-subject">Subject *</Label>
                  <Input
                    id="s-subject"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    className="mt-2"
                    data-testid="support-subject-input"
                  />
                </div>
                <div>
                  <Label htmlFor="s-message">Message *</Label>
                  <Textarea
                    id="s-message"
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    rows={6}
                    className="mt-2"
                    placeholder="Please describe your issue in detail…"
                    data-testid="support-message-input"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={loading}
                  data-testid="support-submit-btn"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Send Message</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
