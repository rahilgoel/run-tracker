'use client'
import React, { useEffect, useMemo, useState } from "react";

/**
 * Run Tracker (single-file React app)
 * - Add runs as miles + date
 * - Shows totals for: Year-to-date, Month-to-date, Week-to-date
 * - Persists to localStorage
 *
 * Notes:
 * - Week starts on Monday (ISO week). Adjust in startOfWeek() if you prefer Sunday.
 */

const LS_KEY = "run_tracker_v1";

function clampMiles(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

function formatMiles(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function toISODate(d) {
  // yyyy-mm-dd in local time
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(s) {
  // Interpret as local date (avoid timezone shifting)
  const [y, m, d] = (s || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d) {
  // ISO week: Monday start
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // move back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return startOfDay(monday);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

function endExclusiveNextDay(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function withinRange(dateObj, startInclusive, endExclusive) {
  const t = dateObj.getTime();
  return t >= startInclusive.getTime() && t < endExclusive.getTime();
}

function loadRuns() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => ({
        id: String(r.id || ""),
        date: String(r.date || ""),
        miles: clampMiles(r.miles),
        note: String(r.note || ""),
      }))
      .filter((r) => r.id && r.date && r.miles > 0);
  } catch {
    return [];
  }
}

function saveRuns(runs) {
  localStorage.setItem(LS_KEY, JSON.stringify(runs));
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function Badge({ label, value }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
        {formatMiles(value)}
        <span className="ml-2 text-base font-medium text-slate-500">mi</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white">
      <div className="text-lg font-semibold text-slate-900">No runs yet</div>
      <div className="mt-1 text-slate-600">
        Add your first entry above and your weekly, monthly, and yearly totals will appear.
      </div>
    </div>
  );
}

export default function RunTrackerApp() {
  const [runs, setRuns] = useState(() => loadRuns());
  const [miles, setMiles] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    saveRuns(runs);
  }, [runs]);

  const now = useMemo(() => new Date(), []);
  const yStart = useMemo(() => startOfYear(now), [now]);
  const mStart = useMemo(() => startOfMonth(now), [now]);
  const wStart = useMemo(() => startOfWeek(now), [now]);
  const tomorrow = useMemo(() => endExclusiveNextDay(now), [now]);

  const totals = useMemo(() => {
    let year = 0,
      month = 0,
      week = 0,
      all = 0;

    for (const r of runs) {
      const d = parseISODate(r.date);
      if (!d) continue;
      all += r.miles;
      if (withinRange(d, yStart, tomorrow)) year += r.miles;
      if (withinRange(d, mStart, tomorrow)) month += r.miles;
      if (withinRange(d, wStart, tomorrow)) week += r.miles;
    }

    return { year, month, week, all };
  }, [runs, yStart, mStart, wStart, tomorrow]);

  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...runs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (!q) return list;
    return list.filter((r) => {
      return (
        r.date.toLowerCase().includes(q) ||
        String(r.miles).toLowerCase().includes(q) ||
        (r.note || "").toLowerCase().includes(q)
      );
    });
  }, [runs, query]);

  const canAdd = useMemo(() => {
    const m = Number(miles);
    if (!Number.isFinite(m) || m <= 0) return false;
    const d = parseISODate(date);
    if (!d) return false;
    // Optional: prevent future dates beyond today
    if (d.getTime() >= tomorrow.getTime()) return false;
    return true;
  }, [miles, date, tomorrow]);

  function addRun(e) {
    e?.preventDefault?.();
    if (!canAdd) return;
    const entry = {
      id: uid(),
      date,
      miles: clampMiles(miles),
      note: note.trim(),
    };
    setRuns((prev) => [entry, ...prev]);
    setMiles("");
    setNote("");
  }

  function removeRun(id) {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }

  function clearAll() {
    if (!confirm("Clear all runs? This cannot be undone.")) return;
    setRuns([]);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(runs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runs_${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!Array.isArray(parsed)) throw new Error("Invalid file");
        const cleaned = parsed
          .map((r) => ({
            id: String(r.id || uid()),
            date: String(r.date || ""),
            miles: clampMiles(r.miles),
            note: String(r.note || ""),
          }))
          .filter((r) => r.date && r.miles > 0);
        setRuns((prev) => {
          // merge by id, prefer imported
          const byId = new Map(prev.map((r) => [r.id, r]));
          for (const r of cleaned) byId.set(r.id, r);
          return Array.from(byId.values());
        });
      } catch {
        alert("Could not import file. Please upload a valid JSON export.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Run Tracker</h1>
            <p className="mt-1 text-slate-600">
              Log miles, then see your weekly, monthly, and yearly totals.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportJSON}
              className="rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 shadow-sm hover:bg-slate-100"
              type="button"
            >
              Export
            </button>
            <label className="rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 shadow-sm hover:bg-slate-100 cursor-pointer">
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => importJSON(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Badge label="Week to date" value={totals.week} />
          <Badge label="Month to date" value={totals.month} />
          <Badge label="Year to date" value={totals.year} />
        </section>

        <section className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <form onSubmit={addRun} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-600">Miles</label>
              <input
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                inputMode="decimal"
                placeholder="e.g., 3.1"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-600">Date</label>
              <input
                type="date"
                value={date}
                max={toISODate(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-600">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="tempo, trail, etc."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="sm:col-span-6 flex items-center justify-between gap-3 pt-2">
              <div className="text-sm text-slate-500">
                Week starts Monday. Future dates are blocked.
              </div>
              <button
                type="submit"
                disabled={!canAdd}
                className={`rounded-2xl px-4 py-2 text-sm font-medium shadow-sm border transition ${
                  canAdd
                    ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                }`}
              >
                Add run
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Entries</h2>
            <div className="flex gap-2 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (date, miles, note)"
                className="w-full sm:w-64 rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                onClick={clearAll}
                type="button"
                className="rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 shadow-sm hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3">
            {filteredRuns.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-200">
                  {filteredRuns.map((r) => (
                    <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-xl font-semibold">{formatMiles(r.miles)} mi</div>
                          <div className="text-sm text-slate-500">{r.date}</div>
                        </div>
                        {r.note ? (
                          <div className="mt-1 text-sm text-slate-600">{r.note}</div>
                        ) : null}
                      </div>
                      <button
                        onClick={() => removeRun(r.id)}
                        className="rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 hover:bg-slate-100"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">All time total</div>
                  <div className="text-sm font-semibold">{formatMiles(totals.all)} mi</div>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-10 text-xs text-slate-500">
          Data is stored locally in your browser (localStorage). Export a JSON backup if you want portability.
        </footer>
      </div>
    </div>
  );
}
