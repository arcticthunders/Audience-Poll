import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  CurrentStage,
  MasterEvent,
  SubEvent,
  SubEventParticipant,
  Vote,
  RatingStats,
  ParticipantAnalytics,
} from "./types";

import FingerprintJS, { hashComponents } from "@fingerprintjs/fingerprintjs";

// Cached fingerprint promise
let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null;

function getFpAgent() {
  if (typeof window === "undefined") return null;
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

// Get hardware/browser visitorId stabilized against viewport resizing / devtools device toggling
export async function getVoterFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const fpAgent = getFpAgent();
    if (fpAgent) {
      const fp = await fpAgent;
      const result = await fp.get();
      if (result && result.components) {
        // Exclude viewport, screen dimensions, and window frames so resizing devtools
        // or toggling device emulation dimensions does not produce a new signature.
        const { screenResolution, screenFrame, ...stableComponents } = result.components;
        const stableVisitorId = hashComponents(stableComponents);
        if (stableVisitorId) {
          localStorage.setItem("voter_uuid", stableVisitorId);
          return stableVisitorId;
        }
      }
      if (result && result.visitorId) {
        localStorage.setItem("voter_uuid", result.visitorId);
        return result.visitorId;
      }
    }
  } catch (err) {
    console.warn("FingerprintJS resolution notice, using fallback UUID:", err);
  }
  return getVoterUuid();
}

// Get or generate persistent unique voter UUID in localStorage (fallback / instant sync)
export function getVoterUuid(): string {
  if (typeof window === "undefined") return "";
  let uuid = localStorage.getItem("voter_uuid");
  if (!uuid) {
    uuid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `voter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("voter_uuid", uuid);
  }
  return uuid;
}

// 1. Real-time listener for current stage app_state/current_stage
export function subscribeToCurrentStage(
  callback: (stage: CurrentStage | null) => void
): Unsubscribe {
  try {
    const stageRef = doc(db, "app_state", "current_stage");
    return onSnapshot(
      stageRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as CurrentStage);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("Firestore permissions note (app_state):", error.message);
        callback(null);
      }
    );
  } catch (e) {
    console.warn("Failed to subscribe to current stage:", e);
    callback(null);
    return () => {};
  }
}

// 2. Real-time listener for Master Events
export function subscribeToMasterEvents(
  callback: (events: MasterEvent[]) => void
): Unsubscribe {
  try {
    const eventsRef = collection(db, "master_events");
    return onSnapshot(
      eventsRef,
      (snapshot) => {
        const events: MasterEvent[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as MasterEvent[];
        callback(events);
      },
      (error) => {
        console.warn("Firestore permissions note (master_events):", error.message);
        callback([]);
      }
    );
  } catch (e) {
    console.warn("Failed to subscribe to master events:", e);
    callback([]);
    return () => {};
  }
}

// 3. Real-time listener for Sub-Events belonging to a Master Event
export function subscribeToSubEvents(
  masterEventId: string,
  callback: (subEvents: SubEvent[]) => void
): Unsubscribe {
  if (!masterEventId) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(
      collection(db, "sub_events"),
      where("masterEventId", "==", masterEventId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const subs: SubEvent[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as SubEvent[];
        callback(subs);
      },
      (error) => {
        console.warn("Firestore permissions note (sub_events):", error.message);
        callback([]);
      }
    );
  } catch (e) {
    console.warn("Failed to subscribe to sub-events:", e);
    callback([]);
    return () => {};
  }
}

// 4. Real-time listener for Sub-Event Participants Roster
export function subscribeToSubEventParticipants(
  subEventId: string,
  callback: (participants: SubEventParticipant[]) => void
): Unsubscribe {
  if (!subEventId) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(
      collection(db, "sub_event_participants"),
      where("subEventId", "==", String(subEventId))
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: SubEventParticipant[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as SubEventParticipant[];
        callback(list);
      },
      (error) => {
        console.warn("Firestore permissions note (sub_event_participants):", error.message);
        callback([]);
      }
    );
  } catch (e) {
    console.warn("Failed to subscribe to sub-event participants:", e);
    callback([]);
    return () => {};
  }
}

// 5. Add Participant to Sub-Event Roster (status 0: NOT STARTED)
export async function addSubEventParticipant(
  masterEventId: string,
  subEventId: string,
  participantId: string,
  participantName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPid = participantId.trim();
    const docId = `${subEventId}_${formattedPid}`;
    const docRef = doc(db, "sub_event_participants", docId);

    // Uniqueness check per (masterEventId, subEventId, participantId)
    const existingSnap = await getDocs(
      query(
        collection(db, "sub_event_participants"),
        where("subEventId", "==", String(subEventId)),
        where("participantId", "==", formattedPid)
      )
    );

    if (!existingSnap.empty) {
      return {
        success: false,
        error: `Chest #${formattedPid} is already added to this Sub-Event!`,
      };
    }

    await setDoc(docRef, {
      masterEventId: String(masterEventId),
      subEventId: String(subEventId),
      participantId: formattedPid,
      participantName: participantName.trim() || `Participant ${formattedPid}`,
      status: 0, // 0 = NOT STARTED
      createdAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("Error adding sub-event participant:", err);
    return {
      success: false,
      error: err?.message || "Missing or insufficient permissions for sub_event_participants collection.",
    };
  }
}

