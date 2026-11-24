import { Input } from "@/components/ui/input";

const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const selectCls = "h-10 rounded-md border bg-white px-2 text-sm text-gray-900";

/**
 * Date + time picker that is easy to use on phones. Replaces <input type="datetime-local">, whose
 * dark spinner dialog on some Android browsers is cramped and hard to read.
 * value / onChange use the same "YYYY-MM-DDTHH:mm" string (local time) as datetime-local.
 */
export default function DateTimeField({ value, onChange, optional = false }) {
  const [date = "", time = ""] = (value || "").split("T");
  const [hh, mm] = time ? time.split(":").map(Number) : [NaN, NaN];
  const has = Number.isFinite(hh);
  const hour12 = has ? (hh % 12 === 0 ? 12 : hh % 12) : 6;
  const minute = has ? Math.round(mm / 5) * 5 % 60 : 0;
  const pm = has ? hh >= 12 : true;

  const emit = (nextDate, h12, m, isPm) => {
    if (!nextDate) return onChange("");
    const h24 = (h12 % 12) + (isPm ? 12 : 0);
    onChange(`${nextDate}T${pad(h24)}:${pad(m)}`);
  };

  return (
    <div className="space-y-2">
      <Input
        type="date"
        value={date}
        style={{ colorScheme: "light" }}
        onChange={(e) => emit(e.target.value, hour12, minute, pm)}
      />
      <div className="flex items-center gap-1.5">
        <select aria-label="Hour" className={selectCls} style={{ colorScheme: "light" }} value={hour12} disabled={!date} onChange={(e) => emit(date, Number(e.target.value), minute, pm)}>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-500">:</span>
        <select aria-label="Minute" className={selectCls} style={{ colorScheme: "light" }} value={minute} disabled={!date} onChange={(e) => emit(date, hour12, Number(e.target.value), pm)}>
          {MINUTES.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
        </select>
        <select aria-label="AM or PM" className={selectCls} style={{ colorScheme: "light" }} value={pm ? "pm" : "am"} disabled={!date} onChange={(e) => emit(date, hour12, minute, e.target.value === "pm")}>
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
        {optional && date && (
          <button type="button" className="ml-auto text-xs text-gray-500 underline" onClick={() => onChange("")}>Clear</button>
        )}
      </div>
    </div>
  );
}
