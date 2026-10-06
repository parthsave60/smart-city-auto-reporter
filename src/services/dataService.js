/**
 * Data Service - Firestore Integration & Offline Resilience
 * 
 * Handles reading and writing reports, status updates, and user profiles.
 * Gracefully integrates with Cloud Firestore while maintaining local persistence
 * with strict timeout handling so operations never hang in any environment.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

const LOCAL_STORAGE_KEY = 'smart_city_reports_cache';
const LOCAL_PROFILES_KEY = 'smart_city_user_profiles';

/**
 * Universal promise timeout helper to prevent hanging on Firestore network/billing stream issues
 */
function withTimeout(promise, ms = 2500, timeoutMessage = 'Operation timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([
    promise.then(res => {
      clearTimeout(timer);
      return res;
    }).catch(err => {
      clearTimeout(timer);
      throw err;
    }),
    timeoutPromise
  ]);
}

/**
 * Helper to get cached local reports
 */
function getLocalReports() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Helper to persist local reports
 */
function saveLocalReports(reports) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.warn('[DataService] LocalStorage save error:', err);
  }
}

/**
 * Save an issue report to Firestore with local fallback
 * @param {Object} issueData - Complete issue report metadata
 * @returns {Promise<string>} - Saved issue ID
 */
export async function saveIssueReport(issueData) {
  // Generate consistent Firestore doc reference upfront so ID matches across local and remote
  const issueDocRef = doc(collection(db, 'issues'));
  const reportId = issueDocRef.id;
  const nowIso = new Date().toISOString();

  const formattedIssue = {
    ...issueData,
    id: reportId,
    status: issueData.status || 'Submitted',
    createdAt: nowIso,
    statusHistory: issueData.statusHistory || [
      {
        status: issueData.status || 'Submitted',
        timestamp: nowIso,
        updatedBy: issueData.reporterName || 'Citizen',
        notes: 'Initial civic report submitted'
      }
    ]
  };

  // 1. Immediately cache locally with the exact authoritative ID
  const currentLocal = getLocalReports();
  const filteredLocal = currentLocal.filter(item => item.id !== reportId);
  saveLocalReports([formattedIssue, ...filteredLocal]);

  // 2. Attempt Firestore remote write with a resilient timeout using the exact same doc reference
  try {
    await withTimeout(
      setDoc(issueDocRef, {
        ...issueData,
        id: reportId,
        status: issueData.status || 'Submitted',
        statusHistory: formattedIssue.statusHistory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }),
      4000,
      'Firestore write timeout (resilient local mode activated)'
    );

    console.log('[DataService] Firestore report saved with ID:', reportId);
    return reportId;
  } catch (firestoreError) {
    console.warn('[DataService] Remote write fallback active:', firestoreError.message);
    return reportId;
  }
}

/**
 * Delete an issue report from both local cache and Firestore
 * @param {string} issueId - Document ID
 * @param {string} [imageUrl] - Optional image URL to catch legacy duplicate documents
 * @returns {Promise<boolean>}
 */
export async function deleteIssueReport(issueId, imageUrl = null) {
  if (!issueId) return false;

  // 1. Immediately remove from local storage cache
  try {
    const currentLocal = getLocalReports();
    const filtered = currentLocal.filter(item => {
      if (item.id === issueId) return false;
      if (imageUrl && item.imageUrl === imageUrl) return false;
      return true;
    });
    saveLocalReports(filtered);
    console.log('[DataService] Report removed from local cache:', issueId);
  } catch (err) {
    console.warn('[DataService] Local cache deletion warning:', err);
  }

  // 2. Remove from Firestore with a resilient timeout
  try {
    const issueRef = doc(db, 'issues', issueId);
    await withTimeout(deleteDoc(issueRef), 4000, 'Firestore deleteDoc timeout');
    console.log('[DataService] Report deleted from Firestore:', issueId);
  } catch (err) {
    console.warn('[DataService] Firestore primary delete notice:', err.message);
  }

  // 3. If an imageUrl was provided, clean up any legacy duplicates in Firestore
  if (imageUrl) {
    try {
      const q = query(collection(db, 'issues'), where('imageUrl', '==', imageUrl));
      const snap = await withTimeout(getDocs(q), 3000, 'Firestore secondary cleanup timeout');
      for (const d of snap.docs) {
        if (d.id !== issueId) {
          try {
            await deleteDoc(d.ref);
            console.log('[DataService] Legacy duplicate doc deleted from Firestore:', d.id);
          } catch {}
        }
      }
    } catch (cleanErr) {
      console.warn('[DataService] Legacy duplicate cleanup notice:', cleanErr.message);
    }
  }

  return true;
}