// 5b. Update Participant Status (0 = NOT STARTED, 1 = LIVE ON STAGE, 2 = COMPLETED)
export async function updateParticipantStatus(
  subEventId: string | number,
  participantId: string | number,
  status: 0 | 1 | 2
): Promise<void> {
  if (!subEventId || !participantId) return;
  try {
    const docId = `${subEventId}_${participantId}`;
    const docRef = doc(db, "sub_event_participants", docId);
    await updateDoc(docRef, { status });
  } catch (err) {
    console.warn("Could not update participant status:", err);
  }
}

// 5c. Reset Participant Status to 0 (NOT STARTED / PENDING) and remove from performed list
export async function resetParticipantToPending(
  subEventId: string | number,
  participantId: string | number
): Promise<void> {
  if (!subEventId || !participantId) return;
  try {
    const subIdStr = String(subEventId);
    const pIdStr = String(participantId);
    const participantDocRef = doc(db, "sub_event_participants", `${subIdStr}_${pIdStr}`);
    await updateDoc(participantDocRef, { status: 0 });

    const perfDocRef = doc(db, "performed_participants", `${subIdStr}_${pIdStr}`);
    await deleteDoc(perfDocRef);
  } catch (err) {
    console.warn("Could not reset participant to pending:", err);
  }
}

// 6. Delete Participant from Sub-Event Roster
export async function deleteSubEventParticipant(docId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "sub_event_participants", docId));
  } catch (err) {
    console.error("Error deleting sub-event participant:", err);
  }
}

