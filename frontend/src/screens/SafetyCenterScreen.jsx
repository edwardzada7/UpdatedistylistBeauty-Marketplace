import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Flag, LifeBuoy, FileText, Trash2, Scale, BookOpen, AlertTriangle, ArrowLeft,
} from "lucide-react";
import Footer from "@/components/Footer";

/**
 * Phase 8 - public Safety Center. Guest-accessible hub for safety, reporting,
 * support, and legal links.
 */
export default function SafetyCenterScreen() {
  const navigate = useNavigate();

  const items = [
    {
      icon: <BookOpen className="h-5 w-5 text-purple-600" />,
      title: "Community Guidelines",
      desc: "What's allowed and what isn't on iStylist.",
      to: "/community-guidelines",
      testid: "safety-link-guidelines",
    },
    {
      icon: <Flag className="h-5 w-5 text-red-600" />,
      title: "Report Abuse",
      desc: "Spotted something unsafe? Report a user, post, review, or chat from anywhere in the app.",
      to: "/support?category=abuse_report",
      testid: "safety-link-report",
    },
    {
      icon: <LifeBuoy className="h-5 w-5 text-blue-600" />,
      title: "Contact Support",
      desc: "Account, bookings, payments, or general help.",
      to: "/support",
      testid: "safety-link-support",
    },
    {
      icon: <Trash2 className="h-5 w-5 text-gray-700" />,
      title: "Delete My Account",
      desc: "Manage your data and permanently delete your account from your profile page.",
      to: "/profile",
      testid: "safety-link-delete",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
      title: "Privacy Policy",
      desc: "How we collect, use, and protect your data.",
      to: "/privacy",
      testid: "safety-link-privacy",
    },
    {
      icon: <Scale className="h-5 w-5 text-indigo-600" />,
      title: "Terms of Service",
      desc: "The rules that govern using iStylist.",
      to: "/terms",
      testid: "safety-link-terms",
    },
    {
      icon: <FileText className="h-5 w-5 text-amber-700" />,
      title: "Refund Policy",
      desc: "When and how refunds are issued.",
      to: "/refund-policy",
      testid: "safety-link-refund",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="safety-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Safety Center</h1>
            <p className="text-xs text-gray-500">Everything you need to stay safe on iStylist.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-2" data-testid="safety-center-grid">
          {items.map((it) => (
            <Card key={it.title} className="hover:shadow-md transition">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  {it.icon}
                  <CardTitle className="text-base">{it.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-3">{it.desc}</CardDescription>
                <Link to={it.to} data-testid={it.testid}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            In an emergency, contact local authorities directly. iStylist support
            cannot intervene in real-world emergencies.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
