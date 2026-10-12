"use client";

import { useEffect, useState } from "react";
import {
  subscribeToCurrentStage,
  subscribeToUserVote,
  subscribeToUserVotesForSubEvent,
  castVote,
  getVoterUuid,
  getVoterFingerprint,
} from "@/lib/votingService";
import { CurrentStage, Vote } from "@/lib/types";
import { Sparkles, CheckCircle2, Clock, Award, AlertCircle, Loader2, Star, Users } from "lucide-react";

export default function AudiencePage() {
  const [stage, setStage] = useState<CurrentStage | null>(null);
  const [loadingStage, setLoadingStage] = useState<boolean>(true);
  const [voterUuid, setVoterUuid] = useState<string>("");

  // Single Contestant Mode State
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Group Mode State: { [participantId]: rating }
  const [groupUserVotes, setGroupUserVotes] = useState<Record<string, number>>({});
  const [groupSelectedRatings, setGroupSelectedRatings] = useState<Record<string, number>>({});
  const [groupHoverRatings, setGroupHoverRatings] = useState<Record<string, number | null>>({});
  const [groupSubmittingId, setGroupSubmittingId] = useState<string | null>(null);
  const [groupVoteErrors, setGroupVoteErrors] = useState<Record<string, string>>({});

  const ratingLabels: Record<number, string> = {
    1: "Needs Improvement",
    2: "Fair",
    3: "Good Performance",
    4: "Great Performance!",
    5: "Outstanding! 🌟",
  };

  // Initialize Voter ID on client with FingerprintJS (hardware/device fingerprint)
  useEffect(() => {
    let isCancelled = false;

    // Fast-path: Check cached localStorage first
    const cachedUuid = typeof window !== "undefined" ? localStorage.getItem("voter_uuid") : "";
    if (cachedUuid) {
      setVoterUuid(cachedUuid);
    }

    // Resolve hardware fingerprint (survives Incognito mode & private browsing)
    getVoterFingerprint().then((fpId) => {
      if (!isCancelled && fpId) {
        setVoterUuid(fpId);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Subscribe to real-time current_stage updates
  useEffect(() => {
    const unsubscribe = subscribeToCurrentStage((stageData) => {
      setStage(stageData);
      setLoadingStage(false);
    });

    return () => unsubscribe();
  }, []);

  // Single Mode: Real-time listener for active participant vote status
  useEffect(() => {
    if (stage?.isGroupMode) return;

    const targetSubId = stage?.subEventId;
    const targetParticipantId = stage?.participantId;
    if (!targetSubId || !targetParticipantId || !voterUuid) {
      setUserVote(null);
      return;
    }

    setSelectedRating(null);
    setHoverRating(null);

    const unsubscribe = subscribeToUserVote(
      targetSubId,
      targetParticipantId,
      voterUuid,
      (vote) => {
        setUserVote(vote);
      }
    );

    return () => unsubscribe();
  }, [stage?.subEventId, stage?.participantId, stage?.isGroupMode, voterUuid]);

  // Group Mode: Real-time listener for all votes cast by user in active sub-event
  useEffect(() => {
    if (!stage?.isGroupMode || !stage?.subEventId || !voterUuid) return;

    const unsubscribe = subscribeToUserVotesForSubEvent(
      stage.subEventId,
      voterUuid,
      (votesMap) => {
        setGroupUserVotes(votesMap);
      }
    );

    return () => unsubscribe();
  }, [stage?.subEventId, stage?.isGroupMode, voterUuid]);

  // Single Rating Submit
  const handleRatingSubmit = async () => {
    const targetSubId = stage?.subEventId;
    const targetParticipantId = stage?.participantId;
    if (
      !targetSubId ||
      !targetParticipantId ||
      !voterUuid ||
      selectedRating === null ||
      isSubmitting ||
      userVote
    ) {
      return;
    }

    setIsSubmitting(true);
    setVoteError(null);

    const res = await castVote(
      targetSubId,
      targetParticipantId,
      voterUuid,
      selectedRating,
      stage.masterEventId
    );

    if (res.success) {
      setUserVote({
        subEventId: targetSubId,
        participantId: targetParticipantId,
        voterUuid,
        rating: selectedRating,
      });
    } else {
      setVoteError(res.message || "Could not submit rating. Please try again.");
    }

    setIsSubmitting(false);
  };

  // Group Mode Individual Chest Rating Submit
  const handleGroupRatingSubmit = async (chestId: string) => {
    const targetSubId = stage?.subEventId;
    const ratingVal = groupSelectedRatings[chestId];

    if (!targetSubId || !chestId || !voterUuid || !ratingVal || groupSubmittingId === chestId) {
      return;
    }

    setGroupSubmittingId(chestId);
    setGroupVoteErrors((prev) => ({ ...prev, [chestId]: "" }));

    const res = await castVote(
      targetSubId,
      chestId,
      voterUuid,
      ratingVal,
      stage.masterEventId
    );

    if (res.success) {
      setGroupUserVotes((prev) => ({ ...prev, [chestId]: ratingVal }));
    } else {
      setGroupVoteErrors((prev) => ({
        ...prev,
        [chestId]: res.message || "Could not submit rating.",
      }));
    }

    setGroupSubmittingId(null);
  };

  const activeStarCount = hoverRating !== null ? hoverRating : (selectedRating || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Background Glow */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-3 px-4 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">Live Stage Rating</h1>
            <p className="text-[11px] text-slate-400 font-medium">Audience Portal</p>
          </div>
        </div>

        {/* Live Badge */}
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="uppercase tracking-wider text-[10px]">Live Sync</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md mx-auto my-auto py-6 flex flex-col items-center justify-center">
        {loadingStage ? (
          /* Loading State */
          <div className="w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-slate-800 animate-pulse mx-auto flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
            <div className="h-4 bg-slate-800 rounded-md w-3/4 mx-auto animate-pulse"></div>
            <div className="h-3 bg-slate-800/60 rounded-md w-1/2 mx-auto animate-pulse"></div>
          </div>
        ) : !stage || !stage.isVotingOpen ? (
          /* Holding Screen State */
          <div className="w-full p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-center space-y-6 shadow-2xl transition-all duration-300">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shadow-inner">
              <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
                Stage Standing By
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Waiting for Next Participant
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                Waiting for the next participant to take the stage...
              </p>
            </div>
          </div>
        ) : stage.isGroupMode && stage.groupParticipants && stage.groupParticipants.length > 0 ? (
          /* GROUP ACTIVITY RATING MODE (X Chest Numbers Together) */
          <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
            {/* Header Badge */}
            <div className="text-center space-y-2 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/10 p-4 rounded-3xl border border-amber-500/30 backdrop-blur-md">
              {/* Event Name Badge */}
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold uppercase tracking-widest">
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{stage.subEventName || `Sub-Event #${stage.subEventId}`}</span>
                </span>
              </div>

              <div>
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Group Activity Mode ({stage.groupParticipants.length} Contestants)</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium pt-0.5">
                Rate each chest number individually below
              </p>
            </div>

            {/* List of Group Chest Cards */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {stage.groupParticipants.map((item) => {
                const chestId = String(item.participantId);
                const recordedRating = groupUserVotes[chestId];
                const activeGroupSelect = groupSelectedRatings[chestId] || null;
                const activeGroupHover = groupHoverRatings[chestId] || null;
                const activeStarGroup = activeGroupHover !== null ? activeGroupHover : (activeGroupSelect || 0);

                return (
                  <div
                    key={chestId}
                    className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl space-y-4 text-center"
                  >
                    {/* Chest Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-[10px] uppercase font-mono font-bold text-amber-400 tracking-wider">
                        Contestant
                      </span>
                      <span className="text-2xl font-black text-white">#{chestId}</span>
                    </div>

                    {recordedRating !== undefined ? (
                      /* Chest Already Rated & Locked */
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-bold text-emerald-300">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Rating Recorded</span>
                        </div>
                        <div className="flex items-center space-x-1 text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                          <span>{recordedRating}</span>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </div>
                      </div>
                    ) : (
                      /* Interactive 5-Star Picker for Chest */
                      <div className="space-y-3">
                        <div className="flex justify-center items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setGroupSelectedRatings((prev) => ({ ...prev, [chestId]: star }))
                              }
                              onMouseEnter={() =>
                                setGroupHoverRatings((prev) => ({ ...prev, [chestId]: star }))
                              }
                              onMouseLeave={() =>
                                setGroupHoverRatings((prev) => ({ ...prev, [chestId]: null }))
                              }
                              className="p-1 focus:outline-none transition-transform active:scale-125 cursor-pointer"
                            >
                              <Star
                                className={`w-8 h-8 transition-all duration-150 ${
                                  star <= activeStarGroup
                                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] scale-110"
                                    : "text-slate-700 hover:text-slate-500"
                                }`}
                              />
                            </button>
                          ))}
                        </div>

                        {groupVoteErrors[chestId] && (
                          <p className="text-xs text-rose-400 font-medium">{groupVoteErrors[chestId]}</p>
                        )}

                        <button
                          type="button"
                          onClick={() => handleGroupRatingSubmit(chestId)}
                          disabled={!activeGroupSelect || groupSubmittingId === chestId}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center space-x-2"
                        >
                          {groupSubmittingId === chestId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <span>SUBMIT RATING FOR CHEST #{chestId}</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* SINGLE CONTESTANT RATING MODE */
          <div className="w-full p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/70 border border-amber-500/30 backdrop-blur-xl shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Category Name Badge */}
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{stage.subEventName || `Sub-Event #${stage.subEventId}`}</span>
            </div>

            {/* BIG BOLD CHEST NUMBER DISPLAY */}
            <div className="py-2 px-4 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-amber-400/90 tracking-widest block">
                Current Contestant
              </span>
              <div className="text-6xl sm:text-7xl font-black text-white tracking-tight leading-none drop-shadow-[0_0_25px_rgba(251,191,36,0.3)]">
                #{stage.participantId}
              </div>
            </div>

            {/* Rating Action Area */}
            <div className="pt-2">
              {userVote ? (
                /* Already Rated Confirmation */
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-emerald-300">Rating Recorded!</h3>
                    <p className="text-xs text-emerald-400/90 font-medium">
                      You have submitted your rating for Chest #{stage.participantId}!
                    </p>
                  </div>

                  <div className="flex justify-center items-center space-x-1 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${
                          star <= (userVote.rating || 5)
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="inline-block text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    {userVote.rating} / 5 Stars
                  </span>
                </div>
              ) : (
                /* Interactive 5-Star Picker */
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Tap Stars to Rate Performance
                    </p>

                    <div className="flex justify-center items-center space-x-2 py-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1.5 focus:outline-none transition-transform active:scale-125 cursor-pointer"
                        >
                          <Star
                            className={`w-10 h-10 transition-all duration-150 ${
                              star <= activeStarCount
                                ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-110"
                                : "text-slate-700 hover:text-slate-500"
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="h-6">
                      {activeStarCount > 0 ? (
                        <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                          {ratingLabels[activeStarCount] || ""}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 italic">
                          Select 1 to 5 stars above
                        </span>
                      )}
                    </div>
                  </div>

                  {voteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-center space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{voteError}</span>
                    </div>
                  )}

                  {/* Submit Rating Button */}
                  <button
                    onClick={handleRatingSubmit}
                    disabled={selectedRating === null || isSubmitting}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200 text-white font-extrabold text-lg shadow-xl shadow-amber-500/20 border border-white/20 flex items-center justify-center space-x-3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                        <span>SUBMITTING RATING...</span>
                      </>
                    ) : (
                      <>
                        <Star className="w-5 h-5 fill-white text-white" />
                        <span>SUBMIT RATING</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-400 font-medium">
                    1 rating per participant per device
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-3 text-[11px] text-slate-500 border-t border-slate-900">
        <p>Audience Live Rating • Powered by Firebase Firestore</p>
      </footer>
    </div>
  );
}
