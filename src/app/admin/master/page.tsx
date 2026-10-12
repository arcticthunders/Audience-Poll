"use client";

import { useEffect, useState } from "react";
import {
  subscribeToMasterEvents,
  createMasterEvent,
  deleteMasterEvent,
} from "@/lib/votingService";
import { MasterEvent } from "@/lib/types";
import {
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  LogOut,
  AlertTriangle,
  ArrowLeft,
  Settings,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function MasterEventsPage() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Master Events Real-time List
  const [masterEvents, setMasterEvents] = useState<MasterEvent[]>([]);

  // New Master Event Form State
  const [newMasterId, setNewMasterId] = useState<string>("");
  const [newMasterName, setNewMasterName] = useState<string>("");
  const [newMasterDesc, setNewMasterDesc] = useState<string>("");
  const [creatingMaster, setCreatingMaster] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete Master Modal State
  const [eventToDelete, setEventToDelete] = useState<MasterEvent | null>(null);
  const [masterDeleteTextConfirm, setMasterDeleteTextConfirm] = useState<string>("");
  const [masterPassConfirm, setMasterPassConfirm] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const validMasterPass = process.env.NEXT_PUBLIC_MASTER_PASSWORD || "masterpass";
    const validAdminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";

    if (passwordInput === validMasterPass || passwordInput === validAdminPass) {
      setIsAuthenticated(true);
    } else {
      setAuthError("Invalid credentials. Please enter a valid password.");
    }
  };

  // Subscribe to Master Events
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribeMasters = subscribeToMasterEvents((events) => {
      setMasterEvents(events);
    });

    return () => unsubscribeMasters();
  }, [isAuthenticated]);

  // Create Master Event
  const handleCreateMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterId || !newMasterName) return;

    setCreatingMaster(true);
    setSuccessMsg(null);

    const generatedId = newMasterId.trim().toLowerCase().replace(/\s+/g, "_");

    await createMasterEvent({
      id: generatedId,
      name: newMasterName.trim(),
      description: newMasterDesc.trim(),
    });

    setNewMasterId("");
    setNewMasterName("");
    setNewMasterDesc("");
    setCreatingMaster(false);

    setSuccessMsg(`Master Event '${newMasterName.trim()}' created successfully!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Confirm Delete Master Event (Require typing 'DELETE' + Master Password)
  const confirmDeleteMaster = async () => {
    if (!eventToDelete) return;
    setDeleteError(null);

    if (masterDeleteTextConfirm.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Please type 'DELETE' to confirm deletion.");
      return;
    }

    const validMasterPass = process.env.NEXT_PUBLIC_MASTER_PASSWORD || "masterpass";

    if (masterPassConfirm !== validMasterPass) {
      setDeleteError("Invalid Master Password!");
      return;
    }

    await deleteMasterEvent(eventToDelete.id);
    setEventToDelete(null);
    setMasterDeleteTextConfirm("");
    setMasterPassConfirm("");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Settings className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Master Events Settings</h1>
            <p className="text-xs text-slate-400">Enter password to configure top-level events</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin / Master Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition cursor-pointer"
            >
              Access Master Settings
            </button>

            <div className="text-center pt-2">
              <Link
                href="/admin"
                className="text-xs text-slate-400 hover:text-amber-400 transition flex items-center justify-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Stage Control</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans select-none">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between p-4 sm:px-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-8">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-lg text-white">Master Events Configuration</h1>
            <p className="text-xs text-slate-400">Manage top-level event containers</p>
          </div>
        </div>

        <button
          onClick={() => setIsAuthenticated(false)}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit Settings</span>
        </button>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Create Master Event */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Plus className="w-5 h-5 text-amber-400" />
            <span>Create Master Event</span>
          </h3>

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateMaster} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Event Identifier (ID)
              </label>
              <input
                type="text"
                value={newMasterId}
                onChange={(e) => setNewMasterId(e.target.value)}
                placeholder="e.g. fest_2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Event Title
              </label>
              <input
                type="text"
                value={newMasterName}
                onChange={(e) => setNewMasterName(e.target.value)}
                placeholder="e.g. Annual Cultural Fest 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newMasterDesc}
                onChange={(e) => setNewMasterDesc(e.target.value)}
                placeholder="e.g. Main Auditorium Events"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={creatingMaster}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Add Master Event
            </button>
          </form>
        </div>

        {/* Right Column: Master Events List */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white">Master Events Directory</h3>
              <p className="text-xs text-slate-400">Top-level event containers</p>
            </div>
            <span className="text-xs font-mono text-slate-500">{masterEvents.length} events</span>
          </div>

          <div className="space-y-3">
            {masterEvents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No Master Events created yet. Use the form on the left to add one!
              </p>
            ) : (
              masterEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-white text-sm">{evt.name}</p>
                    <p className="text-slate-500 font-mono text-[11px]">ID: {evt.id}</p>
                    {evt.description && (
                      <p className="text-slate-400 text-xs">{evt.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEventToDelete(evt);
                      setMasterDeleteTextConfirm("");
                      setMasterPassConfirm("");
                      setDeleteError(null);
                    }}
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer border border-rose-500/20"
                    title="Delete Master Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Delete Master Event Verification Modal (Two-step: 'DELETE' + Master Password) */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Delete Master Event</h3>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">{eventToDelete.name}</strong>? Complete both steps below:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Step 1: Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={masterDeleteTextConfirm}
                  onChange={(e) => setMasterDeleteTextConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Step 2: Enter Master Password
                </label>
                <input
                  type="password"
                  value={masterPassConfirm}
                  onChange={(e) => setMasterPassConfirm(e.target.value)}
                  placeholder="masterpass"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {deleteError && (
              <p className="text-xs text-rose-400 font-medium">{deleteError}</p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEventToDelete(null);
                  setDeleteError(null);
                  setMasterDeleteTextConfirm("");
                  setMasterPassConfirm("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteMaster}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
