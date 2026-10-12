"use client";

import { useEffect, useState } from "react";
import {
  subscribeToMasterEvents,
  subscribeToSubEvents,
  subscribeToSubEventAnalytics,
} from "@/lib/votingService";
import { MasterEvent, SubEvent, ParticipantAnalytics } from "@/lib/types";
import {
  Trophy,
  Star,
  Award,
  Printer,
  Sliders,
  ArrowUpDown,
  BarChart3,
  Users,
  Sparkles,
  Medal,
} from "lucide-react";
import Link from "next/link";

export default function AnalyticsPage() {
  const [masterEvents, setMasterEvents] = useState<MasterEvent[]>([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [analyticsList, setAnalyticsList] = useState<ParticipantAnalytics[]>([]);

  const [selectedMasterId, setSelectedMasterId] = useState<string>("");
  const [selectedSubId, setSelectedSubId] = useState<string>("");

  // Sort mode: "weighted" (default) or "average"
  const [sortBy, setSortBy] = useState<"weighted" | "average">("weighted");

  // Subscribe to Master Events
  useEffect(() => {
    const unsubscribeMasters = subscribeToMasterEvents((events) => {
      setMasterEvents(events);
    });

    return () => unsubscribeMasters();
  }, []);

  // Validate and sync selectedMasterId against real-time masterEvents
  useEffect(() => {
    if (masterEvents.length === 0) {
      if (selectedMasterId !== "") setSelectedMasterId("");
      return;
    }

    if (!selectedMasterId || !masterEvents.some((m) => m.id === selectedMasterId)) {
      setSelectedMasterId(masterEvents[0].id);
    }
  }, [masterEvents, selectedMasterId]);

  // Subscribe to Sub-Events for selected Master Event
  useEffect(() => {
    if (!selectedMasterId) {
      setSubEvents([]);
      setSelectedSubId("");
      return;
    }

    const unsubscribeSubs = subscribeToSubEvents(selectedMasterId, (subs) => {
      setSubEvents(subs);
      if (subs.length === 0) {
        setSelectedSubId("");
      } else {
        const subExists = subs.some((s) => s.id === selectedSubId);
        if (!selectedSubId || !subExists) {
          setSelectedSubId(subs[0].id);
        }
      }
    });

    return () => unsubscribeSubs();
  }, [selectedMasterId]);

  // Subscribe to Sub-Event Analytics
  useEffect(() => {
    if (!selectedSubId) {
      setAnalyticsList([]);
      return;
    }

    const unsubscribeAnalytics = subscribeToSubEventAnalytics(
      selectedSubId,
      (list) => {
        setAnalyticsList(list);
      }
    );

    return () => unsubscribeAnalytics();
  }, [selectedSubId]);

  // Sort list according to user preference
  const sortedList = [...analyticsList].sort((a, b) => {
    if (sortBy === "weighted") {
      if (b.totalWeightedScore !== a.totalWeightedScore) {
        return b.totalWeightedScore - a.totalWeightedScore;
      }
      return b.averageScore - a.averageScore;
    } else {
      if (b.averageScore !== a.averageScore) {
        return b.averageScore - a.averageScore;
      }
      return b.totalWeightedScore - a.totalWeightedScore;
    }
  });

  // Assign ranks
  const rankedList = sortedList.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  const top3 = rankedList.slice(0, 3);
  const activeSubObj = subEvents.find((s) => s.id === selectedSubId);
  const maxScore = Math.max(...rankedList.map((r) => r.totalWeightedScore), 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans select-none print:bg-white print:text-slate-900 print:p-0">
      {/* Top Navigation & Controls */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:px-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-6 gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white leading-tight">
              Event Analytics & Judges Score Sheet
            </h1>
            <p className="text-xs text-slate-400">Holistic ratings tally & leaderboard</p>
          </div>
        </div>

        {/* Dropdown Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
              Master Event
            </label>
            <select
              value={selectedMasterId}
              onChange={(e) => setSelectedMasterId(e.target.value)}
              className="bg-slate-950 text-amber-400 font-bold border border-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            >
              {masterEvents.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
              Sub-Event Category
            </label>
            <select
              value={selectedSubId}
              onChange={(e) => setSelectedSubId(e.target.value)}
              className="bg-slate-950 text-emerald-400 font-bold border border-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            >
              {subEvents.length === 0 ? (
                <option value="">No Sub-Events Available</option>
              ) : (
                subEvents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer mt-3 md:mt-0"
          >
            <Printer className="w-4 h-4" />
            <span>Print Score Sheet</span>
          </button>

          <Link
            href="/admin"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer mt-3 md:mt-0"
          >
            <Sliders className="w-4 h-4" />
            <span>Stage Control</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Printable Score Sheet Header */}
        <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold">Judges Official Score Sheet</h1>
          <p className="text-sm text-slate-600">
            Event: <strong>{masterEvents.find((m) => m.id === selectedMasterId)?.name}</strong> | Category: <strong>{activeSubObj?.name || selectedSubId}</strong>
          </p>
        </div>

        {/* Section 1: Top 3 Podium Cards (Judges Quick Reference) */}
        {top3.length > 0 && (
          <div className="print:hidden space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Top 3 Leaders (Judges Quick Podium)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((contestant, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;

                return (
                  <div
                    key={contestant.participantId}
                    className={`p-5 rounded-3xl border transition shadow-xl relative overflow-hidden ${
                      isFirst
                        ? "bg-gradient-to-b from-amber-500/20 to-slate-900 border-amber-500/50"
                        : isSecond
                        ? "bg-gradient-to-b from-slate-400/15 to-slate-900 border-slate-400/40"
                        : "bg-gradient-to-b from-amber-700/15 to-slate-900 border-amber-700/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-black">
                        {isFirst ? "🥇 1st Place" : isSecond ? "🥈 2nd Place" : "🥉 3rd Place"}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-amber-400">
                        Chest #{contestant.participantId}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">
                      {contestant.participantName}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Total Weighted Score
                        </span>
                        <span className="text-lg font-black text-amber-400">
                          {contestant.totalWeightedScore} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Average Rating
                        </span>
                        <span className="text-lg font-black text-white flex items-center space-x-1">
                          <span>{contestant.averageScore}</span>
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Tabular Score Sheet Table */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 print:bg-white print:border-none print:shadow-none print:p-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 print:border-slate-300">
            <div>
              <h2 className="text-lg font-bold text-white print:text-black flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-amber-400 print:hidden" />
                <span>Audience Score Sheet Table</span>
              </h2>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Detailed star breakdown & weighted total score per contestant
              </p>
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center space-x-2 text-xs bg-slate-950 p-1.5 rounded-xl border border-slate-800 print:hidden">
              <span className="text-slate-400 font-semibold pl-2 flex items-center space-x-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort By:</span>
              </span>
              <button
                type="button"
                onClick={() => setSortBy("weighted")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  sortBy === "weighted"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Total Score (Points)
              </button>
              <button
                type="button"
                onClick={() => setSortBy("average")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  sortBy === "average"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Average Rating (⭐)
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                  <th className="p-3">Rank</th>
                  <th className="p-3">Chest #</th>
                  <th className="p-3">Participant Name</th>
                  <th className="p-3 text-center">5★</th>
                  <th className="p-3 text-center">4★</th>
                  <th className="p-3 text-center">3★</th>
                  <th className="p-3 text-center">2★</th>
                  <th className="p-3 text-center">1★</th>
                  <th className="p-3 text-center">Voters</th>
                  <th className="p-3 text-right">Total Score (Points)</th>
                  <th className="p-3 text-right">Average Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {rankedList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-500">
                      No ratings recorded yet for this sub-event category.
                    </td>
                  </tr>
                ) : (
                  rankedList.map((row) => (
                    <tr
                      key={row.participantId}
                      className="hover:bg-slate-800/40 transition print:hover:bg-white"
                    >
                      <td className="p-3 font-bold text-white print:text-black">
                        {row.rank === 1 ? "🥇 1st" : row.rank === 2 ? "🥈 2nd" : row.rank === 3 ? "🥉 3rd" : `#${row.rank}`}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400 print:text-black">
                        #{row.participantId}
                      </td>
                      <td className="p-3 font-bold text-white print:text-black">
                        {row.participantName}
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-400 font-bold">
                        {row.starDistribution[5] || 0}
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-300">
                        {row.starDistribution[4] || 0}
                      </td>
                      <td className="p-3 text-center font-mono text-amber-300">
                        {row.starDistribution[3] || 0}
                      </td>
                      <td className="p-3 text-center font-mono text-orange-400">
                        {row.starDistribution[2] || 0}
                      </td>
                      <td className="p-3 text-center font-mono text-rose-400">
                        {row.starDistribution[1] || 0}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-300 print:text-black">
                        {row.totalVotes}
                      </td>
                      <td className="p-3 text-right font-black text-amber-400 text-sm print:text-black">
                        {row.totalWeightedScore} pts
                      </td>
                      <td className="p-3 text-right font-black text-white text-sm print:text-black">
                        {row.averageScore} ⭐
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Visual Performance Bar Chart */}
        {rankedList.length > 0 && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 print:hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <span>Contestant Total Score Comparison</span>
                </h2>
                <p className="text-xs text-slate-400">Visual relative performance gap</p>
              </div>
            </div>

            <div className="space-y-4">
              {rankedList.map((row) => {
                const percentage = Math.round((row.totalWeightedScore / maxScore) * 100);

                return (
                  <div key={row.participantId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-white">
                        Chest #{row.participantId} — {row.participantName}
                      </span>
                      <span className="text-amber-400 font-bold">
                        {row.totalWeightedScore} pts ({row.averageScore} ⭐)
                      </span>
                    </div>

                    <div className="h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
