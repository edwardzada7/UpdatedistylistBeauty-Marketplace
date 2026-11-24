import { Badge } from "@/components/ui/badge";

const STATUS = {
  valid: { label: "Valid", cls: "bg-green-100 text-green-800" },
  used: { label: "Used", cls: "bg-gray-200 text-gray-700" },
  refund_due: { label: "Refund due", cls: "bg-amber-100 text-amber-800" },
  canceled: { label: "Canceled", cls: "bg-red-100 text-red-700" },
};

export default function TicketCard({ t }) {
  const st = STATUS[t.status] || STATUS.valid;
  const usable = t.status === "valid";
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" data-testid={`ticket-${t.id}`}>
      <div className="p-4 flex items-center justify-between gap-2 border-b">
        <p className="font-semibold">{t.ticket_type || "Ticket"}</p>
        <Badge className={st.cls}>{st.label}</Badge>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        {usable && t.qr_svg ? (
          <div className="w-56 max-w-full bg-white p-2 rounded-lg border [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: t.qr_svg }} />
        ) : (
          <div className="w-56 max-w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm text-center px-4">
            {t.status === "used" ? `Used${t.used_at ? ` ${new Date(t.used_at).toLocaleString()}` : ""}` : usable ? "QR code unavailable. Use the PIN below." : "This ticket can't be used"}
          </div>
        )}
        {usable && (
          <div className="text-center">
            <p className="text-xs text-gray-500">Or show this PIN at the door</p>
            <p className="text-3xl font-bold tracking-[0.3em] pl-[0.3em]" data-testid="ticket-pin">{t.pin}</p>
          </div>
        )}
        <p className="text-xs text-gray-500 text-center">One person per ticket. It works once, so don't share the QR code or PIN.</p>
      </div>
    </div>
  );
}

