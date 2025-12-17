/**
 * Application Constants
 * Central location for all magic numbers and configuration values
 */

// Strava Sync Configuration
export const STRAVA_SYNC = {
  /** Default number of activities to fetch per page */
  DEFAULT_ACTIVITIES_PER_PAGE: 30,
  /** Maximum number of activities allowed per page */
  MAX_ACTIVITIES_PER_PAGE: 200,
  /** Minimum number of activities per page */
  MIN_ACTIVITIES_PER_PAGE: 1,
  /** Maximum number of pages to fetch in a single sync */
  MAX_PAGES_LIMIT: 100,
  /** Minimum number of pages */
  MIN_PAGES_LIMIT: 1,
  /** Retry-After header value in seconds for concurrent sync attempts */
  RETRY_AFTER_SECONDS: 30,
} as const

// FTP Detection Configuration
export const FTP_DETECTION = {
  /** Default period in days to look back for FTP detection */
  DEFAULT_PERIOD_DAYS: 90,
  /** Maximum period in days for FTP detection */
  MAX_PERIOD_DAYS: 365,
  /** Minimum period in days for FTP detection */
  MIN_PERIOD_DAYS: 1,
  /** Default minimum number of activities required for FTP detection */
  DEFAULT_MIN_ACTIVITIES: 5,
  /** Maximum number of activities for FTP detection */
  MAX_MIN_ACTIVITIES: 100,
  /** Minimum number of activities for FTP detection */
  MIN_MIN_ACTIVITIES: 1,
} as const

// Admin API Configuration
export const ADMIN_API = {
  /** Default users per page */
  DEFAULT_USERS_PER_PAGE: 20,
  /** Maximum users per page */
  MAX_USERS_PER_PAGE: 100,
  /** Minimum users per page */
  MIN_USERS_PER_PAGE: 1,
} as const

// HTTP Status Codes (for clarity and consistency)
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const

// Response Messages
export const MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  STRAVA_NOT_CONNECTED: 'Strava not connected. Please connect your Strava account first.',
  SYNC_IN_PROGRESS: 'Sync already in progress',
  SYNC_IN_PROGRESS_MESSAGE: 'Another sync operation is currently running. Please wait for it to complete.',
  SYNC_STARTED: 'Sync started in background',
  PROFILE_NOT_FOUND: 'Profile not found',
  PROFILE_ALREADY_EXISTS: 'Profile already exists. Use PUT /api/profile to update.',
  VALIDATION_FAILED: 'Validation failed',
  FAILED_TO_FETCH_PROFILE: 'Failed to fetch profile',
  FAILED_TO_UPDATE_PROFILE: 'Failed to update profile',
  FAILED_TO_CREATE_PROFILE: 'Failed to create profile',
  FAILED_TO_DETECT_FTP: 'Failed to detect FTP',
  FAILED_TO_GET_FTP: 'Failed to get FTP',
  FAILED_TO_START_SYNC: 'Failed to start sync',
  INTERNAL_SERVER_ERROR: 'Internal server error',

  // Admin messages
  ADMIN_ACCESS_REQUIRED: 'Admin access required',
  ADMIN_USERS_FETCH_FAILED: 'Failed to fetch users',
  ADMIN_USER_NOT_FOUND: 'User not found',
  ADMIN_UPDATE_FAILED: 'Failed to update user',
  ADMIN_STATS_FETCH_FAILED: 'Failed to fetch statistics',
} as const