/**
 * Fetch all reports (For Authority)
 * @returns {Promise<Array>}
 */
export async function fetchAllReports() {
  let firestoreIssues = [];
  try {
    const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    const snapshot = await withTimeout(getDocs(q), 5000, 'Firestore query timeout');
    firestoreIssues = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (d.createdAt || new Date().toISOString()),
        updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : (d.updatedAt || null),
      };
    });
  } catch (err) {
    console.warn('[DataService] Firestore fetchAllReports notice:', err.message);
  }

  // Merge Firestore issues with local issues and deduplicate
  const localIssues = getLocalReports();
  const mergedMap = new Map();
  const seenSignatures = new Set();

  firestoreIssues.forEach(item => {
    // Unique signature per image to prevent duplicate remote records
    const sig = item.cloudinaryPublicId 
      ? `c:${item.cloudinaryPublicId}` 
      : item.imageUrl 
      ? `u:${item.imageUrl}` 
      : null;

    if (sig) {
      if (seenSignatures.has(sig)) return;
      seenSignatures.add(sig);
    }
    mergedMap.set(item.id, item);
  });

  let cacheChanged = false;
  const cleanedLocal = [];

  localIssues.forEach(localItem => {
    const sig = localItem.cloudinaryPublicId 
      ? `c:${localItem.cloudinaryPublicId}` 
      : localItem.imageUrl 
      ? `u:${localItem.imageUrl}` 
      : null;

    if (mergedMap.has(localItem.id) || (sig && seenSignatures.has(sig))) {
      const existingId = mergedMap.has(localItem.id)
        ? localItem.id
        : Array.from(mergedMap.values()).find(r =>
            (localItem.cloudinaryPublicId && r.cloudinaryPublicId === localItem.cloudinaryPublicId) ||
            (localItem.imageUrl && r.imageUrl === localItem.imageUrl)
          )?.id;

      if (existingId && mergedMap.has(existingId)) {
        const remoteItem = mergedMap.get(existingId);
        const localUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        const remoteUpdated = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();

        if (localUpdated >= remoteUpdated && localItem.status) {
          mergedMap.set(existingId, {
            ...remoteItem,
            ...localItem,
            id: existingId,
            status: localItem.status,
            statusHistory: localItem.statusHistory || remoteItem.statusHistory
          });
        }
      }
      cleanedLocal.push({ ...localItem, id: existingId || localItem.id });
      if (!existingId || existingId !== localItem.id) cacheChanged = true;
    } else {
      if (sig) seenSignatures.add(sig);
      mergedMap.set(localItem.id, localItem);
      cleanedLocal.push(localItem);
    }
  });

  if (cacheChanged || cleanedLocal.length !== localIssues.length) {
    saveLocalReports(cleanedLocal);
  }

  const merged = Array.from(mergedMap.values());
  return merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Fetch reports for a specific citizen (For Citizen / Public)
 * @param {string} userId - User UID
 * @returns {Promise<Array>}
 */
export async function fetchUserReports(userId) {
  if (!userId) return [];

  let firestoreIssues = [];
  try {
    const q = query(
      collection(db, 'issues'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await withTimeout(getDocs(q), 5000, 'Firestore query timeout');
    firestoreIssues = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (d.createdAt || new Date().toISOString()),
        updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : (d.updatedAt || null),
      };
    });
  } catch (err) {
    console.warn('[DataService] Firestore fetchUserReports notice:', err.message);
  }

  // Merge with local issues filtered for this user and deduplicate
  const localIssues = getLocalReports().filter(item => item.userId === userId);
  const mergedMap = new Map();
  const seenSignatures = new Set();

  firestoreIssues.forEach(item => {
    const sig = item.cloudinaryPublicId 
      ? `c:${item.cloudinaryPublicId}` 
      : item.imageUrl 
      ? `u:${item.imageUrl}` 
      : null;

    if (sig) {
      if (seenSignatures.has(sig)) return;
      seenSignatures.add(sig);
    }
    mergedMap.set(item.id, item);
  });

  localIssues.forEach(localItem => {
    const sig = localItem.cloudinaryPublicId 
      ? `c:${localItem.cloudinaryPublicId}` 
      : localItem.imageUrl 
      ? `u:${localItem.imageUrl}` 
      : null;

    if (mergedMap.has(localItem.id) || (sig && seenSignatures.has(sig))) {
      const existingId = mergedMap.has(localItem.id)
        ? localItem.id
        : Array.from(mergedMap.values()).find(r =>
            (localItem.cloudinaryPublicId && r.cloudinaryPublicId === localItem.cloudinaryPublicId) ||
            (localItem.imageUrl && r.imageUrl === localItem.imageUrl)
          )?.id;

      if (existingId && mergedMap.has(existingId)) {
        const remoteItem = mergedMap.get(existingId);
        const localUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        const remoteUpdated = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();

        if (localUpdated >= remoteUpdated && localItem.status) {
          mergedMap.set(existingId, {
            ...remoteItem,
            ...localItem,
            id: existingId,
            status: localItem.status
          });
        }
      }
    } else {
      if (sig) seenSignatures.add(sig);
      mergedMap.set(localItem.id, localItem);
    }
  });

  const merged = Array.from(mergedMap.values());
  return merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Update the status of an issue (For Authority)
 * @param {string} issueId - Document ID
 * @param {string} newStatus - New status ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected')
 * @param {string} updatedBy - Authority user email or name
 * @param {string} [notes] - Optional resolution/status notes
 */
