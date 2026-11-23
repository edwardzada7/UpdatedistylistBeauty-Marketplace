import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import VerifiedBadge from "@/components/VerifiedBadge";
import { formatMoney, currencySymbol } from "@/utils/money";

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Picks up to `max` photos, uploads them through the admin endpoint and keeps their public URLs. */
function PhotoPicker({ adminKey, urls, setUrls, max = 5 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const onFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, max - urls.length);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await adminAPI.official.upload(adminKey, { filename: file.name, content_type: file.type || "image/jpeg", data_base64: await toBase64(file) });
        uploaded.push(res.data.url);
      }
      setUrls((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setUrls((prev) => prev.filter((u) => u !== url))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5" aria-label="Remove photo">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {urls.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="h-20 w-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-xs text-gray-500 hover:border-pink-400">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? "Uploading" : "Add photo"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      <p className="text-xs text-gray-500 mt-1">Up to {max} photos, 8 MB each.</p>
    </div>
  );
}

function PostTab({ adminKey }) {
  const [caption, setCaption] = useState("");
  const [urls, setUrls] = useState([]);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!urls.length) return toast.error("Add at least one photo");
    setBusy(true);
    try {
      await adminAPI.official.createPost(adminKey, { caption: caption.trim() || null, image_urls: urls });
      toast.success("Posted to the feed as iStylist Official");
      setCaption("");
      setUrls([]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not publish the post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-xl">
      <div className="flex items-center gap-2 font-semibold">
        iStylist Official <VerifiedBadge verified size={18} />
      </div>
      <PhotoPicker adminKey={adminKey} urls={urls} setUrls={setUrls} />
      <div>
        <Label htmlFor="official-caption">Caption</Label>
        <Textarea id="official-caption" rows={4} maxLength={2000} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share a tip, announcement or promotion..." />
      </div>
      <Button onClick={publish} disabled={busy} className="bg-pink-600 hover:bg-pink-700" data-testid="official-publish">
        {busy ? "Publishing..." : "Publish to feed"}
      </Button>
      <p className="text-xs text-gray-500">Shows on the mobile and web feeds with the iStylist logo and verified tick. Photos only for now; to remove a post use Feed Moderation.</p>
    </div>
  );
}

const EMPTY = { name: "", description: "", price: "", stock: "", main_category: "", forProviders: false, providerPrice: "" };

function ShopTab({ adminKey }) {
  const [form, setForm] = useState(EMPTY);
  const [urls, setUrls] = useState([]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.official.products(adminKey);
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load official products");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const create = async () => {
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim() || !(price > 0) || !(stock >= 0) || form.stock === "") return toast.error("Name, price and stock are required");
    if (form.forProviders && !(Number(form.providerPrice) > 0)) return toast.error("Set the price providers pay");
    setBusy(true);
    try {
      await adminAPI.official.createProduct(adminKey, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        stock: Math.floor(stock),
        image_urls: urls,
        main_category: form.main_category.trim() || null,
        provider_purchase_enabled: form.forProviders,
        provider_purchase_price: form.forProviders ? Number(form.providerPrice) : null,
      });
      toast.success("Official product created and live in the shop");
      setForm(EMPTY);
      setUrls([]);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not create the product");
    } finally {
      setBusy(false);
    }
  };

  const updateListing = async (listing, payload, message) => {
    try {
      await adminAPI.official.updateListing(adminKey, listing.id, payload);
      toast.success(message);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Update failed");
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold">New official product</h2>
        <PhotoPicker adminKey={adminKey} urls={urls} setUrls={setUrls} />
        <div><Label htmlFor="op-name">Name</Label><Input id="op-name" value={form.name} onChange={set("name")} /></div>
        <div><Label htmlFor="op-desc">Description</Label><Textarea id="op-desc" rows={3} value={form.description} onChange={set("description")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="op-price">Customer price ({currencySymbol()})</Label><Input id="op-price" type="number" min="0" value={form.price} onChange={set("price")} /></div>
          <div><Label htmlFor="op-stock">Stock</Label><Input id="op-stock" type="number" min="0" value={form.stock} onChange={set("stock")} /></div>
        </div>
        <div><Label htmlFor="op-cat">Category (optional)</Label><Input id="op-cat" value={form.main_category} onChange={set("main_category")} placeholder="e.g. Beauty" /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.forProviders} onChange={(e) => setForm((f) => ({ ...f, forProviders: e.target.checked }))} />
          Providers can buy this for their shop ("Buy for My Shop")
        </label>
        {form.forProviders && (
          <div><Label htmlFor="op-pprice">Price providers pay per item ({currencySymbol()})</Label><Input id="op-pprice" type="number" min="0" value={form.providerPrice} onChange={set("providerPrice")} /></div>
        )}
        <Button onClick={create} disabled={busy} className="bg-pink-600 hover:bg-pink-700" data-testid="official-create-product">
          {busy ? "Creating..." : "Create product"}
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Official products</h2>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No official products yet.</p>
        ) : (
          items.map(({ listing, product }) => (
            <div key={listing.id} className="bg-white rounded-xl border p-3 flex gap-3" data-testid="official-item">
              <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {product?.image_urls?.[0] && <img src={product.image_urls[0]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{product?.name || `Product #${listing.product_id}`}</p>
                <p className="text-xs text-gray-500">{formatMoney(listing.price)} · {listing.stock} in stock</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge className={product?.approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>{product?.approved ? "Approved" : "Not approved"}</Badge>
                  <Badge className={String(listing.status).toLowerCase() === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>{listing.status || "active"}</Badge>
                  {listing.provider_purchase_enabled && <Badge className="bg-indigo-100 text-indigo-800">Providers pay {formatMoney(listing.provider_purchase_price)}</Badge>}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => updateListing(listing, { status: String(listing.status).toLowerCase() === "active" ? "inactive" : "active" }, "Listing updated")}>
                    {String(listing.status).toLowerCase() === "active" ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const v = window.prompt("New stock quantity", String(listing.stock));
                    if (v !== null && Number(v) >= 0) updateListing(listing, { stock: Math.floor(Number(v)) }, "Stock updated");
                  }}>Edit stock</Button>
                </div>
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-gray-500">Product approval and hiding also live in Shop Moderation.</p>
      </div>
    </div>
  );
}

export default function AdminOfficialScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [tab, setTab] = useState("post");

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(key);
  }, [navigate]);

  if (!adminKey) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold flex items-center gap-2">iStylist Official <VerifiedBadge verified size={20} /></h1>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {[["post", "Feed post"], ["shop", "Official shop"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm border ${tab === key ? "bg-pink-600 text-white border-pink-600" : "bg-white"}`} data-testid={`official-tab-${key}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "post" ? <PostTab adminKey={adminKey} /> : <ShopTab adminKey={adminKey} />}
      </div>
    </div>
  );
}