// 7. Create new Sub-Event (Auto-generates unique ID and enforces unique Title per Master Event)
export async function createSubEvent(
  subEvent: Omit<SubEvent, "createdAt" | "id"> & { id?: string }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const masterId = String(subEvent.masterEventId);
    const title = subEvent.name.trim();

    // Check title uniqueness under the same Master Event
    const duplicateQuery = query(
      collection(db, "sub_events"),
      where("masterEventId", "==", masterId),
      where("name", "==", title)
    );
    const dupSnap = await getDocs(duplicateQuery);
    if (!dupSnap.empty) {
      return {
        success: false,
        error: `A Sub-Event named '${title}' already exists under this Master Event.`,
      };
    }

    // Auto-generate unique ID if not explicitly passed
    const generatedId =
      subEvent.id ||
      `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const docRef = doc(db, "sub_events", generatedId);
    await setDoc(docRef, {
      masterEventId: masterId,
      name: title,
      status: subEvent.status || "OPEN",
      votingMode: subEvent.votingMode || "sequential",
      createdAt: serverTimestamp(),
    });

    return { success: true, id: generatedId };
  } catch (err: any) {
    console.error("Error creating sub-event:", err);
    return { success: false, error: err?.message || "Failed to create sub-event." };
  }
}

// 8. Toggle Sub-Event Status (OPEN / CLOSED)
export async function toggleSubEventStatus(
  subEventId: string,
  status: "OPEN" | "CLOSED"
): Promise<void> {
  try {
    const docRef = doc(db, "sub_events", String(subEventId));
    await updateDoc(docRef, { status });
  } catch (err) {
    console.error("Error toggling sub-event status:", err);
  }
}

// 9. Cascading Delete Sub-Event (Deletes Sub-Event + Roster + Performed Logs + Votes)
export async function deleteSubEvent(subEventId: string): Promise<void> {
  try {
    const subIdStr = String(subEventId);

    // 1. Delete Roster Members
    const rosterSnap = await getDocs(
      query(collection(db, "sub_event_participants"), where("subEventId", "==", subIdStr))
    );
    rosterSnap.docs.forEach(async (d) => await deleteDoc(d.ref));

    // 2. Delete Performed Logs
    const perfSnap = await getDocs(
      query(collection(db, "performed_participants"), where("subEventId", "==", subIdStr))
    );
    perfSnap.docs.forEach(async (d) => await deleteDoc(d.ref));

    // 3. Delete Votes
    const votesSnap = await getDocs(
      query(collection(db, "votes"), where("subEventId", "==", subIdStr))
    );
    votesSnap.docs.forEach(async (d) => await deleteDoc(d.ref));

    // 4. Delete Sub-Event Document
    const docRef = doc(db, "sub_events", subIdStr);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting sub-event:", err);
  }
}

// 10. Update current stage in Firestore
export async function updateCurrentStage(stageData: Omit<CurrentStage, "updatedAt">): Promise<void> {
  try {
    const stageRef = doc(db, "app_state", "current_stage");
    await setDoc(stageRef, {
      ...stageData,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error updating current stage:", err);
  }
}

// 11. Reset stage to standby (holding screen)
export async function resetCurrentStage(
  masterEventId: string | number,
  subEventId: string | number
): Promise<void> {
  try {
    const stageRef = doc(db, "app_state", "current_stage");
    await setDoc(stageRef, {
      masterEventId: String(masterEventId),
      subEventId: String(subEventId),
      participantId: "",
      participantName: "",
      isVotingOpen: false,
      showResults: false,
      isGroupMode: false,
      groupParticipants: [],
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error resetting stage:", err);
  }
}

// 12. Check if participant has performed in sub-event
export async function hasParticipantPerformed(
  subEventId: string | number,
  participantId: string | number
): Promise<boolean> {
  if (!subEventId || !participantId) return false;
  try {
    const snap = await getDocs(
      query(
        collection(db, "performed_participants"),
        where("subEventId", "==", String(subEventId)),
        where("participantId", "==", String(participantId))
      )
    );
    return !snap.empty;
  } catch (err) {
    console.warn("Error/permission check for performed participant:", err);
    return false;
  }
}

// 13. Record performed participant with name
export async function recordParticipantPerformed(
  masterEventId: string | number,
  subEventId: string | number,
  participantId: string | number,
  participantName: string
): Promise<void> {
  if (!subEventId || !participantId) return;
  try {
    const docId = `${subEventId}_${participantId}`;
    await setDoc(doc(db, "performed_participants", docId), {
      masterEventId: String(masterEventId),
      subEventId: String(subEventId),
      participantId: String(participantId),
      participantName: participantName.trim() || `Participant ${participantId}`,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error recording performed participant:", err);
  }
}

// 13b. Subscribe to performed participant IDs for a sub-event
export function subscribeToPerformedParticipants(
  subEventId: string | number,
  callback: (performedIds: string[]) => void
): Unsubscribe {
  if (!subEventId) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(
      collection(db, "performed_participants"),
      where("subEventId", "==", String(subEventId))
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const pids: string[] = snapshot.docs.map((docSnap) => String(docSnap.data().participantId));
        callback(pids);
      },
      (error) => {
        console.warn("Firestore permissions note (performed_participants):", error.message);
        callback([]);
      }
    );
  } catch (e) {
    console.warn("Failed to subscribe to performed participants:", e);
    callback([]);
    return () => {};
  }
}

// 14. Create Master Event
export async function createMasterEvent(event: Omit<MasterEvent, "createdAt">): Promise<void> {
  try {
    const docRef = doc(db, "master_events", String(event.id));
    await setDoc(docRef, {
      name: event.name,
      description: event.description || "",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error creating master event:", err);
  }
}

// 15. Cascading Delete Master Event (Deletes Master Event + Sub-Events + Roster + Performed Logs + Votes)
export async function deleteMasterEvent(eventId: string): Promise<void> {
  try {
    const masterIdStr = String(eventId);

    // 1. Delete all Sub-Events under this Master Event (and their children)
    const subsSnap = await getDocs(
      query(collection(db, "sub_events"), where("masterEventId", "==", masterIdStr))
    );
    for (const d of subsSnap.docs) {
      await deleteSubEvent(d.id);
    }

    // 2. Cleanup any orphaned Roster Members
    const rosterSnap = await getDocs(
      query(collection(db, "sub_event_participants"), where("masterEventId", "==", masterIdStr))
    );
    rosterSnap.docs.forEach(async (d) => await deleteDoc(d.ref));

    // 3. Cleanup any orphaned Performed Logs
    const perfSnap = await getDocs(
      query(collection(db, "performed_participants"), where("masterEventId", "==", masterIdStr))
    );
    perfSnap.docs.forEach(async (d) => await deleteDoc(d.ref));

    // 4. Cleanup any orphaned Votes
    const votesSnap = await getDocs(
      query(collection(db, "votes"), where("masterEventId", "==", masterIdStr))
    );
    votesSnap.docs.forEach(async (d) => await deleteDoc(d.ref));

    // 5. Delete Master Event Document
    const docRef = doc(db, "master_events", masterIdStr);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting master event:", err);
  }
}

// 16. Get user's vote for a SPECIFIC PARTICIPANT in a subEventId
export async function getUserVoteInEvent(
  subEventId: string | number,
  participantId: string | number,
  voterUuid: string
): Promise<Vote | null> {
  if (!subEventId || !participantId || !voterUuid) return null;
  try {
    const subIdStr = String(subEventId);
    const pIdStr = String(participantId);
    const voteDocId = `${subIdStr}_${pIdStr}_${voterUuid}`;
    const voteSnap = await getDoc(doc(db, "votes", voteDocId));
    if (voteSnap.exists()) {
      return { id: voteSnap.id, ...voteSnap.data() } as Vote;
    }

    // Fallback query in case of legacy document IDs
    const q = query(
      collection(db, "votes"),
      where("subEventId", "==", subIdStr),
      where("participantId", "==", pIdStr),
      where("voterUuid", "==", voterUuid)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Vote;
    }
    return null;
  } catch (err) {
    console.warn("Error fetching vote status:", err);
    return null;
  }
}

// 16b. Real-time listener for user's vote on a specific participant
export function subscribeToUserVote(
  subEventId: string | number,
  participantId: string | number,
  voterUuid: string,
  callback: (vote: Vote | null) => void
): Unsubscribe {
  if (!subEventId || !participantId || !voterUuid) {
    callback(null);
    return () => {};
  }

  const subIdStr = String(subEventId);
  const pIdStr = String(participantId);
  const voteDocId = `${subIdStr}_${pIdStr}_${voterUuid}`;
  const voteDocRef = doc(db, "votes", voteDocId);

  return onSnapshot(
    voteDocRef,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as Vote);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("Error listening to user vote:", err);
      callback(null);
    }
  );
}

// 17. Get ALL votes cast by voterUuid in a subEventId (returns map of { [participantId]: rating })
export async function getUserVotesForSubEvent(
  subEventId: string | number,
  voterUuid: string
): Promise<Record<string, number>> {
  if (!subEventId || !voterUuid) return {};
  try {
    const q = query(
      collection(db, "votes"),
      where("subEventId", "==", String(subEventId)),
      where("voterUuid", "==", voterUuid)
    );
    const snap = await getDocs(q);
    const resultMap: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      resultMap[String(data.participantId)] = Number(data.rating) || 5;
    });
    return resultMap;
  } catch (e) {
    console.warn("Error fetching user sub-event votes:", e);
    return {};
  }
}

// 17b. Real-time listener for all votes cast by voterUuid in a subEventId
export function subscribeToUserVotesForSubEvent(
  subEventId: string | number,
  voterUuid: string,
  callback: (votesMap: Record<string, number>) => void
): Unsubscribe {
  if (!subEventId || !voterUuid) {
    callback({});
    return () => {};
  }

  const q = query(
    collection(db, "votes"),
    where("subEventId", "==", String(subEventId)),
    where("voterUuid", "==", voterUuid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const resultMap: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        resultMap[String(data.participantId)] = Number(data.rating) || 5;
      });
      callback(resultMap);
    },
    (err) => {
      console.warn("Error listening to user sub-event votes:", err);
      callback({});
    }
  );
}

// 18. Cast a rating vote for a SPECIFIC PARTICIPANT (Deterministic doc ID for idempotency)
export async function castVote(
  subEventId: string | number,
  participantId: string | number,
  voterUuid: string,
  rating: number,
  masterEventId?: string | number
): Promise<{ success: boolean; message?: string }> {
  if (!subEventId || !participantId || !voterUuid || !rating || rating < 1 || rating > 5) {
    return { success: false, message: "Please select a valid rating from 1 to 5 stars." };
  }

  const subIdStr = String(subEventId);
  const pIdStr = String(participantId);
  const voteDocId = `${subIdStr}_${pIdStr}_${voterUuid}`;
  const voteDocRef = doc(db, "votes", voteDocId);

  try {
    // Check if vote already exists directly by deterministic document ID
    const existingSnap = await getDoc(voteDocRef);
    if (existingSnap.exists()) {
      return { success: false, message: "You have already rated this participant!" };
    }

    await setDoc(voteDocRef, {
      masterEventId: String(masterEventId || ""),
      subEventId: subIdStr,
      participantId: pIdStr,
      voterUuid: voterUuid,
      rating: Number(rating),
      timestamp: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to record rating:", error);
    return { success: false, message: error.message || "Failed to submit rating." };
  }
}

// 19. Real-time statistics of ratings for subEventId + participantId
export function subscribeToLiveRatings(
  subEventId: string | number,
  participantId: string | number,
  callback: (stats: RatingStats) => void
): Unsubscribe {
  const defaultStats: RatingStats = {
    count: 0,
    average: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  if (!subEventId || !participantId) {
    callback(defaultStats);
    return () => {};
  }

  try {
    const q = query(
      collection(db, "votes"),
      where("subEventId", "==", String(subEventId)),
      where("participantId", "==", String(participantId))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const count = snapshot.size;
        if (count === 0) {
          callback(defaultStats);
          return;
        }

        let totalRating = 0;
        const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const r = Number(data.rating) || 5;
          totalRating += r;
          if (r >= 1 && r <= 5) {
            dist[r as 1 | 2 | 3 | 4 | 5] += 1;
          }
        });

        const average = Number((totalRating / count).toFixed(1));

        callback({
          count,
          average,
          distribution: dist,
        });
      },
      (error) => {
        console.warn("Firestore permissions note (live ratings):", error.message);
        callback(defaultStats);
      }
    );
  } catch (e) {
    console.warn("Failed to subscribe to live ratings:", e);
    callback(defaultStats);
    return () => {};
  }
}

// 20. Real-time listener for ALL participants in a sub-event (for Judges Score Sheets)
export function subscribeToSubEventAnalytics(
  subEventId: string | number,
  callback: (analyticsList: ParticipantAnalytics[]) => void
): Unsubscribe {
  if (!subEventId) {
    callback([]);
    return () => {};
  }

  try {
    let performedMap: Record<string, string> = {};
    let latestVotesDocs: any[] = [];

    const computeAndEmit = () => {
      const participantStatsMap: Record<string, ParticipantAnalytics> = {};

      // 1. Initialize with all performed participants to ensure name resolution
      Object.keys(performedMap).forEach((pid) => {
        participantStatsMap[pid] = {
          participantId: pid,
          participantName: performedMap[pid],
          totalVotes: 0,
          totalWeightedScore: 0,
          averageScore: 0,
          starDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
      });

      // 2. Aggregate votes
      latestVotesDocs.forEach((docSnap) => {
        const data = docSnap.data();
        const pid = String(data.participantId);
        const rating = Number(data.rating) || 5;

        if (!participantStatsMap[pid]) {
          participantStatsMap[pid] = {
            participantId: pid,
            participantName: performedMap[pid] || `Participant ${pid}`,
            totalVotes: 0,
            totalWeightedScore: 0,
            averageScore: 0,
            starDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          };
        }

        const item = participantStatsMap[pid];
        item.totalVotes += 1;
        item.totalWeightedScore += rating;
        if (rating >= 1 && rating <= 5) {
          item.starDistribution[rating as 1 | 2 | 3 | 4 | 5] += 1;
        }
      });

      // 3. Calculate averages
      const result: ParticipantAnalytics[] = Object.values(participantStatsMap).map((item) => ({
        ...item,
        averageScore: item.totalVotes > 0 ? Number((item.totalWeightedScore / item.totalVotes).toFixed(1)) : 0,
      }));

      callback(result);
    };

    // Real-time listener for performed_participants in this subEvent
    const qPerf = query(
      collection(db, "performed_participants"),
      where("subEventId", "==", String(subEventId))
    );

    const unsubPerf = onSnapshot(
      qPerf,
      (snapshot) => {
        performedMap = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const pid = String(data.participantId);
          performedMap[pid] = data.participantName || `Participant ${pid}`;
        });
        computeAndEmit();
      },
      (err) => console.warn("Performed participants subscription note:", err)
    );

    // Real-time listener for votes in this subEvent
    const qVotes = query(
      collection(db, "votes"),
      where("subEventId", "==", String(subEventId))
    );

    const unsubVotes = onSnapshot(
      qVotes,
      (snapshot) => {
        latestVotesDocs = snapshot.docs;
        computeAndEmit();
      },
      (err) => console.warn("Votes subscription note:", err)
    );

    return () => {
      unsubPerf();
      unsubVotes();
    };
  } catch (e) {
    console.warn("Failed to subscribe to sub-event analytics:", e);
    callback([]);
    return () => {};
  }
}