export async function updateReportStatus(issueId, newStatus, updatedBy, notes = '') {
  const nowIso = new Date().toISOString();
  const historyEntry = {
    status: newStatus,
    timestamp: nowIso,
    updatedBy: updatedBy || 'Authority',
    notes: notes || `Status updated to ${newStatus}`
  };

  // 1. Update local storage immediately for zero latency
  const localReports = getLocalReports();
  let foundLocal = false;
  const updatedLocal = localReports.map(report => {
    if (report.id === issueId) {
      foundLocal = true;
      const existingHistory = report.statusHistory || [];
      return {
        ...report,
        status: newStatus,
        updatedAt: nowIso,
        statusHistory: [...existingHistory, historyEntry]
      };
    }
    return report;
  });

  if (!foundLocal) {
    updatedLocal.push({
      id: issueId,
      status: newStatus,
      updatedAt: nowIso,
      statusHistory: [historyEntry]
    });
  }
  saveLocalReports(updatedLocal);

  // 2. Attempt Firestore remote update with generous timeout
  if (issueId && !issueId.startsWith('issue_')) {
    try {
      const docRef = doc(db, 'issues', issueId);
      await withTimeout(
        updateDoc(docRef, {
          status: newStatus,
          updatedAt: serverTimestamp(),
        }),
        5000,
        'Firestore status update timeout'
      );
      console.log('[DataService] Firestore issue status confirmed updated:', issueId, newStatus);
    } catch (err) {
      console.error('[DataService] Firestore status update error:', err);
      // If error is permission-related, propagate it so the caller informs the user
      if (err.code === 'permission-denied' || String(err.message).toLowerCase().includes('permission')) {
        throw new Error('Firestore Permission Denied: Your account does not have Authority update permissions.');
      }
      // For network timeouts, local cache is already saved, but log warning
      console.warn('[DataService] Firestore status update offline/timeout, persisted locally:', err.message);
    }
  }

  return true;
}

/**
 * Save user profile to Firestore
 */
export async function saveUserProfile(userId, profileData) {
  if (!userId) return;

  // Local cache
  try {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || '{}');
    profiles[userId] = profileData;
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.warn('Error saving local profile:', e);
  }

  // Firestore write with timeout
  try {
    await withTimeout(
      setDoc(doc(db, 'users', userId), profileData, { merge: true }),
      2500,
      'Firestore profile write timeout'
    );
    console.log('[DataService] User profile saved in Firestore:', userId);
  } catch (err) {
    console.warn('[DataService] Firestore profile save error:', err.message);
  }
}

/**
 * Get user profile from Firestore or local cache
 */
export async function getUserProfile(userId) {
  if (!userId) return null;

  // 1. Instant local read for zero-latency UI restoration on page refresh
  let localProfile = null;
  try {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || '{}');
    localProfile = profiles[userId] || null;
  } catch (err) {
    console.warn('[DataService] Local profile parse error:', err);
  }

  if (localProfile) {
    return localProfile;
  }

  // 2. Fallback to Firestore if not cached locally
  try {
    const docSnap = await withTimeout(
      getDoc(doc(db, 'users', userId)),
      2000,
      'Firestore profile read timeout'
    );
    if (docSnap.exists()) {
      const data = docSnap.data();
      try {
        const profiles = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || '{}');
        profiles[userId] = data;
        localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('[DataService] Firestore get profile notice:', err.message);
  }

  return null;
}

export default {
  saveIssueReport,
  fetchAllReports,
  fetchUserReports,
  updateReportStatus,
  deleteIssueReport,
  saveUserProfile,
  getUserProfile,
};
