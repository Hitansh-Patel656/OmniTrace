"use client";

import React, { useState } from "react";
import { X, Send, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Channel } from "@/lib/types";
import { api } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const IngestModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [channel, setChannel] = useState<Channel>("web");
  const [email, setEmail] = useState("alice@example.com");
  const [phone, setPhone] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [cookieId, setCookieId] = useState("ck-a1");
  const [loyaltyId, setLoyaltyId] = useState("");
  const [eventType, setEventType] = useState("page_view");
  const [payloadJson, setPayloadJson] = useState(
    JSON.stringify({ page: "/products/wireless-headphones", price: 149.99 }, null, 2)
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; id?: string; error?: string } | null>(
    null
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      let parsedPayload: Record<string, unknown> = {};
      if (payloadJson.trim()) {
        parsedPayload = JSON.parse(payloadJson);
      }

      const raw_identifiers: Record<string, string | null> = {};
      if (email.trim()) raw_identifiers.email = email.trim();
      if (phone.trim()) raw_identifiers.phone = phone.trim();
      if (deviceId.trim()) raw_identifiers.device_id = deviceId.trim();
      if (cookieId.trim()) raw_identifiers.cookie_id = cookieId.trim();
      if (loyaltyId.trim()) raw_identifiers.loyalty_id = loyaltyId.trim();

      const res = await api.ingestEvent(channel, {
        raw_identifiers,
        event_type: eventType.trim(),
        event_payload: parsedPayload,
        timestamp: new Date().toISOString(),
      });

      setResult({ success: true, id: res.id });
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to ingest event";
      setResult({ success: false, error: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0c121e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-700/60">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Live Event Ingestion Simulator</h2>
              <p className="text-xs text-slate-400">Post raw interaction to /api/ingest/:channel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Channel selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Channel Stream
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["web", "mobile_app", "call_center", "in_person"] as Channel[]).map((ch) => (
                <button
                  type="button"
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                    channel === ch
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                      : "border-[#1e293b] bg-[#080d16] text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {ch.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Identifiers Grid */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Raw Identifiers (Stitching Clues)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400">Email</span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alice@example.com"
                  className="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Phone</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1-555-0101"
                  className="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Cookie ID</span>
                <input
                  type="text"
                  value={cookieId}
                  onChange={(e) => setCookieId(e.target.value)}
                  placeholder="e.g. ck-a1"
                  className="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Device ID / Loyalty ID</span>
                <input
                  type="text"
                  value={deviceId || loyaltyId}
                  onChange={(e) => {
                    setDeviceId(e.target.value);
                    setLoyaltyId(e.target.value);
                  }}
                  placeholder="e.g. dev-a1 or LOY-1006"
                  className="mt-1 w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Event Action
            </label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. add_to_cart, checkout_started, call_escalated"
              className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Payload JSON */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Event Payload (JSON)
            </label>
            <textarea
              rows={3}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] p-2.5 font-mono text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Result Alert */}
          {result && (
            <div
              className={`rounded-lg p-3 text-xs flex items-start gap-2 border ${
                result.success
                  ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800/80 text-rose-300"
              }`}
            >
              {result.success ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              )}
              <div>
                <p className="font-medium">
                  {result.success ? "Event Ingested & Stitched (202 Accepted)!" : "Ingestion Failed"}
                </p>
                {result.id && (
                  <p className="font-mono text-[11px] text-emerald-400/80 mt-0.5">
                    MongoDB Ref ID: {result.id}
                  </p>
                )}
                {result.error && <p className="mt-0.5 text-rose-300">{result.error}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#1e293b] px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:brightness-110 disabled:opacity-50"
            >
              <Send size={14} />
              {loading ? "Ingesting..." : "Ingest & Stitch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
