// List of email addresses that have Authority / Admin privileges
export const AUTHORITY_EMAILS = [
    "124parth4014@sjcem.edu.in",
    "124parh4014@sjcme.edu.in",
    "admin@smartcity.com",
    "maithilpatil9@gmail.com",
    "harshstawde@gmail.com",
    "satyambhagat200623@gmail.com"
];

export const ADMIN_EMAILS = AUTHORITY_EMAILS;

/**
 * Valid report statuses in municipal workflow
 */
export const REPORT_STATUSES = [
    'Submitted',
    'Under Review',
    'Assigned',
    'In Progress',
    'Resolved',
    'Rejected'
];

/**
 * The 9 official custom model classes (strictly preserved in the custom PyTorch model)
 */
export const MODEL_CLASSES = [
    'Damaged concrete structures',
    'DamagedElectricalPoles',
    'DamagedRoadSigns',
    'DeadAnimalsPollution',
    'FallenTrees',
    'Garbage',
    'Graffitti',
    'IllegalParking',
    'Potholes and RoadCracks'
];

/**
 * All application-level civic categories (9 model classes + Waterlogging via multimodal API)
 */
export const CIVIC_CATEGORIES = [
    'Damaged concrete structures',
    'DamagedElectricalPoles',
    'DamagedRoadSigns',
    'DeadAnimalsPollution',
    'FallenTrees',
    'Garbage',
    'Graffitti',
    'IllegalParking',
    'Potholes and RoadCracks',
    'Waterlogging'
];

/**
 * Checks if the given user or profile has Authority privileges.
 * @param {object} user - The Firebase auth user object.
 * @param {object} [profile] - Optional Firestore user profile.
 * @returns {boolean} - True if authority, false otherwise.
 */
export const isAuthority = (user, profile = null) => {
    if (!user) return false;
    if (user.email && AUTHORITY_EMAILS.includes(user.email.toLowerCase())) {
        return true;
    }
    if (profile && (profile.role === 'authority' || profile.role === 'admin')) {
        return true;
    }
    return false;
};

/**
 * Backwards compatibility alias for isAuthority
 */
export const isAdmin = (user, profile = null) => {
    return isAuthority(user, profile);
};

export const isCitizen = (user, profile = null) => {
    return !!user && !isAuthority(user, profile);
};

export const getUserRole = (user, profile = null) => {
    return isAuthority(user, profile) ? 'authority' : 'citizen';
};

// Gamification Logic
export const POINTS_PER_ACTION = {
    REPORT_SUBMITTED: 10,
    REPORT_VERIFIED: 50, // Bonus for good reporting
    REPORT_RESOLVED: 20,
};

export const BADGES = {
    GUARDIAN: { id: 'guardian', label: 'City Guardian', icon: '🛡️', threshold: 500 },
    SUPER_CITIZEN: { id: 'super_citizen', label: 'Super Citizen', icon: '🌟', threshold: 1000 },
    POTHOLE_PATROL: { id: 'pothole_patrol', label: 'Pothole Patrol', icon: '🚧', threshold: 5 }, // 5 pothole reports
};

export const getLevel = (points) => {
    return Math.floor(points / 100) + 1;
};

export const getNextLevelProgress = (points) => {
    const currentLevel = getLevel(points);
    const nextLevelPoints = currentLevel * 100;
    const currentLevelPoints = (currentLevel - 1) * 100;
    return ((points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100;
};

