import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImageOff, Plus, Search, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { providerShopApi } from "@/services/providerShopApi";
import { formatNaira } from "@/screens/ShopScreen";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import { currencySymbol } from "@/utils/money";

const TABS = [
  ["shop", "My Shop"],
  ["market", "Marketplace"],
  ["inventory", "Inventory"],
  ["orders", "Orders"],
];
const err = (e, fallback) => e?.response?.data?.detail || e?.friendlyMessage || e?.message || fallback;

const Thumb = ({ product }) =>
  product.image_urls?.[0] ? (
    <img src={product.image_urls[0]} alt={product.name} className="h-20 w-20 rounded-lg object-cover shrink-0" loading="lazy" />
  ) : (
    <div className="h-20 w-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><ImageOff className="h-6 w-6 text-gray-400" /></div>
  );

export default function ProviderShopScreen() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const authId = userData?.auth_id;
  const email = userData?.email;
  const [tab, setTab] = useState("shop");
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState({ seller: null, items: [] });
  const [market, setMarket] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // listing or own product being edited
  const [creating, setCreating] = useState(false);
  const [buying, setBuying] = useState(null);
  const [listing, setListing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [orderView, setOrderView] = useState(null);

  const load = useCallback(async () => {
    if (!authId) return;
    setLoading(true);
    const [s, m, i, o] = await Promise.allSettled([
      providerShopApi.getMyShop(authId),
      providerShopApi.getMarketplace(authId),
      providerShopApi.getInventory(),
      providerShopApi.getOrders(authId),
    ]);
    if (s.status === "fulfilled") setShop(s.value);
    else toast.error(err(s.reason, "Could not load your shop"));
    if (m.status === "fulfilled") setMarket(m.value);
    if (i.status === "fulfilled") setInventory(i.value);
    if (o.status === "fulfilled") setOrders(o.value);
    setLoading(false);
  }, [authId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMarket = useMemo(() => {
    const q = query.trim().toLowerCase();
    return market.filter((p) => !q || `${p.name} ${p.seller_name || ""}`.toLowerCase().includes(q));
  }, [market, query]);

  const add = async (p) => {
    try {
      const r = await providerShopApi.addToMyShop(authId, p);
      toast[r.added ? "success" : "info"](r.added ? "Added to My Shop" : "Already in My Shop");
      load();
    } catch (e) {
      toast.error(err(e, "Could not add this product"));
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from your shop?`)) return;
    try {
      if (p.kind === "listing") await providerShopApi.removeListing(p.seller_listing_id);
      else await providerShopApi.deleteProduct(p.id);
      toast.success("Removed");
      load();
    } catch (e) {
      toast.error(err(e, "Could not remove this product"));
    }
  };

  const statusBadge = (p) => {
    if (p.kind === "listing") return <Badge className="bg-purple-100 text-purple-800">Resale</Badge>;
    return p.approved ? <Badge className="bg-green-100 text-green-800">Live</Badge> : <Badge className="bg-yellow-100 text-yellow-800">Awaiting approval</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/provider/dashboard")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-lg font-bold flex-1 flex items-center gap-2"><Store className="h-5 w-5 text-purple-600" /> My Shop</h1>
          <Button size="sm" onClick={() => setCreating(true)} data-testid="provider-shop-new"><Plus className="h-4 w-4 mr-1" />New product</Button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} data-testid={`provider-shop-tab-${key}`} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm border ${tab === key ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-700"}`}>{label}</button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <LoadingSpinner message="Loading your shop..." />
        ) : tab === "shop" ? (
          shop.items.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="font-medium text-gray-700">Your shop is empty</p>
              <p className="text-sm mt-1">Create a product, or add items from the Marketplace to resell.</p>
              <div className="mt-4 flex gap-2 justify-center"><Button onClick={() => setCreating(true)}>New product</Button><Button variant="outline" onClick={() => setTab("market")}>Browse marketplace</Button></div>
            </div>
          ) : (
            <div className="space-y-3">
              {!shop.seller && <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">Your seller account isn't set up yet, so you can only sell products you create. Contact support to enable reselling.</p>}
              {shop.items.map((p) => (
                <div key={`${p.kind}-${p.seller_listing_id || p.id}`} role="button" tabIndex={0} onClick={() => setViewing(p)} onKeyDown={(e) => e.key === "Enter" && setViewing(p)} className="bg-white rounded-xl border p-3 flex gap-3 cursor-pointer hover:border-purple-300" data-testid={`shop-item-${p.id}`}>
                  <Thumb product={p} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2"><p className="font-semibold truncate">{p.name}</p>{statusBadge(p)}</div>
                    <p className="text-purple-700 font-bold">{formatNaira(p.price)}</p>
                    <p className={`text-xs ${Number(p.stock) <= 3 ? "text-red-600" : "text-gray-500"}`}>{Number(p.stock) <= 0 ? "Out of stock" : `${p.stock} in stock`}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditing(p); }}>Edit</Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={(e) => { e.stopPropagation(); remove(p); }} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "market" ? (
          <>
            <div className="relative mb-3"><Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" /><Input className="pl-9" placeholder="Search marketplace" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <p className="text-xs text-gray-500 mb-3"><b>Add to My Shop</b> lists a product for resale without buying stock. <b>Buy for My Shop</b> purchases official stock outright; it stays private until you list it from Inventory.</p>
            {filteredMarket.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No products found.</p>
            ) : (
              <div className="space-y-3">
                {filteredMarket.map((p) => (
                  <div key={`${p.id}-${p.seller_listing_id}`} role="button" tabIndex={0} onClick={() => setViewing(p)} onKeyDown={(e) => e.key === "Enter" && setViewing(p)} className="bg-white rounded-xl border p-3 flex gap-3 cursor-pointer hover:border-purple-300">
                    <Thumb product={p} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.isOfficial ? "iStylist Official" : p.seller_name || "Seller"}</p>
                      <p className="text-purple-700 font-bold">{formatNaira(p.price)} <span className="text-xs font-normal text-gray-500">· {p.stock} left</span></p>
                      {p.buyable && <p className="text-xs text-green-700">Buy for My Shop: {formatNaira(p.purchase_price)} each</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={p.alreadyListed} onClick={(e) => { e.stopPropagation(); add(p); }}>{p.alreadyListed ? "In My Shop" : "Add to My Shop"}</Button>
                        {p.buyable && <Button size="sm" onClick={(e) => { e.stopPropagation(); setBuying(p); }}>Buy for My Shop</Button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === "inventory" ? (
          inventory.length === 0 ? (
            <p className="text-center text-gray-500 py-16">No purchased inventory yet. Use "Buy for My Shop" in the Marketplace.</p>
          ) : (
            <div className="space-y-3">
              {inventory.map((it) => {
                const free = Number(it.quantity || 0) - Number(it.reserved_quantity || 0) - Number(it.quantity_allocated_to_listings || 0);
                return (
                  <div key={it.id} className="bg-white rounded-xl border p-3 flex gap-3 items-center">
                    <Thumb product={{ name: it.products?.name, image_urls: it.products?.image_urls || [] }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{it.products?.name || `Product #${it.product_id}`}</p>
                      <p className="text-xs text-gray-500">{it.quantity} owned · {Number(it.quantity_allocated_to_listings || 0)} listed · {Math.max(free, 0)} available</p>
                    </div>
                    <Button size="sm" disabled={free <= 0} onClick={() => setListing({ ...it, free })}>List for sale</Button>
                  </div>
                );
              })}
            </div>
          )
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-500 py-16">No orders for your products yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} role="button" tabIndex={0} onClick={() => setOrderView(o)} onKeyDown={(e) => e.key === "Enter" && setOrderView(o)} className="bg-white rounded-xl border p-3 cursor-pointer hover:border-purple-300" data-testid={`order-${o.id}`}>
                <div className="flex justify-between items-center gap-2"><p className="font-semibold">Order #{o.id}</p><Badge className="bg-gray-100 text-gray-800">{o.status || o.order_status || "pending"}</Badge></div>
                <p className="text-xs text-gray-500">{o.created_at ? new Date(o.created_at).toLocaleString() : ""} · payment {o.payment_status || "pending"}</p>
                <ul className="mt-2 text-sm space-y-0.5">{o.items.map((i) => <li key={i.id}>{i.quantity} × {i.products?.name || "Item"} — {formatNaira(Number(i.price) * Number(i.quantity))}</li>)}</ul>
                <p className="mt-2 text-xs text-purple-700">Tap to view details &amp; update status</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {viewing && <ProductViewDialog product={viewing} onClose={() => setViewing(null)} onEdit={viewing.kind ? () => { const p = viewing; setViewing(null); setEditing(p); } : null} />}
      {orderView && <OrderDialog order={orderView} onClose={() => setOrderView(null)} onSaved={() => { setOrderView(null); load(); }} />}
      {editing && <EditDialog product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {creating && <CreateDialog authId={authId} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {buying && <BuyDialog product={buying} email={email} onClose={() => setBuying(null)} />}
      {listing && <ListDialog item={listing} onClose={() => setListing(null)} onSaved={() => { setListing(null); load(); setTab("shop"); }} />}
      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "canceled", "returned"];

function ProductViewDialog({ product, onClose, onEdit }) {
  const imgs = Array.isArray(product.image_urls) ? product.image_urls : [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product.name}</DialogTitle><DialogDescription>{!product.kind ? (product.isOfficial ? "iStylist Official" : product.seller_name || "Marketplace product") : product.kind === "listing" ? "Resale listing" : "Your product"}</DialogDescription></DialogHeader>
        {imgs.length > 0 && <div className="flex gap-2 overflow-x-auto">{imgs.map((u) => <img key={u} src={u} alt={product.name} className="h-40 w-40 rounded-lg object-cover shrink-0" />)}</div>}
        <div className="space-y-1 text-sm">
          <p className="text-purple-700 font-bold text-lg">{formatNaira(product.price)}</p>
          <p className={Number(product.stock) <= 3 ? "text-red-600" : "text-gray-600"}>{Number(product.stock) <= 0 ? "Out of stock" : `${product.stock} in stock`}</p>
          {product.category && <p className="text-gray-600">Category: {product.category}</p>}
          {product.status && <p className="text-gray-600">Status: {product.status}</p>}
          <p className="text-gray-700 whitespace-pre-wrap pt-2">{product.description || "No description."}</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button>{onEdit && <Button onClick={onEdit}>Edit</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDialog({ order, onClose, onSaved }) {
  const [status, setStatus] = useState(order.status || order.order_status || "pending");
  const [busy, setBusy] = useState(false);
  const total = order.items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const addr = order.shipping_address;
  const addrText = !addr ? "" : typeof addr === "string" ? addr : Object.values(addr).filter(Boolean).join(", ");
  const save = async () => {
    setBusy(true);
    try {
      await providerShopApi.updateOrderStatus(order.id, status);
      toast.success("Order updated");
      onSaved();
    } catch (e) {
      toast.error(err(e, "Could not update order"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Order #{order.id}</DialogTitle><DialogDescription>{order.created_at ? new Date(order.created_at).toLocaleString() : ""} · payment {order.payment_status || "pending"}</DialogDescription></DialogHeader>
        <ul className="text-sm divide-y">
          {order.items.map((i) => (
            <li key={i.id} className="py-2 flex gap-3 items-center">
              {i.products?.image_urls?.[0] ? <img src={i.products.image_urls[0]} alt="" className="h-12 w-12 rounded object-cover shrink-0" /> : <div className="h-12 w-12 rounded bg-gray-100 shrink-0" />}
              <span className="flex-1 min-w-0 truncate">{i.quantity} × {i.products?.name || "Item"}</span>
              <span className="font-medium">{formatNaira(Number(i.price) * Number(i.quantity))}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold text-right">Items total: {formatNaira(total)}</p>
        {addrText && <div className="text-sm"><p className="font-medium">Ship to</p><p className="text-gray-600 break-words">{addrText}</p></div>}
        {order.note && <div className="text-sm"><p className="font-medium">Note</p><p className="text-gray-600 break-words">{order.note}</p></div>}
        <div><Label>Order status</Label>
          <select className="w-full border rounded-md h-10 px-2 bg-white" value={status} onChange={(e) => setStatus(e.target.value)}>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">The buyer is notified when the status changes.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={save} disabled={busy || status === (order.status || order.order_status || "pending")}>{busy ? "Saving..." : "Update status"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ product, onClose, onSaved }) {
  const [price, setPrice] = useState(String(product.price ?? ""));
  const [stock, setStock] = useState(String(product.stock ?? ""));
  const [name, setName] = useState(product.name || "");
  const [description, setDescription] = useState(product.description || "");
  const [busy, setBusy] = useState(false);
  const isListing = product.kind === "listing";
  const save = async () => {
    const p = Number(price), s = Number(stock);
    if (!(p > 0) || !Number.isInteger(s) || s < 0) return toast.error("Enter a valid price and stock");
    setBusy(true);
    try {
      if (isListing) await providerShopApi.updateListing(product.seller_listing_id, { price: p, stock: s });
      else await providerShopApi.updateProduct(product.id, { name: name.trim(), description: description.trim(), price: p, stock: s });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(err(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {product.name}</DialogTitle><DialogDescription>{isListing ? "Set your resale price and stock." : "Changes to a live product may need approval again."}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {!isListing && (<><div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div><div><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div></>)}
          <div className="grid grid-cols-2 gap-3"><div><Label>Price ({currencySymbol()})</Label><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div><div><Label>Stock</Label><Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} /></div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ authId, onClose, onSaved }) {
  const [f, setF] = useState({ name: "", description: "", price: "", stock: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    const price = Number(f.price), stock = Number(f.stock);
    if (!f.name.trim()) return toast.error("Add a product name");
    if (!(price > 0) || !Number.isInteger(stock) || stock < 0) return toast.error("Enter a valid price and stock");
    if (!files.length) return toast.error("Add at least one photo");
    setBusy(true);
    try {
      const urls = await Promise.all(files.map((file) => providerShopApi.uploadImage(file, authId)));
      await providerShopApi.createProduct(authId, { name: f.name.trim(), description: f.description.trim(), price, stock, image_urls: urls });
      toast.success("Product submitted. It goes live once approved.");
      onSaved();
    } catch (e) {
      toast.error(err(e, "Could not create the product"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New product</DialogTitle><DialogDescription>New products are reviewed by iStylist before buyers see them.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name} onChange={set("name")} maxLength={120} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description} onChange={set("description")} /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Price ({currencySymbol()})</Label><Input inputMode="decimal" value={f.price} onChange={set("price")} /></div><div><Label>Stock</Label><Input inputMode="numeric" value={f.stock} onChange={set("stock")} /></div></div>
          <div>
            <Label>Photos (up to 5)</Label>
            <input type="file" accept="image/*" multiple className="block w-full text-sm mt-1" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} data-testid="provider-product-photos" />
            {files.length > 0 && <p className="text-xs text-gray-500 mt-1">{files.length} photo(s) selected</p>}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Uploading..." : "Submit product"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuyDialog({ product, email, onClose }) {
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const q = Number(qty);
  const go = async () => {
    if (!Number.isInteger(q) || q <= 0) return toast.error("Quantity must be at least 1");
    if (q > Number(product.stock)) return toast.error("Not enough stock available");
    if (!email) return toast.error("Your account has no email for the payment");
    setBusy(true);
    try {
      const url = await providerShopApi.startPurchase({ listingId: product.seller_listing_id, quantity: q, email });
      window.location.href = url;
    } catch (e) {
      toast.error(err(e, "Could not start the payment"));
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Buy {product.name}</DialogTitle><DialogDescription>{formatNaira(product.purchase_price)} each. The stock goes to your Inventory, private until you list it.</DialogDescription></DialogHeader>
        <div><Label>Quantity</Label><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <p className="font-semibold">Total: {formatNaira((product.purchase_price || 0) * (q > 0 ? q : 0))}</p>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={busy}>{busy ? "Redirecting..." : "Pay with Paystack"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListDialog({ item, onClose, onSaved }) {
  const [qty, setQty] = useState(String(item.free));
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const q = Number(qty), p = Number(price);
    if (!Number.isInteger(q) || q <= 0 || q > item.free) return toast.error(`Choose a quantity between 1 and ${item.free}`);
    if (!(p > 0)) return toast.error("Enter your selling price");
    setBusy(true);
    try {
      await providerShopApi.listInventory({ inventoryId: item.id, quantity: q, price: p });
      toast.success("Listed in My Shop");
      onSaved();
    } catch (e) {
      toast.error(err(e, "Could not list this inventory"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>List {item.products?.name || "inventory"}</DialogTitle><DialogDescription>{item.free} available to list.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3"><div><Label>Quantity</Label><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div><div><Label>Price each ({currencySymbol()})</Label><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={busy}>{busy ? "Listing..." : "List for sale"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
