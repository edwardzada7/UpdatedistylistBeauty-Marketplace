import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { legalAPI } from "@/services/api";
import Footer from "@/components/Footer";

/**
 * Phase 8 - dynamic public legal page renderer.
 * Slug is supplied either via /:slug param or via the `slug` prop.
 */
export default function LegalPageScreen({ slug: slugProp }) {
  const params = useParams();
  const navigate = useNavigate();
  const slug = slugProp || params.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    legalAPI
      .get(slug)
      .then((res) => { if (!cancelled) setPage(res.data); })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || "Failed to load page");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    // Simple SEO-friendly title
    if (page?.title) document.title = `${page.title} • iStylist`;
    return () => { document.title = "iStylist"; };
  }, [page?.title]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="legal-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold">{page?.title || "Legal"}</h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl" data-testid={`legal-page-${slug}`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            <p className="font-medium">Could not load page</p>
            <p className="mt-1">{error}</p>
            <p className="mt-3 text-xs text-red-600">
              If you are the admin, ensure <code>phase8_lean_trust_safety.sql</code> has been run in Supabase.
            </p>
            <div className="mt-4">
              <Link to="/" className="text-purple-700 underline">Back to home</Link>
            </div>
          </div>
        ) : (
          <article className="prose prose-sm sm:prose-base max-w-none">
            {/* Plain-text rendering: legal content is markdown-ish; safe text only */}
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-7 text-gray-800">
              {(page?.content || "").replace(/\{\{TODAY\}\}/g, new Date().toISOString().slice(0, 10))}
            </pre>
            <p className="mt-8 text-xs text-gray-400">
              Last updated: {page?.updated_at ? new Date(page.updated_at).toLocaleDateString() : "—"}
            </p>
          </article>
        )}
      </main>

      <Footer />
    </div>
  );
}
