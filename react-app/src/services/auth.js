const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase (using global SDK loaded via CDN)
const firebase = window.firebase;
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

export function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() => auth.signInWithPopup(provider));
}

export function logout() {
  return auth.signOut();
}

export function onAuthStateChanged(callback) {
  return auth.onAuthStateChanged(callback);
}

export async function saveIdentityIdToFirestore(userId, identityId, email) {
  try {
    const userRef = db.collection("users").doc(userId);
    const doc = await userRef.get();
    
    const updateData = {
      s3_folder_id: identityId,
      email: email,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Set the default storage limit if they don't have one yet
    if (!doc.exists || !doc.data().custom_storage_limit) {
      updateData.custom_storage_limit = Number(import.meta.env.VITE_STORAGE_LIMIT) || 2147483648;
    }

    await userRef.set(updateData, { merge: true });
  } catch (error) {
    console.error("Error saving Identity ID to Firestore:", error);
    throw error;
  }
}

export async function getUserStorageLimit(userId) {
  try {
    const doc = await db.collection("users").doc(userId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.custom_storage_limit) {
        return data.custom_storage_limit;
      }
    }
  } catch (error) {
    console.error("Error fetching user limit:", error);
  }
  return null;
}
