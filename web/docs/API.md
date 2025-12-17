# API Documentation

## Overview

This document provides comprehensive documentation for the Cycling AI Analysis API endpoints.

**Base URL:** `/api`
**Authentication:** Most endpoints require authentication via Supabase Auth

## Rate Limiting

All API endpoints are rate-limited to prevent abuse:

| Endpoint Type | Limit        | Window     |
| ------------- | ------------ | ---------- |
| General API   | 100 requests | 1 hour     |
| Strava Sync   | 5 requests   | 1 hour     |
| Webhooks      | 1000 events  | 1 hour     |
| Auth          | 20 requests  | 15 minutes |

**Rate Limit Headers:**

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (on 429 responses)

## Authentication Endpoints

### Get User Profile

**Endpoint:** `GET /api/profile`

**Description:** Fetch the authenticated user's athlete profile

**Authentication:** Required

**Response:**

```json
{
  "profile": {
    "id": "uuid",
    "user_id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "age": 35,
    "gender": "male",
    "ftp": 265,
    "max_hr": 186,
    "resting_hr": 52,
    "weight_kg": 70,
    "goals": ["Improve FTP", "Complete century ride"],
    "preferred_language": "en",
    "timezone": "America/New_York",
    "units_system": "metric",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T12:00:00Z"
  }
}
```

**Status Codes:**

- `200 OK`: Profile retrieved successfully
- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Profile doesn't exist
- `500 Internal Server Error`: Server error

### Update User Profile

**Endpoint:** `PUT /api/profile`

**Description:** Update the authenticated user's athlete profile

**Authentication:** Required

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "age": 36,
  "ftp": 270,
  "maxHr": 186,
  "restingHr": 50,
  "weightKg": 69,
  "goals": ["Improve FTP", "Race in criterium"],
  "preferredLanguage": "en",
  "timezone": "America/New_York",
  "unitsSystem": "metric"
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Response:**

```json
{
  "profile": {
    // Updated profile object
  }
}
```

**Status Codes:**

- `200 OK`: Profile updated successfully
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Server error

### Create User Profile

**Endpoint:** `POST /api/profile/create`

**Description:** Create a new athlete profile (one-time setup)

**Authentication:** Required

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "age": 35,
  "gender": "male",
  "ftp": 265,
  "maxHr": 186,
  "weightKg": 70,
  "goals": ["Improve FTP"],
  "preferredLanguage": "en",
  "timezone": "America/New_York",
  "unitsSystem": "metric"
}
```

**Response:**

```json
{
  "profile": {
    // Created profile object
  }
}
```

**Status Codes:**

- `201 Created`: Profile created successfully
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: User not authenticated
- `409 Conflict`: Profile already exists
- `500 Internal Server Error`: Server error

## Strava Integration

### Sync Strava Activities

**Endpoint:** `POST /api/strava/sync`

**Description:** Trigger a background job to sync activities from Strava

**Authentication:** Required

**Query Parameters:**

- `after` (optional): Unix timestamp - only sync activities after this date
- `perPage` (optional): Activities per page (1-200, default: 30)
- `maxPages` (optional): Maximum pages to fetch (1-100, default: unlimited)

**Example:**

```
POST /api/strava/sync?after=1672531200&perPage=50&maxPages=10
```

**Response:**

```json
{
  "success": true,
  "message": "Sync started in background",
  "jobId": "job-uuid",
  "statusUrl": "/api/strava/sync/status/job-uuid"
}
```

**Status Codes:**

- `202 Accepted`: Sync started successfully
- `400 Bad Request`: Invalid parameters or Strava not connected
- `401 Unauthorized`: User not authenticated
- `409 Conflict`: Sync already in progress
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Get Sync Status

**Endpoint:** `GET /api/strava/sync`

**Description:** Get current sync status and activity count

**Authentication:** Required

**Response:**

```json
{
  "syncStatus": "success",
  "syncError": null,
  "lastSyncAt": "2025-01-15T12:00:00Z",
  "activityCount": 1250
}
```

**Status Codes:**

- `200 OK`: Status retrieved successfully
- `400 Bad Request`: Strava not connected
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Server error

## FTP Detection

### Detect FTP from Activities

**Endpoint:** `POST /api/profile/ftp/detect`

**Description:** Analyze activity data to detect FTP (Functional Threshold Power)

**Authentication:** Required

**Query Parameters:**

- `periodDays` (optional): Days to look back (1-365, default: 90)
- `minActivities` (optional): Minimum activities required (1-100, default: 5)
- `updateProfile` (optional): Whether to update profile with detected FTP (default: false)

**Example:**

```
POST /api/profile/ftp/detect?periodDays=60&minActivities=10&updateProfile=true
```

**Response:**

```json
{
  "estimate": {
    "estimatedFTP": 268,
    "confidence": "high",
    "activitiesAnalyzed": 45,
    "method": "critical_power",
    "date": "2025-01-15T12:00:00Z"
  },
  "updated": true
}
```

**Status Codes:**

- `200 OK`: FTP detected successfully
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Server error

### Get Current FTP

**Endpoint:** `GET /api/profile/ftp/detect`

**Description:** Get the current FTP from user's profile

**Authentication:** Required

**Response:**

```json
{
  "ftp": 265
}
```

**Status Codes:**

- `200 OK`: FTP retrieved successfully
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Server error

## Webhooks

### Strava Webhook Verification

**Endpoint:** `GET /api/webhooks/strava`

**Description:** Verification endpoint for Strava webhook subscription

**Query Parameters:**

- `hub.mode`: Must be "subscribe"
- `hub.verify_token`: Verification token
- `hub.challenge`: Challenge string to echo back

**Response:**

```json
{
  "hub.challenge": "challenge-string"
}
```

**Status Codes:**

- `200 OK`: Verification successful
- `403 Forbidden`: Verification failed

### Receive Strava Webhook Events

**Endpoint:** `POST /api/webhooks/strava`

**Description:** Receive webhook events from Strava

**Request Body:**

```json
{
  "object_type": "activity",
  "object_id": 123456789,
  "aspect_type": "create",
  "owner_id": 987654,
  "subscription_id": 12345,
  "event_time": 1672531200
}
```

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

- `200 OK`: Event received and processed
- `500 Internal Server Error`: Server error

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "message": "Detailed description (optional)",
  "details": [
    // Validation errors (optional)
  ]
}
```

## Common HTTP Status Codes

| Code | Meaning               | Description                              |
| ---- | --------------------- | ---------------------------------------- |
| 200  | OK                    | Request successful                       |
| 201  | Created               | Resource created                         |
| 202  | Accepted              | Request accepted for async processing    |
| 400  | Bad Request           | Invalid request parameters               |
| 401  | Unauthorized          | Authentication required                  |
| 403  | Forbidden             | Insufficient permissions                 |
| 404  | Not Found             | Resource not found                       |
| 409  | Conflict              | Resource conflict (e.g., already exists) |
| 429  | Too Many Requests     | Rate limit exceeded                      |
| 500  | Internal Server Error | Server error                             |

## Best Practices

1. **Always check rate limit headers** to avoid hitting limits
2. **Use the job status endpoint** to poll for sync completion
3. **Handle 409 conflicts gracefully** when sync is already in progress
4. **Respect Retry-After headers** on 429 responses
5. **Validate request bodies** before sending to avoid 400 errors
6. **Store tokens securely** and never expose in client-side code

## Support

For issues or questions:

- Check the error message and status code
- Review this documentation
- Check application logs for detailed error information
