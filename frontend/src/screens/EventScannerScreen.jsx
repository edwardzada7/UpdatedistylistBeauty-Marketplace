import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { adminEventsAPI, scannerAPI } from "@/services/eventsApi";

const CODE_KEY = "EVENT_SCANNER_CODE";
const RESULT_STYLE = {
  valid: { box: "bg-green-600", Icon: CheckCircle2, title: "VALID" },
  used: { box: "bg-red-600", Icon: XCircle, title: "ALREADY USED" },
  canceled: { box: "bg-red-600", Icon: XCircle, title: "CANCELED" },
  wrong_event: { box: "bg-amber-600", Icon: XCircle, title: "WRONG EVENT" },
  invalid: { box: "bg-red-600", Icon: XCircle, title: "INVALID" },
};

/**
 * Door scanner. Staff sign in with the event's scanner code (made by the admin), then scan QR codes
 * with the camera or type the 6-digit PIN. The server marks a ticket used on the first successful check.
 */
export default function EventScannerScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const adminEventId = Number(params.get("event")) || null;
  const [creds, setCreds] = useState(null);
  const [session, setSession] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [pin, setPin] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [counts, setCounts] = useState({ total: 0, checked_in: 0 });
  const [cameraOn, setCameraOn] = useState(false);
  const [camError, setCamError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const lastRef = useRef({ code: "", at: 0 });

  const signIn = useCallback(async (accessCode) => {
    try {
      const data = await scannerAPI.login(accessCode);
      sessionStorage.setItem(CODE_KEY, accessCode.toUpperCase());
      setCreds({ scannerCode: accessCode.toUpperCase() });
      setSession({ event_id: data.event_id, title: data.event_title, label: data.label });
      setCounts({ total: data.total, checked_in: data.checked_in });
    } catch (e) {
      sessionStorage.removeItem(CODE_KEY);
      toast.error(e?.response?.data?.detail || "Invalid scanner code");
    }
  }, []);

  useEffect(() => {
    const adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (adminEventId && adminKey) {
      setCreds({ adminKey });
      adminEventsAPI.list(adminKey).then((d) => {
        const ev = (d.events || []).find((x) => x.id === adminEventId);
        setSession({ event_id: adminEventId, title: ev?.title || `Event ${adminEventId}`, label: "admin" });
        if (ev) setCounts({ total: ev.stats.tickets_issued - ev.stats.refund_due, checked_in: ev.stats.checked_in });
      }).catch(() => toast.error("Could not load the event"));
      return;
    }
    const saved = sessionStorage.getItem(CODE_KEY);
    if (saved) signIn(saved);
  }, [adminEventId, signIn]);

  const handleCode = useCallback(async (raw) => {
    if (!creds || !session || busyRef.current) return;
    const code = String(raw).trim();
    const now = Date.now();
    if (code === lastRef.current.code && now - lastRef.current.at < 4000) return;
    lastRef.current = { code, at: now };
    busyRef.current = true;
    try {
      const res = await scannerAPI.scan(creds, code, session.event_id);
      setResult(res);
      if (res.total !== undefined) setCounts({ total: res.total, checked_in: res.checked_in });
      setHistory((h) => [{ ...res, at: new Date() }, ...h].slice(0, 15));
      if (navigator.vibrate) navigator.vibrate(res.result === "valid" ? 80 : [120, 60, 120]);
    } catch (e) {
      setResult({ result: "invalid", message: e?.response?.data?.detail || "Could not check this ticket. Check your connection." });
    } finally {
      busyRef.current = false;
    }
  }, [creds, session]);

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = async () => {
    setCamError("");
    if (!("BarcodeDetector" in window)) {
      setCamError("This browser can't scan QR codes. Use Chrome on Android, or type the PIN below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      timerRef.current = setInterval(async () => {
        if (busyRef.current || video.readyState < 2) return;
        try {
          const found = await detector.detect(video);
          if (found.length) handleCode(found[0].rawValue);
        } catch (_) { /* frame not ready */ }
      }, 350);
      setCameraOn(true);
    } catch (e) {
      setCamError("Camera access was blocked. Allow the camera for this site, or type the PIN below.");
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  if (!creds || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <ScanLine className="h-10 w-10 mx-auto text-purple-600" />
            <h1 className="text-xl font-bold mt-2">Ticket scanner</h1>
            <p className="text-sm text-gray-600">Enter the scanner code you were given for this event.</p>
          </div>
          <Input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Scanner code" className="text-center text-lg tracking-widest" autoCapitalize="characters" data-testid="scanner-code-input" />
          <Button className="w-full" disabled={codeInput.trim().length < 4} onClick={() => signIn(codeInput.trim())}>Start scanning</Button>
        </div>
      </div>
    );
  }

  const style = result ? RESULT_STYLE[result.result] || RESULT_STYLE.invalid : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {adminEventId && <Button variant="ghost" size="sm" onClick={() => navigate("/admin/events")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>}
            <div className="min-w-0">
              <h1 className="font-bold truncate">{session.title}</h1>
              <p className="text-xs text-gray-500">Checked in {counts.checked_in} / {counts.total}</p>
            </div>
          </div>
          {!adminEventId && <Button variant="outline" size="sm" onClick={() => { stopCamera(); sessionStorage.removeItem(CODE_KEY); setCreds(null); setSession(null); }}>Sign out</Button>}
        </div>
      </header>
      <main className="container mx-auto px-4 py-4 max-w-md space-y-4">
        <div className="rounded-2xl overflow-hidden bg-black aspect-square relative">
          <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`} />
          {!cameraOn && <div className="absolute inset-0 flex items-center justify-center text-gray-400"><CameraOff className="h-12 w-12" /></div>}
          {cameraOn && <div className="absolute inset-8 border-2 border-white/70 rounded-xl pointer-events-none" />}
        </div>
        <Button className="w-full" variant={cameraOn ? "outline" : "default"} onClick={cameraOn ? stopCamera : startCamera} data-testid="scanner-camera-btn">
          <Camera className="h-4 w-4 mr-2" />{cameraOn ? "Stop camera" : "Start camera"}
        </Button>
        {camError && <p className="text-sm text-amber-700">{camError}</p>}

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (pin.length === 6) { handleCode(pin); setPin(""); } }}>
          <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit PIN" className="text-center text-lg tracking-widest" data-testid="scanner-pin-input" />
          <Button type="submit" disabled={pin.length !== 6}>Check</Button>
        </form>

        {result && style && (
          <div className={`${style.box} text-white rounded-2xl p-5 text-center space-y-1`} data-testid="scan-result">
            <style.Icon className="h-12 w-12 mx-auto" />
            <p className="text-2xl font-extrabold">{style.title}</p>
            <p>{result.message}</p>
            {result.holder && <p className="font-semibold">{result.holder} · {result.ticket_type}</p>}
            {result.result === "used" && result.used_at && <p className="text-sm">Used at {new Date(result.used_at).toLocaleTimeString()}</p>}
          </div>
        )}

        {history.length > 0 && (
          <div className="bg-white rounded-xl border divide-y">
            <p className="px-3 py-2 text-xs font-semibold text-gray-500">Recent scans</p>
            {history.map((h, i) => (
              <div key={`${h.at.getTime()}-${i}`} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{h.holder || h.message}</span>
                <span className={h.result === "valid" ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>{h.result === "valid" ? "Admitted" : h.result === "used" ? "Used" : "Rejected"}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
