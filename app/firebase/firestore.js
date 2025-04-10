import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import app from './config';
import { getCurrentUser } from './auth';

// Initialize Firestore
const db = getFirestore(app);

// Collection names
const USERS_COLLECTION = 'users';
const BOOKINGS_COLLECTION = 'bookings';
const TURFS_COLLECTION = 'turfs';
const PARTIES_COLLECTION = 'parties';

// User role enum
const UserRole = {
  ADMIN: 'ADMIN',
  USER: 'USER'
};

// Skill level enum
const SkillLevel = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  GOALKEEPER: 'Goalkeeper',
  STRIKER: 'Striker',
  MIDFIELDER: 'Midfielder',
  DEFENDER: 'Defender',
  FORWARD: 'Forward',
  WINGER: 'Winger'
};

// Payment status enum
const PaymentStatus = {
  PENDING: 'Pending',
  PAID: 'Paid',
  REFUNDED: 'Refunded'
};

/**
 * Create or update a user in Firestore
 */
export const createUser = async (userId, userData) => {
  try {
    // Structure the user data according to our schema
    const userDocData = {
      id: userId,
      name: userData.name || null,
      email: userData.email,
      emailVerified: userData.emailVerified || null,
      gender: userData.gender || null,
      phone: userData.phone || null,
      password: null, // We don't store passwords in Firestore (handled by Firebase Auth)
      image: userData.image || null,
      role: userData.role || UserRole.USER,
      age: userData.age || null,
      preferredGames: userData.preferredGames || [],
      skillLevel: userData.skillLevel || null,
      bio: userData.bio || null,
      friendIds: userData.friendIds || [],
      badges: userData.badges || [],
      createdAt: userData.createdAt ? Timestamp.fromDate(new Date(userData.createdAt)) : Timestamp.now(),
      updatedAt: Timestamp.now(),
      isTwoFactorEnabled: userData.isTwoFactorEnabled || false
    };

    // Reference to the user document
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    
    // Create or update the user document
    await setDoc(userDocRef, userDocData, { merge: true });
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a user from Firestore by ID
 */
export const getUserById = async (userId) => {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { user: userDoc.data(), error: null };
    } else {
      return { user: null, error: 'User not found' };
    }
  } catch (error) {
    console.error('Error getting user:', error);
    return { user: null, error: error.message };
  }
};

/**
 * Get the current authenticated user's data from Firestore
 */
export const getCurrentUserData = async () => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return { user: null, error: 'No authenticated user' };
  }
  
  return await getUserById(currentUser.uid);
};

/**
 * Update a user in Firestore
 */
export const updateUser = async (userId, userData) => {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    
    // Convert any Date objects to Firestore Timestamps
    const firestoreData = { ...userData };
    if (userData.createdAt) {
      firestoreData.createdAt = Timestamp.fromDate(new Date(userData.createdAt));
    }
    
    // Add updated timestamp
    firestoreData.updatedAt = Timestamp.now();
    
    await updateDoc(userDocRef, firestoreData);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email) => {
  try {
    const usersCollection = collection(db, USERS_COLLECTION);
    const q = query(usersCollection, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Return the first matching document
      return { user: querySnapshot.docs[0].data(), error: null };
    } else {
      return { user: null, error: 'User not found' };
    }
  } catch (error) {
    console.error('Error getting user by email:', error);
    return { user: null, error: error.message };
  }
};

/**
 * Get all bookings for the current user
 */
