import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { bookingsAPI } from "@/services/api";

const errorOf = (e, fallback) => e?.response?.data?.detail || fallback;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Reschedule a booking: ask for a new time, or answer the other side's request. Rules are enforced by the server. */
export default function RescheduleCard({ booking, autoOpen = false, onChanged }) {
  const bookingId = booking.id;
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await bookingsAPI.rescheduleState(bookingId);
      setState(res.data);
      return res.data;
    } catch {
      setState(null);
      return null;
    }
  }, [bookingId]);

  useEffect(() => {
    load().then((s) => {
      if (autoOpen && s?.can_propose) setOpen(true);
    });
  }, [load, autoOpen]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setSlotsLoading(true);
    setTime("");
    bookingsAPI
      .rescheduleSlots(bookingId, date)
      .then((r) => !cancelled && setSlots(r.data?.slots || []))
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, date, bookingId]);

  if (!state) return null;
  const pending = state.pending;
  if (!pending && !state.can_propose && !state.reschedules_used) return null;

  const send = async () => {
    if (!time) return toast.error("Pick a new time");
    setBusy(true);
    try {
      const res = await bookingsAPI.reschedulePropose(bookingId, { new_date: date, new_time: time, reason: reason.trim() || undefined });
      setState(res.data);
      setOpen(false);
      setReason("");
      toast.success("Request sent. Your booking stays as it is until it is accepted.");
    } catch (e) {
      toast.error(errorOf(e, "Could not send the request"));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (action) => {
    setBusy(true);
    try {
      const res = await bookingsAPI.rescheduleRespond(bookingId, action);
      setState(res.data);
      toast.success(action === "accept" ? "Booking moved" : action === "decline" ? "Request declined" : "Request withdrawn");
      if (action === "accept") onChanged?.();
    } catch (e) {
      toast.error(errorOf(e, "Could not update the request"));
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="reschedule-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Reschedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {pending ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
            <p>
              {pending.awaiting_you ? `${pending.proposed_by_role === "customer" ? "The customer" : "The provider"} asks to move this booking` : "You asked to move this booking"} from{" "}
              <b>{pending.old_date} {pending.old_time}</b> to <b>{pending.new_date} {pending.new_time}</b>.
            </p>
            {pending.reason && <p className="text-gray-600">"{pending.reason}"</p>}
            {pending.awaiting_you ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respond("accept")} disabled={busy} className="bg-green-600 hover:bg-green-700" data-testid="reschedule-accept"><Check className="h-4 w-4 mr-1" /> Accept</Button>
                <Button size="sm" variant="outline" onClick={() => respond("decline")} disabled={busy} data-testid="reschedule-decline"><X className="h-4 w-4 mr-1" /> Decline</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => respond("cancel")} disabled={busy}>Withdraw request</Button>
            )}
          </div>
        ) : state.can_propose ? (
          <Button variant="outline" className="w-full" onClick={() => setOpen(true)} data-testid="reschedule-btn">
            <CalendarClock className="h-4 w-4 mr-2" /> Reschedule this booking
          </Button>
        ) : (
          <p className="text-gray-500">{state.blocked_reason}</p>
        )}
        <p className="text-xs text-gray-500">
          Free up to {state.cutoff_minutes} minutes before the appointment. {state.reschedules_left} of 2 changes left. Your payment stays safely in escrow.
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick a new time</DialogTitle>
            <DialogDescription>The other side must accept. Until then your current booking stays.</DialogDescription>
          </DialogHeader>
          <input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-md px-3 py-2 w-full" data-testid="reschedule-date" />
          {slotsLoading ? (
            <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500">No open times on this day. Try another date.</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
              {slots.map((t) => (
                <button key={t} type="button" onClick={() => setTime(t)} className={`px-3 py-1.5 rounded-full border text-sm ${time === t ? "bg-purple-600 text-white border-purple-600" : "bg-white"}`}>{t}</button>
              ))}
            </div>
          )}
          <Textarea rows={2} maxLength={300} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={busy || !time} data-testid="reschedule-send">{busy ? "Sending..." : "Send request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
