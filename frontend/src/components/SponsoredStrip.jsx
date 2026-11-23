import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { promoAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENCY } from "@/utils/constants";

/** Boosted profiles, services, products or posts. Always labelled "Sponsored". Renders nothing when there are none. */
export default function SponsoredStrip({ types = "profile,service", title = "Sponsored", limit = 6 }) {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [items, setItems] = useState([]);
  const areaId = userData?.area_id;

  useEffect(() => {
    let cancelled = false;
    promoAPI
      .sponsored({ types, limit, ...(areaId ? { area_id: areaId } : {}) })
      .then((r) => !cancelled && setItems(r.data?.items || []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [types, limit, areaId]);

  if (!items.length) return null;

  const open = (i) => {
    if (i.type === "product") navigate(`/shop/${i.target_id}`);
    else if (i.type === "post") navigate("/feed");
    else navigate(`/user/providers/${i.provider_id}`);
  };

  return (
    <section className="px-4 mb-6" data-testid="sponsored-strip">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">Ad</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((i) => (
          <button key={i.promotion_id} onClick={() => open(i)} className="w-40 shrink-0 text-left bg-white rounded-xl border overflow-hidden hover:shadow-md transition">
            {i.image ? (
              <img src={i.image} alt={i.title || ""} className="h-24 w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-24 w-full bg-gray-100 flex items-center justify-center"><ImageOff className="h-5 w-5 text-gray-400" /></div>
            )}
            <div className="p-2">
              <p className="text-sm font-medium truncate">{i.title || i.provider_name}</p>
              <p className="text-xs text-gray-500 truncate">
                {i.type === "service" || i.type === "product" ? `${i.price != null ? `${CURRENCY}${Number(i.price).toLocaleString()} · ` : ""}${i.provider_name || ""}` : i.city || "Provider"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
