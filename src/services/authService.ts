import { 
  db, 
  auth, 
  firebaseConfig,
  initializeApp,
  deleteApp,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  query, 
  where,
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  FirebaseUser
} from './firebase';
import { getAuth } from 'firebase/auth';
import { AppUserAccount, AuthRole, UserAccountStatus } from '../types';

export const USER_ID_SUFFIX = '@lltlab.internal';
export const LOCAL_AUTH_STORAGE_KEY = 'lltlab_authenticated_user_v2';

export function userIdToAuthEmail(userId: string): string {
  const cleanId = userId.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${cleanId}${USER_ID_SUFFIX}`;
}

export const DEFAULT_ADMIN_USER_ID = 'ADMIN01';
export const DEFAULT_ADMIN_PASS = 'Admin@123';
export const DEFAULT_ADMIN_NAME = 'Lab Administrator';

/**
 * SHA-256 password hashing helper
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(`lltlab_security_salt_2026_${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback hash
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return `fb_${Math.abs(hash)}`;
  }
}

/**
 * Ensure default system admin user exists in Firestore
 */
export async function ensureDefaultAdminExists(): Promise<void> {
  if (!db) return;
  try {
    const adminDocRef = doc(db, 'users', 'system_admin_01');
    const existingDoc = await getDoc(adminDocRef);
    const passHash = await hashPassword(DEFAULT_ADMIN_PASS);

    if (!existingDoc.exists()) {
      await setDoc(adminDocRef, {
        id: 'system_admin_01',
        name: DEFAULT_ADMIN_NAME,
        userId: DEFAULT_ADMIN_USER_ID,
        role: 'admin',
        status: 'active',
        passwordHash: passHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log("Default Admin initialized in Firestore:", DEFAULT_ADMIN_USER_ID);
    } else {
      const data = existingDoc.data() as AppUserAccount;
      if (!data.passwordHash) {
        await updateDoc(adminDocRef, {
          passwordHash: passHash,
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.warn("ensureDefaultAdminExists note:", error);
  }
}

/**
 * Authenticate User by Role, User ID, and Password
 */
export async function loginWithUserId(
  role: AuthRole, 
  userIdInput: string, 
  passwordInput: string
): Promise<{ userAccount: AppUserAccount; firebaseUser: FirebaseUser | null }> {
  const cleanUserId = userIdInput.trim().toUpperCase();
  if (!cleanUserId) {
    throw new Error("Please enter your User ID.");
  }
  if (!passwordInput) {
    throw new Error("Please enter your password.");
  }

  // 1. Locate User in Firestore
  let userAccountData: AppUserAccount | null = null;
  let userDocId = '';

  if (db) {
    try {
      // Try direct ID lookup first (e.g. system_admin_01)
      if (cleanUserId === DEFAULT_ADMIN_USER_ID) {
        const directAdminSnap = await getDoc(doc(db, 'users', 'system_admin_01'));
        if (directAdminSnap.exists()) {
          userAccountData = directAdminSnap.data() as AppUserAccount;
          userDocId = 'system_admin_01';
        }
      }

      // Query by userId field
      if (!userAccountData) {
        const q = query(collection(db, 'users'), where('userId', '==', cleanUserId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          userAccountData = docSnap.data() as AppUserAccount;
          userDocId = docSnap.id;
        }
      }
    } catch (fsErr) {
      console.warn("Firestore query note during login:", fsErr);
    }
  }

  // 2. If it's the initial default Admin and no Firestore doc was loaded, auto-provision Admin
  if (!userAccountData && cleanUserId === DEFAULT_ADMIN_USER_ID && passwordInput === DEFAULT_ADMIN_PASS) {
    const passHash = await hashPassword(DEFAULT_ADMIN_PASS);
    userAccountData = {
      id: 'system_admin_01',
      name: DEFAULT_ADMIN_NAME,
      userId: DEFAULT_ADMIN_USER_ID,
      role: 'admin',
      status: 'active',
      passwordHash: passHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    userDocId = 'system_admin_01';

    if (db) {
      try {
        await setDoc(doc(db, 'users', 'system_admin_01'), userAccountData);
      } catch (err) {
        console.warn("Could not save default admin to Firestore:", err);
      }
    }
  }

  // 3. If still not found
  if (!userAccountData) {
    throw new Error(`User ID "${cleanUserId}" not found. Please check your User ID or contact administrator.`);
  }

  // 4. Verification: Check User Account Status
  if (userAccountData.status === 'disabled') {
    throw new Error("Your account has been disabled. Please contact the administrator.");
  }
  if (userAccountData.status === 'deleted') {
    throw new Error("Your account has been deleted. Please contact the administrator.");
  }
  if (userAccountData.status !== 'active') {
    throw new Error("Your account is not active. Please contact the administrator.");
  }

  // 5. Verification: Check Password
  const inputHash = await hashPassword(passwordInput);
  const isDefaultAdminPassMatch = (cleanUserId === DEFAULT_ADMIN_USER_ID && passwordInput === DEFAULT_ADMIN_PASS);
  const isHashMatch = Boolean(userAccountData.passwordHash && userAccountData.passwordHash === inputHash);
  const isPlainMatch = Boolean(userAccountData.password && userAccountData.password === passwordInput);

  if (!isHashMatch && !isPlainMatch && !isDefaultAdminPassMatch) {
    throw new Error("Invalid password. Please check your password.");
  }

  // If password was plain, upgrade to hash in Firestore
  if (!userAccountData.passwordHash && db && userDocId) {
    try {
      await updateDoc(doc(db, 'users', userDocId), {
        passwordHash: inputHash,
        password: null,
        updatedAt: new Date().toISOString()
      });
    } catch {}
  }

  // 6. Verification: Check Role authorization
  if (userAccountData.role !== role) {
    const actualRoleLabel = userAccountData.role === 'admin' ? 'Admin' : 'Random';
    const selectedRoleLabel = role === 'admin' ? 'Admin' : 'Random';
    throw new Error(
      `Role mismatch! User ID "${cleanUserId}" is registered with '${actualRoleLabel}' role, but '${selectedRoleLabel}' was selected above. Please select '${actualRoleLabel}' in the role dropdown.`
    );
  }

  // 7. Optional Firebase Auth sign-in (fail-safe)
  let fbUser: FirebaseUser | null = null;
  if (auth) {
    try {
      const authEmail = userIdToAuthEmail(cleanUserId);
      const cred = await signInWithEmailAndPassword(auth, authEmail, passwordInput);
      fbUser = cred.user;
    } catch (authError: any) {
      // Operation not allowed or password mismatch in Firebase Auth - ignore so login proceeds via Firestore
      console.info("Firebase Auth background note (safe fallback used):", authError?.code || authError?.message);
    }
  }

  // 8. Persist authenticated session locally
  try {
    const sessionToSave = {
      ...userAccountData,
      id: userDocId || userAccountData.id
    };
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(sessionToSave));
  } catch {}

  return {
    userAccount: {
      ...userAccountData,
      id: userDocId || userAccountData.id
    },
    firebaseUser: fbUser || (auth?.currentUser ?? null)
  };
}

/**
 * Restore stored authenticated session from localStorage
 */
export function getStoredAuthSession(): AppUserAccount | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUserAccount;
    if (parsed && parsed.userId && parsed.role && parsed.status === 'active') {
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
  } catch {}

  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
}

/**
 * Check if a User ID already exists in Firestore
 */
export async function checkUserIdExists(userId: string): Promise<boolean> {
  if (!db) return false;
  const cleanId = userId.trim().toUpperCase();
  try {
    const q = query(collection(db, 'users'), where('userId', '==', cleanId));
    const snapshot = await getDocs(q);
    const activeExisting = snapshot.docs.filter(d => {
      const data = d.data() as AppUserAccount;
      return data.status !== 'deleted';
    });
    return activeExisting.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create a new user (Admin only)
 */
export async function createNewUserByAdmin(data: {
  name: string;
  userId: string;
  password: string;
  role: AuthRole;
  status: UserAccountStatus;
}): Promise<AppUserAccount> {
  if (!db) {
    throw new Error("Database is not connected.");
  }

  const cleanUserId = data.userId.trim().toUpperCase();
  const cleanName = data.name.trim();

  if (!cleanUserId) throw new Error("User ID is required.");
  if (!cleanName) throw new Error("User Name is required.");
  if (!data.password || data.password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  // Uniqueness validation
  const exists = await checkUserIdExists(cleanUserId);
  if (exists) {
    throw new Error(`User ID "${cleanUserId}" already exists. Please choose another User ID.`);
  }

  const passHash = await hashPassword(data.password);
  const docId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Optional: attempt creating in secondary Firebase Auth if enabled
  const authEmail = userIdToAuthEmail(cleanUserId);
  const secondaryAppName = `SecondaryAuth_${Date.now()}`;
  let secondaryApp: any = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    await createUserWithEmailAndPassword(secondaryAuth, authEmail, data.password);
    await signOut(secondaryAuth);
  } catch (authErr: any) {
    // If operation not allowed, we safely catch it and proceed with Firestore
    console.info("Secondary Firebase Auth note (proceeding with Firestore):", authErr?.code || authErr?.message);
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch {}
    }
  }

  // Save to Firestore
  const newAccount: AppUserAccount = {
    id: docId,
    name: cleanName,
    userId: cleanUserId,
    role: data.role,
    status: data.status,
    passwordHash: passHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'users', docId), newAccount);
  return newAccount;
}

/**
 * Update user basic details (Admin only)
 */
export async function updateUserAccount(
  uid: string, 
  updates: Partial<Pick<AppUserAccount, 'name' | 'role' | 'status'>>
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Change User Role (Admin only)
 */
export async function updateUserRole(uid: string, newRole: AuthRole): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    role: newRole,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Change User Status: 'active' | 'disabled' | 'deleted' (Admin only)
 */
export async function updateUserStatus(uid: string, newStatus: UserAccountStatus): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    status: newStatus,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Delete User Account completely (Admin only)
 */
export async function deleteUserAccount(uid: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), {
    status: 'deleted',
    updatedAt: new Date().toISOString()
  });
}

/**
 * Reset / Change User Password (Admin only)
 */
export async function changeUserPasswordByAdmin(uid: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }
  if (!db) return;

  const passHash = await hashPassword(newPassword);
  await updateDoc(doc(db, 'users', uid), {
    passwordHash: passHash,
    password: null,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Real-time listener for all users (Admin view)
 */
export function subscribeAllUsers(callback: (users: AppUserAccount[]) => void): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const usersRef = collection(db, 'users');
  const unsubscribe = onSnapshot(usersRef, (snapshot) => {
    const list: AppUserAccount[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AppUserAccount;
      list.push({
        ...data,
        id: docSnap.id
      });
    });
    // Sort by createdAt descending
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    callback(list);
  }, (err) => {
    console.warn("subscribeAllUsers error:", err);
  });

  return unsubscribe;
}

/**
 * Real-time listener for the currently logged-in user profile
 */
export function subscribeUserProfile(
  uid: string, 
  callback: (user: AppUserAccount | null) => void
): () => void {
  if (!db || !uid) {
    callback(null);
    return () => {};
  }

  const userDocRef = doc(db, 'users', uid);
  const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        ...docSnap.data(),
        id: docSnap.id
      } as AppUserAccount);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn("subscribeUserProfile error:", err);
  });

  return unsubscribe;
}