export const getUserBookings = async () => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return { bookings: [], error: 'No authenticated user' };
  }
  
  try {
    const bookingsCollection = collection(db, BOOKINGS_COLLECTION);
    const q = query(
      bookingsCollection, 
      where('userId', '==', currentUser.uid),
      orderBy('bookingDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = [];
    
    for (const doc of querySnapshot.docs) {
      const bookingData = doc.data();
      
      // Fetch related turf data
      let turfData = null;
      if (bookingData.turfId) {
        const turfDoc = await getDoc(doc(db, TURFS_COLLECTION, bookingData.turfId));
        if (turfDoc.exists()) {
          turfData = turfDoc.data();
        }
      }
      
      // Fetch related party data
      let partyData = null;
      if (bookingData.partyId) {
        const partyDoc = await getDoc(doc(db, PARTIES_COLLECTION, bookingData.partyId));
        if (partyDoc.exists()) {
          partyData = partyDoc.data();
        }
      }
      
      // Convert timestamps to date strings
      const booking = {
        ...bookingData,
        id: doc.id,
        bookingDate: bookingData.bookingDate instanceof Timestamp ? 
          bookingData.bookingDate.toDate().toISOString().split('T')[0] : 
          bookingData.bookingDate,
        createdAt: bookingData.createdAt instanceof Timestamp ? 
          bookingData.createdAt.toDate().toISOString() : 
          bookingData.createdAt,
        updatedAt: bookingData.updatedAt instanceof Timestamp ? 
          bookingData.updatedAt.toDate().toISOString() : 
          bookingData.updatedAt,
        turf: turfData,
        party: partyData
      };
      
      bookings.push(booking);
    }
    
    return { bookings, error: null };
  } catch (error) {
    console.error('Error getting user bookings:', error);
    return { bookings: [], error: error.message };
  }
};

/**
 * Create a new booking
 */
export const createBooking = async (bookingData) => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return { success: false, error: 'No authenticated user' };
  }
  
  try {
    const bookingsCollection = collection(db, BOOKINGS_COLLECTION);
    const newBookingRef = doc(bookingsCollection);
    
    // Convert date string to Firestore timestamp
    let processedBookingData = { ...bookingData };
    
    if (typeof processedBookingData.bookingDate === 'string') {
      processedBookingData.bookingDate = Timestamp.fromDate(new Date(processedBookingData.bookingDate));
    }
    
    // Set standard fields
    processedBookingData = {
      ...processedBookingData,
      userId: currentUser.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await setDoc(newBookingRef, processedBookingData);
    
    return { 
      success: true, 
      bookingId: newBookingRef.id,
      error: null 
    };
  } catch (error) {
    console.error('Error creating booking:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update a booking
 */
export const updateBooking = async (bookingId, bookingData) => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return { success: false, error: 'No authenticated user' };
  }
  
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    const bookingDoc = await getDoc(bookingRef);
    
    if (!bookingDoc.exists()) {
      return { success: false, error: 'Booking not found' };
    }
    
    // Check if the booking belongs to the current user
    const existingBooking = bookingDoc.data();
    if (existingBooking.userId !== currentUser.uid) {
      return { success: false, error: 'You do not have permission to update this booking' };
    }
    
    // Process booking data
    let processedBookingData = { ...bookingData };
    
    // Convert date string to Firestore timestamp if needed
    if (typeof processedBookingData.bookingDate === 'string') {
      processedBookingData.bookingDate = Timestamp.fromDate(new Date(processedBookingData.bookingDate));
    }
    
    // Set updated timestamp
    processedBookingData.updatedAt = Timestamp.now();
    
    await updateDoc(bookingRef, processedBookingData);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating booking:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (bookingId) => {
  try {
    return await updateBooking(bookingId, {
      paymentStatus: PaymentStatus.REFUNDED
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a booking by ID
 */
export const getBookingById = async (bookingId) => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return { booking: null, error: 'No authenticated user' };
  }
  
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    const bookingDoc = await getDoc(bookingRef);
    
    if (!bookingDoc.exists()) {
      return { booking: null, error: 'Booking not found' };
    }
    
    const bookingData = bookingDoc.data();
    
    // Check if the booking belongs to the current user
    if (bookingData.userId !== currentUser.uid) {
      return { booking: null, error: 'You do not have permission to view this booking' };
    }
    
    // Fetch related turf data
    let turfData = null;
    if (bookingData.turfId) {
      const turfDoc = await getDoc(doc(db, TURFS_COLLECTION, bookingData.turfId));
      if (turfDoc.exists()) {
        turfData = turfDoc.data();
      }
    }
    
    // Fetch related party data
    let partyData = null;
    if (bookingData.partyId) {
      const partyDoc = await getDoc(doc(db, PARTIES_COLLECTION, bookingData.partyId));
      if (partyDoc.exists()) {
        partyData = partyDoc.data();
      }
    }
    
    // Convert timestamps to date strings
    const booking = {
      ...bookingData,
      id: bookingDoc.id,
      bookingDate: bookingData.bookingDate instanceof Timestamp ? 
        bookingData.bookingDate.toDate().toISOString().split('T')[0] : 
        bookingData.bookingDate,
      createdAt: bookingData.createdAt instanceof Timestamp ? 
        bookingData.createdAt.toDate().toISOString() : 
        bookingData.createdAt,
      updatedAt: bookingData.updatedAt instanceof Timestamp ? 
        bookingData.updatedAt.toDate().toISOString() : 
        bookingData.updatedAt,
      turf: turfData,
      party: partyData
    };
    
    return { booking, error: null };
  } catch (error) {
    console.error('Error getting booking:', error);
    return { booking: null, error: error.message };
  }
};

// Export the Firestore instance
export { db, UserRole, SkillLevel, PaymentStatus };

// Default export for Firestore services
const firestoreService = {
  createUser,
  getUserById,
  getCurrentUserData,
  updateUser,
  getUserByEmail,
  getUserBookings,
  createBooking,
  updateBooking,
  cancelBooking,
  getBookingById,
  UserRole,
  SkillLevel,
  PaymentStatus
};

export default firestoreService; 