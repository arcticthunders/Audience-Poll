"use client";

import { useEffect, useState } from "react";
import {
  subscribeToCurrentStage,
  subscribeToMasterEvents,
  subscribeToSubEvents,
  subscribeToSubEventParticipants,
  subscribeToPerformedParticipants,
  subscribeToLiveRatings,
  updateCurrentStage,
  resetCurrentStage,
  hasParticipantPerformed,
  recordParticipantPerformed,
  addSubEventParticipant,
  updateParticipantStatus,
  resetParticipantToPending,
  deleteSubEventParticipant,
  createSubEvent,
  toggleSubEventStatus,
  deleteSubEvent,
} from "@/lib/votingService";
import { CurrentStage, MasterEvent, SubEvent, SubEventParticipant, RatingStats } from "@/lib/types";
import Link from "next/link";
import {
  ShieldCheck,
  Radio,
  Plus,
  Trash2,
  Lock,
  Flame,
  CheckCircle2,
  Sliders,
  LogOut,
  AlertTriangle,
  AlertCircle,
  Star,
  BarChart3,
  XCircle,
  Loader2,
  Layers,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trophy,
  UserPlus,
  Users,
  UserCheck,
  RotateCcw,
} from "lucide-react";

export default function AdminPage() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Admin Tab ("stage" | "roster" | "subevents")
  const [activeTab, setActiveTab] = useState<"stage" | "roster" | "subevents">("stage");

  // Real-time Firestore Collections
  const [masterEvents, setMasterEvents] = useState<MasterEvent[]>([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [roster, setRoster] = useState<SubEventParticipant[]>([]);
  const [performedIds, setPerformedIds] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState<CurrentStage | null>(null);
  const [liveStats, setLiveStats] = useState<RatingStats>({
    count: 0,
    average: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  // Selected Identifiers
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");
  const [selectedSubId, setSelectedSubId] = useState<string>("");

  const isCurrentVotingOpen = !!currentStage?.isVotingOpen;

  // Stage Controller Voting Mode: "sequential" (One by One) or "parallel" (All at Once)
  const [stageMode, setStageMode] = useState<"sequential" | "parallel">("sequential");

  // Single Stage Form Inputs
  const [chestNumber, setChestNumber] = useState<string>("");
  const [participantName, setParticipantName] = useState<string>("");

  // Group Stage Mode Selected Chest IDs
  const [selectedGroupChestIds, setSelectedGroupChestIds] = useState<string[]>([]);

  // Stage Action State
  const [savingStage, setSavingStage] = useState<boolean>(false);
  const [stageSuccessMsg, setStageSuccessMsg] = useState<string | null>(null);
  const [stageErrorMsg, setStageErrorMsg] = useState<string | null>(null);

  // Roster Management Form Inputs
  const [rosterChestNum, setRosterChestNum] = useState<string>("");
  const [rosterName, setRosterName] = useState<string>("");
  const [addingRoster, setAddingRoster] = useState<boolean>(false);
  const [rosterErrorMsg, setRosterErrorMsg] = useState<string | null>(null);
  const [rosterSuccessMsg, setRosterSuccessMsg] = useState<string | null>(null);

  // New Sub-Event Form State
  const [newSubName, setNewSubName] = useState<string>("");
  const [newSubVotingMode, setNewSubVotingMode] = useState<"sequential" | "parallel">("sequential");
  const [creatingSub, setCreatingSub] = useState<boolean>(false);
  const [newSubError, setNewSubError] = useState<string | null>(null);
  const [newSubSuccess, setNewSubSuccess] = useState<string | null>(null);

  // Sub-Event Delete Modal State
  const [subEventToDelete, setSubEventToDelete] = useState<SubEvent | null>(null);
  const [subDeleteTextConfirm, setSubDeleteTextConfirm] = useState<string>("");
  const [subPassConfirm, setSubPassConfirm] = useState<string>("");
  const [subDeleteError, setSubDeleteError] = useState<string | null>(null);

  // Roster Participant Delete Modal State
  const [rosterParticipantToDelete, setRosterParticipantToDelete] = useState<SubEventParticipant | null>(null);
  const [rosterDeleteTextConfirm, setRosterDeleteTextConfirm] = useState<string>("");
  const [rosterDeleteConfirmError, setRosterDeleteConfirmError] = useState<string | null>(null);

  // Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const validAdminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";
    const validMasterPass = process.env.NEXT_PUBLIC_MASTER_PASSWORD || "masterpass";

    if (passwordInput === validAdminPass || passwordInput === validMasterPass) {
      setIsAuthenticated(true);
    } else {
      setAuthError("Invalid credentials. Please enter a valid password.");
    }
  };

  // Subscribe to Master Events & Current Stage
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribeMasters = subscribeToMasterEvents((events) => {
      setMasterEvents(events);
    });

    const unsubscribeStage = subscribeToCurrentStage((stage) => {
      setCurrentStage(stage);
      if (stage && stage.isVotingOpen) {
        if (stage.masterEventId) {
          setSelectedMasterId(String(stage.masterEventId));
        }
        if (stage.subEventId) {
          setSelectedSubId(String(stage.subEventId));
        }
        if (stage.isGroupMode || stage.votingMode === "parallel") {
          setStageMode("parallel");
        } else {
          setStageMode("sequential");
          if (stage.participantId) {
            setChestNumber(String(stage.participantId));
          }
          if (stage.participantName) {
            setParticipantName(stage.participantName);
          }
        }
      }
    });

    return () => {
      unsubscribeMasters();
      unsubscribeStage();
    };
  }, [isAuthenticated]);

  // Sync and validate selectedMasterId against real-time masterEvents
  useEffect(() => {
    if (masterEvents.length === 0) {
      if (selectedMasterId !== "") setSelectedMasterId("");
      return;
    }

    const isCurrentValid = masterEvents.some((m) => m.id === selectedMasterId);
    if (!selectedMasterId || !isCurrentValid) {
      // Check if currentStage has a valid masterEventId in masterEvents
      if (currentStage?.masterEventId) {
        const stageMasterId = String(currentStage.masterEventId);
        if (masterEvents.some((m) => m.id === stageMasterId)) {
          setSelectedMasterId(stageMasterId);
          return;
        }
      }
      // Fallback to first existing master event
      setSelectedMasterId(masterEvents[0].id);
    }
  }, [masterEvents, currentStage, selectedMasterId]);

  // Subscribe to Sub-Events for selected Master Event
  useEffect(() => {
    if (!isAuthenticated || !selectedMasterId) {
      setSubEvents([]);
      return;
    }

    const unsubscribeSubs = subscribeToSubEvents(selectedMasterId, (subs) => {
      setSubEvents(subs);
    });

    return () => unsubscribeSubs();
  }, [isAuthenticated, selectedMasterId]);

  // Filter ONLY OPEN sub-events matching the active stageMode ("sequential" vs "parallel")
  const openSubEvents = subEvents.filter((s) => {
    if (s.status !== "OPEN") return false;
    const mode = s.votingMode || "sequential";
    return mode === stageMode;
  });

  // Keep selectedSubId valid against available subEvents and stageMode
  useEffect(() => {
    if (subEvents.length === 0) {
      setSelectedSubId((prev) => (prev !== "" ? "" : prev));
      return;
    }

    if (openSubEvents.length > 0) {
      // Pick first matching open sub-event if none selected or current is invalid
      setSelectedSubId((prev) => {
        const isMatch = openSubEvents.some((s) => s.id === prev);
        return isMatch ? prev : openSubEvents[0].id;
      });
    } else {
      // If no open sub-events match the mode, clear selectedSubId
      setSelectedSubId((prev) => (prev !== "" ? "" : prev));
    }
  }, [subEvents, openSubEvents, stageMode]);

  // Subscribe to Roster Participants for selected Sub-Event
  useEffect(() => {
    if (!isAuthenticated || !selectedSubId) {
      setRoster([]);
      setPerformedIds([]);
      return;
    }

    const currentSub = subEvents.find((s) => s.id === selectedSubId);
    if (!currentSub || currentSub.status !== "OPEN") {
      setRoster([]);
      setPerformedIds([]);
      return;
    }

    const unsubscribeRoster = subscribeToSubEventParticipants(selectedSubId, (list) => {
      setRoster(list);
    });

    const unsubscribePerformed = subscribeToPerformedParticipants(selectedSubId, (pids) => {
      setPerformedIds(pids);
    });

    return () => {
      unsubscribeRoster();
      unsubscribePerformed();
    };
  }, [isAuthenticated, selectedSubId, subEvents]);

  // Compute available roster strictly for selectedSubId with status 0 (NOT STARTED)
  const availableRoster = roster.filter((p) => {
    if (String(p.subEventId) !== String(selectedSubId)) return false;
    const isPerf = performedIds.includes(String(p.participantId));
    const st = p.status !== undefined ? p.status : (isPerf ? 2 : 0);
    return st === 0;
  });

  // Reset chest number and participant name when selected sub-event changes (only when stage is closed)
  useEffect(() => {
    if (!isCurrentVotingOpen) {
      setChestNumber("");
      setParticipantName("");
    }
  }, [selectedSubId, isCurrentVotingOpen]);

  // Auto-clear chest number if participant is performed/no longer pending, unless stage is currently live for them
  useEffect(() => {
    if (!isCurrentVotingOpen && chestNumber) {
      const isPerf = performedIds.includes(String(chestNumber));
      const inAvailable = availableRoster.some((p) => String(p.participantId) === String(chestNumber));
      if (isPerf || (!inAvailable && roster.length > 0)) {
        setChestNumber("");
        setParticipantName("");
      }
    }
  }, [performedIds, availableRoster, chestNumber, roster.length, isCurrentVotingOpen]);

  // Determine active target for live ratings (either active stage participant or currently selected chest)
  const activeRatingChest = isCurrentVotingOpen && currentStage?.participantId && currentStage.participantId !== "PARALLEL"
    ? String(currentStage.participantId)
    : chestNumber;

  const activeRatingSubId = isCurrentVotingOpen && currentStage?.subEventId
    ? String(currentStage.subEventId)
    : selectedSubId;

  // Subscribe to Live Ratings Stats
  useEffect(() => {
    if (!isAuthenticated || !activeRatingSubId || !activeRatingChest) {
      setLiveStats({
        count: 0,
        average: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
      return;
    }

    const unsubscribeRatings = subscribeToLiveRatings(
      activeRatingSubId,
      activeRatingChest,
      (stats) => {
        setLiveStats(stats);
      }
    );

    return () => unsubscribeRatings();
  }, [isAuthenticated, activeRatingSubId, activeRatingChest]);

  // Handle Roster Selection in Stage Controller
  const handleRosterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setChestNumber("");
      setParticipantName("");
      return;
    }
    const found = roster.find((p) => p.participantId === val);
    if (found) {
      setChestNumber(found.participantId);
      setParticipantName(found.participantName);
    } else {
      setChestNumber(val);
    }
  };

  // Open Rating for Single Participant (Sequential Mode)
  const handleOpenSingleRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMasterId || !selectedSubId || !chestNumber.trim()) return;

    setSavingStage(true);
    setStageSuccessMsg(null);
    setStageErrorMsg(null);

    const formattedChest = chestNumber.trim();
    const activeSubObj = subEvents.find((s) => s.id === selectedSubId);
    const subName = activeSubObj ? activeSubObj.name : `Sub-Event ${selectedSubId}`;

    // Record participant as performed & set status to 1 (LIVE ON STAGE)
    await recordParticipantPerformed(
      selectedMasterId,
      selectedSubId,
      formattedChest,
      participantName.trim()
    );
    await updateParticipantStatus(selectedSubId, formattedChest, 1);

    // Update current stage document in Firestore
    await updateCurrentStage({
      masterEventId: selectedMasterId,
      subEventId: selectedSubId,
      subEventName: subName,
      participantId: formattedChest,
      participantName: participantName.trim() || `Participant ${formattedChest}`,
      isVotingOpen: true,
      votingMode: "sequential",
      isGroupMode: false,
    });

    setSavingStage(false);
    setStageSuccessMsg(`Sequential rating window OPENED for Chest #${formattedChest}!`);
    setTimeout(() => setStageSuccessMsg(null), 4000);
  };

  // Open Parallel Rating Mode for Multiple Chest Numbers
  const handleOpenGroupRating = async () => {
    if (!selectedMasterId || !selectedSubId || selectedGroupChestIds.length === 0) return;

    setSavingStage(true);
    setStageSuccessMsg(null);
    setStageErrorMsg(null);

    const activeSubObj = subEvents.find((s) => s.id === selectedSubId);
    const subName = activeSubObj ? activeSubObj.name : `Sub-Event ${selectedSubId}`;

    // Build group participants list
    const groupList = selectedGroupChestIds.map((cid) => {
      const found = roster.find((r) => r.participantId === cid);
      return {
        participantId: cid,
        participantName: found ? found.participantName : `Participant ${cid}`,
      };
    });

    // Record performed participants & set status to 1 (LIVE ON STAGE) for all in group
    for (const item of groupList) {
      await recordParticipantPerformed(
        selectedMasterId,
        selectedSubId,
        item.participantId,
        item.participantName
      );
      await updateParticipantStatus(selectedSubId, item.participantId, 1);
    }

    await updateCurrentStage({
      masterEventId: selectedMasterId,
      subEventId: selectedSubId,
      subEventName: subName,
      participantId: "PARALLEL",
      participantName: "Parallel Competition",
      isVotingOpen: true,
      votingMode: "parallel",
      isGroupMode: true,
      groupParticipants: groupList,
    });

    setSavingStage(false);
    setStageSuccessMsg(`PARALLEL rating window OPENED for ${groupList.length} Contestants!`);
    setTimeout(() => setStageSuccessMsg(null), 4000);
  };

  // Close Rating & Reset Stage (Set status 2: COMPLETED for active contestants)
  const handleCloseAndResetStage = async () => {
    if (!selectedMasterId || !selectedSubId) return;

    setSavingStage(true);
    setStageSuccessMsg(null);
    setStageErrorMsg(null);

    // Update active contestant(s) status to 2 (COMPLETED)
    if (
      currentStage?.participantId &&
      currentStage.participantId !== "PARALLEL" &&
      currentStage.participantId !== "GROUP"
    ) {
      await updateParticipantStatus(selectedSubId, currentStage.participantId, 2);
    }

    if (currentStage?.groupParticipants && currentStage.groupParticipants.length > 0) {
      for (const item of currentStage.groupParticipants) {
        await updateParticipantStatus(selectedSubId, item.participantId, 2);
      }
    }

    await resetCurrentStage(selectedMasterId, selectedSubId);

    setChestNumber("");
    setParticipantName("");
    setSelectedGroupChestIds([]);
    setSavingStage(false);

    setStageSuccessMsg("Rating CLOSED & marked COMPLETED for contestant(s)!");
    setTimeout(() => setStageSuccessMsg(null), 4000);
  };

  // Add Participant to Roster
  const handleAddRosterParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMasterId || !selectedSubId || !rosterChestNum.trim()) return;

    setAddingRoster(true);
    setRosterErrorMsg(null);
    setRosterSuccessMsg(null);

    const res = await addSubEventParticipant(
      selectedMasterId,
      selectedSubId,
      rosterChestNum.trim(),
      rosterName.trim()
    );

    if (res.success) {
      setRosterChestNum("");
      setRosterName("");
      setRosterSuccessMsg(`Chest #${rosterChestNum.trim()} added to roster!`);
      setTimeout(() => setRosterSuccessMsg(null), 3000);
    } else {
      setRosterErrorMsg(
        res.error ||
          "Firebase permissions error. Please update Firestore security rules in Firebase Console."
      );
    }

    setAddingRoster(false);
  };

  // Toggle Group Chest Selection
  const toggleGroupChest = (cid: string) => {
    setSelectedGroupChestIds((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    );
  };

  // Create Sub-Event (Auto-generates unique ID & checks Title uniqueness)
  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMasterId || !newSubName.trim()) return;

    setCreatingSub(true);
    setNewSubError(null);
    setNewSubSuccess(null);

    const res = await createSubEvent({
      masterEventId: selectedMasterId,
      name: newSubName.trim(),
      status: "OPEN",
      votingMode: newSubVotingMode,
    });

    if (res.success && res.id) {
      setSelectedSubId(res.id);
      setNewSubName("");
      setNewSubSuccess(`Sub-Event '${newSubName.trim()}' created successfully!`);
      setTimeout(() => setNewSubSuccess(null), 3000);
    } else {
      setNewSubError(res.error || "Failed to create Sub-Event.");
    }

    setCreatingSub(false);
  };

  // Toggle Sub-Event Status
  const handleToggleSubStatus = async (subId: string, currentStatus: "OPEN" | "CLOSED") => {
    if (
      currentStatus === "OPEN" &&
      isCurrentVotingOpen &&
      String(currentStage?.subEventId) === String(subId)
    ) {
      alert("Cannot close sub-event while it is currently live on stage! Please close the rating / reset the stage first.");
      return;
    }
    const nextStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
    await toggleSubEventStatus(subId, nextStatus);
  };

  // Confirm Delete Sub-Event
  const confirmDeleteSubEvent = async () => {
    if (!subEventToDelete) return;
    setSubDeleteError(null);

    if (subDeleteTextConfirm.trim().toUpperCase() !== "DELETE") {
      setSubDeleteError("Please type 'DELETE' to confirm deletion.");
      return;
    }

    const validAdminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";
    const validMasterPass = process.env.NEXT_PUBLIC_MASTER_PASSWORD || "masterpass";

    if (subPassConfirm !== validAdminPass && subPassConfirm !== validMasterPass) {
      setSubDeleteError("Invalid Admin Password!");
      return;
    }

    await deleteSubEvent(subEventToDelete.id);
    setSubEventToDelete(null);
    setSubDeleteTextConfirm("");
    setSubPassConfirm("");
  };

  // Confirm Delete Roster Contestant
  const confirmDeleteRosterParticipant = async () => {
    if (!rosterParticipantToDelete) return;
    setRosterDeleteConfirmError(null);

    if (rosterDeleteTextConfirm.trim().toUpperCase() !== "DELETE") {
      setRosterDeleteConfirmError("Please type 'DELETE' to confirm deletion.");
      return;
    }

    await deleteSubEventParticipant(rosterParticipantToDelete.id);
    setRosterParticipantToDelete(null);
    setRosterDeleteTextConfirm("");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Admin Dashboard</h1>
            <p className="text-xs text-slate-400">Enter password to access stage controls</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Password
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
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans select-none">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:px-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Sliders className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white leading-tight">Stage Control Center</h1>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Active Event:</span>
              <select
                value={selectedMasterId}
                onChange={(e) => setSelectedMasterId(e.target.value)}
                className="bg-slate-950 text-amber-400 font-bold border border-slate-800 rounded-lg px-2 py-0.5 text-xs focus:outline-none"
              >
                {masterEvents.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/analytics"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span>Score Sheets</span>
          </Link>

          <Link
            href="/admin/master"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 cursor-pointer"
            title="Master Event Settings"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Master Settings</span>
          </Link>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs (Stage, Roster, Sub-Events) */}
      <div className="max-w-6xl mx-auto flex space-x-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("stage")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition flex-shrink-0 cursor-pointer ${
            activeTab === "stage"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Live Stage Control</span>
        </button>

        <button
          onClick={() => setActiveTab("roster")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition flex-shrink-0 cursor-pointer ${
            activeTab === "roster"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Participants Roster ({selectedSubId ? roster.length : 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("subevents")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition flex-shrink-0 cursor-pointer ${
            activeTab === "subevents"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Sub-Events ({subEvents.length})</span>
        </button>
      </div>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto">
        {/* TAB 1: LIVE STAGE CONTROLLER */}
        {activeTab === "stage" && (
          <div
            className={`grid grid-cols-1 ${
              stageMode === "sequential" ? "lg:grid-cols-3 gap-8" : "gap-8"
            }`}
          >
            <div
              className={`${
                stageMode === "sequential" ? "lg:col-span-2" : "w-full"
              } space-y-6`}
            >
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
                      <span>Live Stage Controller</span>
                    </h2>
                    <p className="text-xs text-slate-400">Select open sub-event & participant</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Mode Switcher Toggle */}
                    {!isCurrentVotingOpen && (
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setStageMode("sequential")}
                          className={`px-3 py-1 rounded-lg font-bold transition ${
                            stageMode === "sequential"
                              ? "bg-amber-500 text-slate-950"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Sequential (One by One)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStageMode("parallel")}
                          className={`px-3 py-1 rounded-lg font-bold transition ${
                            stageMode === "parallel"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Parallel (All at Once)
                        </button>
                      </div>
                    )}

                    {/* Stage Status Badge */}
                    <div
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center space-x-1.5 ${
                        isCurrentVotingOpen
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-slate-800 border-slate-700 text-slate-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isCurrentVotingOpen ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                        }`}
                      />
                      <span>{isCurrentVotingOpen ? "RATING OPEN" : "STANDBY"}</span>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                {stageSuccessMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{stageSuccessMsg}</span>
                  </div>
                )}

                {stageErrorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start space-x-2 animate-in fade-in">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{stageErrorMsg}</span>
                  </div>
                )}

                {/* SEQUENTIAL CONTESTANT MODE FORM */}
                {stageMode === "sequential" ? (
                  <form onSubmit={handleOpenSingleRating} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Open Sub-Event Dropdown */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Select Sub-Event {isCurrentVotingOpen ? (
                            <span className="text-amber-400 font-normal">(Rating Currently Open on Stage)</span>
                          ) : (
                            <span className="text-emerald-400 font-normal">(Only OPEN Sub-Events Shown)</span>
                          )}
                        </label>
                        <select
                          value={isCurrentVotingOpen && currentStage?.subEventId ? String(currentStage.subEventId) : selectedSubId}
                          onChange={(e) => setSelectedSubId(e.target.value)}
                          disabled={isCurrentVotingOpen}
                          className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none transition ${
                            isCurrentVotingOpen
                              ? "bg-slate-950/60 border-slate-800/60 text-slate-400 opacity-60 cursor-not-allowed"
                              : "bg-slate-950 border-slate-800 text-white focus:border-amber-500"
                          }`}
                        >
                          {isCurrentVotingOpen && currentStage?.subEventId && !openSubEvents.some((s) => s.id === String(currentStage.subEventId)) && (
                            <option value={String(currentStage.subEventId)}>
                              {currentStage.subEventName || `Sub-Event ${currentStage.subEventId}`} (Active)
                            </option>
                          )}
                          {openSubEvents.length === 0 && !isCurrentVotingOpen ? (
                            <option value="">No OPEN sub-events! Open one in Sub-Events Tab</option>
                          ) : (
                            openSubEvents.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Chest Number Selector Dropdown (from Roster) */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Chest Number (Roster Dropdown) {isCurrentVotingOpen ? (
                            <span className="text-amber-400 font-normal">(Currently Being Rated on Stage)</span>
                          ) : (
                            <span className="text-rose-400">*</span>
                          )}
                        </label>
                        {isCurrentVotingOpen && currentStage?.participantId && currentStage.participantId !== "PARALLEL" ? (
                          <select
                            value={String(currentStage.participantId)}
                            disabled={true}
                            className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-amber-400/60 font-mono font-bold text-sm opacity-60 cursor-not-allowed"
                          >
                            <option value={String(currentStage.participantId)}>
                              #{currentStage.participantId} — {currentStage.participantName || `Participant ${currentStage.participantId}`} (Live on Stage)
                            </option>
                          </select>
                        ) : availableRoster.length > 0 ? (
                          <select
                            value={chestNumber}
                            onChange={handleRosterSelect}
                            disabled={isCurrentVotingOpen}
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500 text-sm"
                          >
                            <option value="">Select pre-registered Chest Number...</option>
                            {availableRoster.map((p) => (
                              <option key={p.id} value={p.participantId}>
                                #{p.participantId} — {p.participantName}
                              </option>
                            ))}
                          </select>
                        ) : !selectedSubId ? (
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 text-xs font-medium flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>No sub-event selected. Please select an open sub-event above.</span>
                          </div>
                        ) : roster.length > 0 ? (
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            <span>All roster contestants have completed performance for this sub-event!</span>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 text-xs font-medium flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>No roster participants found. Add them in the &apos;Participants Roster&apos; tab!</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Single Stage Action Buttons */}
                    <div className="pt-2">
                      {!isCurrentVotingOpen ? (
                        <button
                          type="submit"
                          disabled={savingStage || !selectedSubId || !chestNumber.trim()}
                          className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {savingStage ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Flame className="w-5 h-5" />
                              <span>OPEN RATING FOR PARTICIPANT</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCloseAndResetStage}
                          disabled={savingStage}
                          className="w-full py-4 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-rose-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                        >
                          {savingStage ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="w-5 h-5" />
                              <span>CLOSE RATING & PREPARE NEXT PARTICIPANT</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  /* PARALLEL VOTING MODE FORM (All Contestants Together) */
                  <div className="space-y-4">

                    {/* Open Parallel Sub-Event Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        Select Parallel Sub-Event {isCurrentVotingOpen ? (
                          <span className="text-amber-400 font-normal">(Rating Currently Open on Stage)</span>
                        ) : (
                          <span className="text-indigo-400 font-normal">(Only OPEN Parallel Events Shown)</span>
                        )}
                      </label>
                      <select
                        value={isCurrentVotingOpen && currentStage?.subEventId ? String(currentStage.subEventId) : selectedSubId}
                        onChange={(e) => setSelectedSubId(e.target.value)}
                        disabled={isCurrentVotingOpen}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none transition ${
                          isCurrentVotingOpen
                            ? "bg-slate-950/60 border-slate-800/60 text-slate-400 opacity-60 cursor-not-allowed"
                            : "bg-slate-950 border-slate-800 text-white focus:border-indigo-500"
                        }`}
                      >
                        {isCurrentVotingOpen && currentStage?.subEventId && !openSubEvents.some((s) => s.id === String(currentStage.subEventId)) && (
                          <option value={String(currentStage.subEventId)}>
                            {currentStage.subEventName || `Sub-Event ${currentStage.subEventId}`} (Active)
                          </option>
                        )}
                        {openSubEvents.length === 0 && !isCurrentVotingOpen ? (
                          <option value="">No OPEN Parallel sub-events available! Create or open one in Sub-Events Tab</option>
                        ) : (
                          openSubEvents.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {!isCurrentVotingOpen ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                          <span>Select Roster Contestants for Group:</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedGroupChestIds.length === roster.length) {
                                setSelectedGroupChestIds([]);
                              } else {
                                setSelectedGroupChestIds(roster.map((r) => r.participantId));
                              }
                            }}
                            className="text-amber-400 hover:underline"
                          >
                            {selectedGroupChestIds.length === roster.length ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {availableRoster.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">
                              {!selectedSubId
                                ? "No sub-event selected. Please select an open sub-event above."
                                : roster.length > 0
                                ? "All roster contestants have completed performance for this sub-event!"
                                : "No roster participants found. Add them in the 'Participants Roster' tab!"}
                            </p>
                          ) : (
                            availableRoster.map((p) => {
                              const isChecked = selectedGroupChestIds.includes(p.participantId);

                              return (
                                <label
                                  key={p.id}
                                  className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                                    isChecked
                                      ? "bg-indigo-500/20 border-indigo-500/50 text-white font-bold"
                                      : "bg-slate-950 border-slate-800 text-slate-400"
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleGroupChest(p.participantId)}
                                      className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                                    />
                                    <span>#{p.participantId} — {p.participantName}</span>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleOpenGroupRating}
                          disabled={savingStage || selectedGroupChestIds.length === 0}
                          className="w-full py-4 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-indigo-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {savingStage ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Users className="w-5 h-5" />
                              <span>OPEN GROUP RATING ({selectedGroupChestIds.length} CONTESTANTS)</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Active Group Rating Control */
                      <button
                        type="button"
                        onClick={handleCloseAndResetStage}
                        disabled={savingStage}
                        className="w-full py-4 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-rose-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                      >
                        {savingStage ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-5 h-5" />
                            <span>CLOSE GROUP RATING & RESET STAGE</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Live Analytics Panel (Only relevant for Sequential individual contestant rating) */}
            {stageMode === "sequential" && (
              <div className="space-y-6">
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">Live Rating Tally</h3>
                        <p className="text-xs text-slate-400">
                          Chest #{activeRatingChest || "---"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center space-x-1 text-2xl font-black text-amber-400">
                        <span>{liveStats.average}</span>
                        <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">{liveStats.count} Total Ratings</p>
                    </div>
                  </div>

                  {/* Star Breakdown Progress Bars */}
                  <div className="space-y-2.5">
                    {[5, 4, 3, 2, 1].map((starKey) => {
                      const count = liveStats.distribution[starKey as 1 | 2 | 3 | 4 | 5] || 0;
                      const percentage = liveStats.count > 0 ? Math.round((count / liveStats.count) * 100) : 0;

                      return (
                        <div key={starKey} className="flex items-center space-x-3 text-xs">
                          <div className="flex items-center space-x-1 w-12 text-slate-300 font-semibold">
                            <span>{starKey}</span>
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          </div>

                          <div className="flex-1 h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <div className="w-16 text-right font-mono text-slate-400">
                            <span>{count}</span>
                            <span className="text-[10px] text-slate-600 ml-1">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PARTICIPANTS ROSTER MANAGEMENT */}
        {activeTab === "roster" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add Participant to Roster Form */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <span>Pre-Register Participant</span>
              </h3>

              {rosterSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{rosterSuccessMsg}</span>
                </div>
              )}

              {rosterErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start space-x-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{rosterErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleAddRosterParticipant} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Select Sub-Event
                  </label>
                  <select
                    value={selectedSubId}
                    onChange={(e) => setSelectedSubId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  >
                    {subEvents.filter((s) => s.status === "OPEN").length === 0 ? (
                      <option value="">No OPEN Sub-Events Available</option>
                    ) : (
                      subEvents
                        .filter((s) => s.status === "OPEN")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Chest Number / Participant ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={rosterChestNum}
                    onChange={(e) => setRosterChestNum(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Participant Name (Internal)
                  </label>
                  <input
                    type="text"
                    value={rosterName}
                    onChange={(e) => setRosterName(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingRoster}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Add to Roster
                </button>
              </form>
            </div>

            {/* Roster List for Sub-Event */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Sub-Event Contestant Roster</h3>
                  <p className="text-xs text-slate-400">Pre-populated participants for dropdown selection</p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {selectedSubId ? `${roster.length} contestants` : "0 contestants"}
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {!selectedSubId ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No sub-event selected. Please select an open sub-event to view or add participants.
                  </p>
                ) : roster.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No participants pre-registered for this sub-event yet. Add them using the form on the left!
                  </p>
                ) : (
                  roster.map((item) => {
                    const isCompleted = performedIds.includes(String(item.participantId));

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold">
                            #{item.participantId}
                          </span>
                          <span className="font-bold text-white text-sm">{item.participantName}</span>

                          {isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>COMPLETED</span>
                            </span>
                          ) : item.status === 1 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1">
                              <Radio className="w-3 h-3 animate-pulse" />
                              <span>LIVE ON STAGE</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                              PENDING
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {(isCompleted || item.status === 1 || item.status === 2) && (
                            <button
                              type="button"
                              onClick={async () => {
                                await resetParticipantToPending(selectedSubId, item.participantId);
                                setRosterSuccessMsg(`Reset Chest #${item.participantId} back to PENDING!`);
                              }}
                              className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition cursor-pointer flex items-center space-x-1 text-[11px] font-medium"
                              title="Reset to PENDING (Undo completion)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset to Pending</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setRosterParticipantToDelete(item);
                              setRosterDeleteTextConfirm("");
                              setRosterDeleteConfirmError(null);
                            }}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-rose-400 border border-slate-800 transition cursor-pointer"
                            title="Remove from Roster"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUB-EVENTS MANAGEMENT */}
        {activeTab === "subevents" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Sub-Event Form */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Add New Sub-Event</span>
              </h3>

              {newSubSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{newSubSuccess}</span>
                </div>
              )}

              {newSubError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start space-x-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{newSubError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSub} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Master Event
                  </label>
                  <select
                    value={selectedMasterId}
                    onChange={(e) => setSelectedMasterId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold text-xs focus:outline-none focus:border-amber-500"
                  >
                    {masterEvents.length === 0 ? (
                      <option value="">No Master Events (Create one first in Master Settings)</option>
                    ) : (
                      masterEvents.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Sub-Event Title / Category Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="e.g. Solo Dance Category A"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Voting Mode
                  </label>
                  <select
                    value={newSubVotingMode}
                    onChange={(e) => setNewSubVotingMode(e.target.value as "sequential" | "parallel")}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="sequential">Sequential Voting (One by One - Serial Stage)</option>
                    <option value="parallel">Parallel Voting (All at Once - Exhibition/Group)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={creatingSub}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Create Sub-Event
                </button>
              </form>
            </div>

            {/* List & Open/Close Sub-Events */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Sub-Events Manager</h3>
                  <p className="text-xs text-slate-400">Open or Close sub-events for voting</p>
                </div>
                <span className="text-xs font-mono text-slate-500">{subEvents.length} sub-events</span>
              </div>

              <div className="space-y-3">
                {subEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No sub-events created yet for this master event. Use the form on the left to add one!
                  </p>
                ) : (
                  subEvents.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{sub.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              sub.status === "OPEN"
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                            }`}
                          >
                            {sub.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-amber-300">
                            {sub.votingMode === "parallel" ? "Parallel Mode" : "Sequential Mode"}
                          </span>
                        </div>
                        <p className="text-slate-500 font-mono text-[11px]">ID: {sub.id}</p>
                      </div>

                      <div className="flex items-center space-x-3">
                        {(() => {
                          const isLiveOnStage =
                            isCurrentVotingOpen &&
                            String(currentStage?.subEventId) === String(sub.id);
                          const isCloseDisabled = sub.status === "OPEN" && isLiveOnStage;

                          return (
                            <div className="relative group">
                              <button
                                type="button"
                                onClick={() => handleToggleSubStatus(sub.id, sub.status)}
                                disabled={isCloseDisabled}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                                  isCloseDisabled
                                    ? "bg-slate-800 text-slate-500 border border-slate-700 opacity-60 cursor-not-allowed"
                                    : sub.status === "OPEN"
                                    ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                                }`}
                                title={
                                  isCloseDisabled
                                    ? "Active on Stage! Close rating on stage before closing this sub-event."
                                    : undefined
                                }
                              >
                                {sub.status === "OPEN" ? (
                                  <>
                                    <ToggleLeft className="w-4 h-4" />
                                    <span>
                                      {isCloseDisabled ? "Live on Stage" : "Close Sub-Event"}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <ToggleRight className="w-4 h-4" />
                                    <span>Re-Open Sub-Event</span>
                                  </>
                                )}
                              </button>
                              {isCloseDisabled && (
                                <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:block z-20 w-52 p-2 rounded-xl bg-slate-900 border border-rose-500/30 text-rose-300 text-[11px] font-semibold text-center shadow-2xl pointer-events-none">
                                  Live on Stage! Close rating & reset stage first before closing.
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() => {
                            setSubEventToDelete(sub);
                            setSubDeleteTextConfirm("");
                            setSubPassConfirm("");
                            setSubDeleteError(null);
                          }}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-rose-400 border border-slate-800 transition cursor-pointer"
                          title="Delete Sub-Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Sub-Event Verification Modal (Two-step: 'DELETE' + Password) */}
      {subEventToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Delete Sub-Event</h3>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">{subEventToDelete.name}</strong>? Complete both steps below:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Step 1: Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={subDeleteTextConfirm}
                  onChange={(e) => setSubDeleteTextConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Step 2: Enter Admin Password
                </label>
                <input
                  type="password"
                  value={subPassConfirm}
                  onChange={(e) => setSubPassConfirm(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {subDeleteError && (
              <p className="text-xs text-rose-400 font-medium">{subDeleteError}</p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubEventToDelete(null);
                  setSubDeleteError(null);
                  setSubDeleteTextConfirm("");
                  setSubPassConfirm("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteSubEvent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20"
              >
                Delete Sub-Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Roster Contestant Confirmation Modal */}
      {rosterParticipantToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Remove Contestant</h3>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to remove Chest <strong className="text-amber-400 font-mono">#{rosterParticipantToDelete.participantId} ({rosterParticipantToDelete.participantName})</strong> from the roster?
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={rosterDeleteTextConfirm}
                  onChange={(e) => setRosterDeleteTextConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            {rosterDeleteConfirmError && (
              <p className="text-xs text-rose-400 font-medium">{rosterDeleteConfirmError}</p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRosterParticipantToDelete(null);
                  setRosterDeleteConfirmError(null);
                  setRosterDeleteTextConfirm("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteRosterParticipant}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Delete Contestant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
