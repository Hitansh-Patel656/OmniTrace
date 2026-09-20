"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Users,
  Mail,
  Phone,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Filter,
  RefreshCw,
  Layers,
  Flame,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";
import { api } from "@/lib/api";
import { CustomerSearchResult, CustomerDirectoryItem } from "@/lib/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { ConfidenceScore } from "@/components/ui/ConfidenceScore";
import { DEMO_SCENARIOS, formatDateTime, formatShortUUID } from "@/lib/formatters";

export default function CustomersPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loyaltyId, setLoyaltyId] = useState("");
  const [directory, setDirectory] = useState<CustomerDirectoryItem[]>([]);
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load live customer directory from DB on mount
  const loadDirectory = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomersList({ limit: 50 });
      setDirectory(res.data || []);
    } catch (err: unknown) {
      console.error("Failed to load customer directory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const handleSearch = async (overrideParams?: {
    email?: string;
    phone?: string;
    loyalty_id?: string;
  }) => {
    const qEmail = overrideParams ? overrideParams.email : email;
    const qPhone = overrideParams ? overrideParams.phone : phone;
    const qLoyalty = overrideParams ? overrideParams.loyalty_id : loyaltyId;

    if (!qEmail && !qPhone && !qLoyalty) {
      // If cleared, revert to full directory
      setSearched(false);
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await api.searchCustomers({
        email: qEmail,
        phone: qPhone,
        loyalty_id: qLoyalty,
        page: 1,
        limit: 20,
      });
      setResults(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (persona: (typeof DEMO_SCENARIOS)[number]) => {
    setEmail("");
    setPhone("");
    setLoyaltyId("");

    if (persona.lookupKey === "email") {
      setEmail(persona.lookupVal);
      handleSearch({ email: persona.lookupVal });
    } else if (persona.lookupKey === "phone") {
      setPhone(persona.lookupVal);
      handleSearch({ phone: persona.lookupVal });
    } else if (persona.lookupKey === "loyalty_id") {
      setLoyaltyId(persona.lookupVal);
      handleSearch({ loyalty_id: persona.lookupVal });
    }
  };

  const handleReset = () => {
    setEmail("");
    setPhone("");
    setLoyaltyId("");
    setSearched(false);
    setResults([]);
    setError(null);
    loadDirectory();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Users size={14} />
            <span>Identity Resolution Portal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Customer Explorer & Identity Graph
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Query stitched customer profiles across multi-channel identifiers or browse live unified customers via{" "}
            <code className="text-slate-300">GET /api/customers</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {searched && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-all"
            >
              <RefreshCw size={13} />
              <span>Show All Customers</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Persona Quick Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-indigo-400">
            1-Click Benchmark Personas
          </span>
          <span>Click any persona to auto-populate identifier and search</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {DEMO_SCENARIOS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetClick(p)}
              className="group flex items-center gap-2 rounded-lg border border-[#1e293b] bg-[#0c121e] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-indigo-500/60 hover:bg-[#111927] hover:text-white transition-all shadow-sm"
            >
              <span className="font-bold text-white group-hover:text-indigo-300">
                {p.name}
              </span>
              <span className="font-mono text-[10px] text-slate-400 group-hover:text-slate-300">
                {p.lookupVal}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Identifier Search Form */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1e293b]/70 pb-3">
          <Filter size={16} className="text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Multi-Identifier Customer Lookup
          </h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Mail size={13} className="text-indigo-400" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alice@example.com"
              className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3.5 py-2 text-xs text-slate-200 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Phone Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Phone size={13} className="text-emerald-400" />
              <span>Phone Number</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1-555-0101"
              className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3.5 py-2 text-xs text-slate-200 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Loyalty ID Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <CreditCard size={13} className="text-amber-400" />
              <span>Loyalty / Member ID</span>
            </label>
            <input
              type="text"
              value={loyaltyId}
              onChange={(e) => setLoyaltyId(e.target.value)}
              placeholder="e.g. LOY-1006"
              className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3.5 py-2 text-xs text-slate-200 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Action Button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              <Search size={14} />
              <span>{loading ? "Searching..." : "Search Customers"}</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-800/80 p-3 text-xs text-rose-300">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results / Live Directory Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            {searched
              ? `Matching Resolved Identifiers (${results.length})`
              : `Live Customer Directory (${directory.length} Stitched Profiles)`}
          </h2>
          {!searched && (
            <span className="text-xs text-slate-400">
              Auto-refreshed from PostgreSQL <code className="text-slate-300">customers</code> table
            </span>
          )}
        </div>

        {searched ? (
          /* Search Results Table */
          results.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[#1e293b] bg-[#0c121e] shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#1e293b] bg-[#080d16] text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer ID (UUID)</th>
                    <th className="px-5 py-3 font-semibold">Matched Identifier</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Resolution Confidence</th>
                    <th className="px-5 py-3 font-semibold">First Seen</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60">
                  {results.map((row) => (
                    <tr key={row.customer_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-3 font-mono text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{row.customer_id}</span>
                          <button
                            onClick={() => handleCopy(row.customer_id)}
                            className="text-slate-400 hover:text-white"
                            title="Copy UUID"
                          >
                            {copiedId === row.customer_id ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-white">{row.identifier_value}</td>
                      <td className="px-5 py-3">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 capitalize">
                          {row.identifier_type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <ConfidenceScore score={row.confidence_score} />
                      </td>
                      <td className="px-5 py-3 text-slate-400">{formatDateTime(row.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/customers/${row.customer_id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-400 transition-all shadow-sm"
                        >
                          <span>View Timeline</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1e293b] p-12 text-center bg-[#0c121e]/50">
              <AlertCircle size={32} className="text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No Customers Found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No customer was found matching the provided identifier. Try one of the preset benchmark buttons above.
              </p>
            </div>
          )
        ) : (
          /* Live Customer Directory Table */
          <div className="overflow-hidden rounded-xl border border-[#1e293b] bg-[#0c121e] shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1e293b] bg-[#080d16] text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer ID (UUID)</th>
                  <th className="px-5 py-3 font-semibold">Primary Identifier</th>
                  <th className="px-5 py-3 font-semibold">Stitched Channels</th>
                  <th className="px-5 py-3 font-semibold">Events Count</th>
                  <th className="px-5 py-3 font-semibold">Health & Flags</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {directory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Loading customer directory from PostgreSQL...
                    </td>
                  </tr>
                ) : (
                  directory.map((cust) => (
                    <tr key={cust.customer_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-3 font-mono text-slate-200">
                        <div className="flex items-center gap-2">
                          <span title={cust.customer_id}>{formatShortUUID(cust.customer_id)}</span>
                          <button
                            onClick={() => handleCopy(cust.customer_id)}
                            className="text-slate-400 hover:text-white"
                            title="Copy UUID"
                          >
                            {copiedId === cust.customer_id ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-white">
                        {cust.primary_identifier || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {cust.channels.map((ch) => (
                            <ChannelBadge key={ch} channel={ch} size="sm" />
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-cyan-400">
                        {cust.total_events}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {cust.is_churn_risk && (
                            <span className="rounded bg-rose-950/80 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800 flex items-center gap-1">
                              <AlertOctagon size={11} />
                              <span>CHURN</span>
                            </span>
                          )}
                          {cust.has_escalation && (
                            <span className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-800 flex items-center gap-1">
                              <Flame size={11} />
                              <span>ESCALATED</span>
                            </span>
                          )}
                          {cust.has_dropoff && (
                            <span className="rounded bg-rose-950/80 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800 flex items-center gap-1">
                              <AlertTriangle size={11} />
                              <span>DROP-OFF</span>
                            </span>
                          )}
                          {!cust.is_churn_risk && !cust.has_escalation && !cust.has_dropoff && (
                            <span className="text-[11px] text-emerald-400 font-medium">Optimal</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/customers/${cust.customer_id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-400 transition-all shadow-sm"
                        >
                          <span>View Timeline</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
