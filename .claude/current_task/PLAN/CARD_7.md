# CARD 7: Update UI Component with Sync Options Dropdown

**Phase:** 2 - Auto-Incremental Sync
**Priority:** High
**Estimated Effort:** 60 minutes
**Dependencies:** CARD_5, CARD_6

---

## Objective

Update the `StravaConnection` UI component to show a dropdown with "Sync New Activities" (incremental) and "Full Re-sync" (full) options for users who have previously synced. First-time users see a simple sync button.

---

## Changes Required

### File: `web/components/strava/strava-connection.tsx`

**Add imports (after line 9):**

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, RefreshCw, RotateCcw } from 'lucide-react'
```

**Update handleSync function (replace lines 129-158):**

**Current code:**

```typescript
const handleSync = async () => {
  try {
    setError(null)
    setSuccessMessage(null)
    resetPolling()

    const res = await fetch('/api/strava/sync', {
      method: 'POST',
    })

    if (res.status === 202) {
      // Background job started successfully
      const data = await res.json()
      setCurrentJobId(data.jobId)
      startPolling()
      toast.loading(t('syncStarted') || 'Sync started in background...', {
        duration: 3000,
      })
    } else if (!res.ok) {
      const errorData = await res.json()
      const error = errorData.error || t('failedToSync')
      setError(error)
      toast.error(error)
    }
  } catch {
    const error = t('failedToSync')
    setError(error)
    toast.error(error)
  }
}
```

**New code:**

```typescript
const handleSync = async (fullSync = false) => {
  try {
    setError(null)
    setSuccessMessage(null)
    resetPolling()

    // Build URL with query parameters
    const params = new URLSearchParams()

    // Default to incremental if we have a last sync time
    if (!fullSync && syncStatus?.lastSyncAt) {
      params.set('incremental', 'true')
    }

    const url = `/api/strava/sync${params.toString() ? `?${params}` : ''}`

    const res = await fetch(url, {
      method: 'POST',
    })

    if (res.status === 202) {
      // Background job started successfully
      const data = await res.json()
      setCurrentJobId(data.jobId)
      startPolling()

      const message = fullSync
        ? t('fullSyncStarted') || 'Full sync started...'
        : t('incrementalSyncStarted') || 'Syncing new activities...'

      toast.loading(message, {
        duration: 3000,
      })
    } else if (!res.ok) {
      const errorData = await res.json()
      const error = errorData.error || t('failedToSync')
      setError(error)
      toast.error(error)
    }
  } catch {
    const error = t('failedToSync')
    setError(error)
    toast.error(error)
  }
}
```

**Replace sync button UI (lines 247-258):**

**Current code:**

```typescript
<Button
  onClick={handleSync}
  disabled={isPolling || status.token_expired}
  variant="default"
>
  {isPolling ? t('syncing') : t('syncActivities')}
</Button>
```

**New code:**

```typescript
{syncStatus?.lastSyncAt ? (
  // Show dropdown with sync options for users with existing syncs
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button disabled={isPolling || status.token_expired} variant="default">
        <RefreshCw className={`h-4 w-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
        {isPolling ? t('syncing') : t('syncActivities')}
        <ChevronDown className="h-4 w-4 ml-2" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem onClick={() => handleSync(false)} disabled={isPolling}>
        <RefreshCw className="h-4 w-4 mr-2" />
        <div className="flex flex-col">
          <span>{t('syncNew')}</span>
          <span className="text-xs text-muted-foreground">
            {t('sinceLast', {
              date: new Date(syncStatus.lastSyncAt).toLocaleDateString(),
            })}
          </span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleSync(true)} disabled={isPolling}>
        <RotateCcw className="h-4 w-4 mr-2" />
        <div className="flex flex-col">
          <span>{t('fullResync')}</span>
          <span className="text-xs text-muted-foreground">{t('allActivities')}</span>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  // First sync - just show simple button
  <Button
    onClick={() => handleSync(true)}
    disabled={isPolling || status.token_expired}
    variant="default"
  >
    <RefreshCw className={`h-4 w-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
    {isPolling ? t('syncing') : t('syncActivities')}
  </Button>
)}
```

---

## Translation Keys Required

### File: `web/messages/en.json` (and other locales)

**Add to `strava` section:**

```json
{
  "strava": {
    "syncNew": "Sync New Activities",
    "fullResync": "Full Re-sync",
    "allActivities": "All activities",
    "sinceLast": "Since {date}",
    "incrementalSyncStarted": "Syncing new activities...",
    "fullSyncStarted": "Full sync started..."
  }
}
```

---

## Implementation Notes

### UI Behavior

**For users WITHOUT previous sync (`last_sync_at = null`):**
- Show simple "Sync Activities" button
- Clicking performs full sync

**For users WITH previous sync (`last_sync_at != null`):**
- Show dropdown button with chevron icon
- Default option: "Sync New Activities" (incremental)
- Alternative option: "Full Re-sync" (all activities)
- Show last sync date in dropdown

### User Experience Flow

```
User with previous sync
  ↓
Clicks "Sync Activities" button (has dropdown)
  ↓
Sees two options:
  1. "Sync New Activities - Since Dec 15, 2024"
  2. "Full Re-sync - All activities"
  ↓
Clicks option 1 (incremental)
  ↓
API call: POST /api/strava/sync?incremental=true
  ↓
Toast: "Syncing new activities..."
  ↓
Polls job status
  ↓
Success: "Synced 10 activities"
```

### Dropdown Design

The dropdown uses shadcn/ui's DropdownMenu component:
- **Trigger:** Main button with chevron-down icon
- **Content:** Two menu items with icons and descriptions
- **Alignment:** `align="start"` for left alignment
- **Icons:** `RefreshCw` for incremental, `RotateCcw` for full

---

## Testing

### Manual Testing

1. **First-time user (no last_sync_at):**
   - Should see simple "Sync Activities" button
   - No dropdown, no chevron icon
   - Clicking performs full sync

2. **Existing user (has last_sync_at):**
   - Should see "Sync Activities" button with dropdown chevron
   - Clicking button opens dropdown
   - Dropdown shows "Sync New Activities" with last sync date
   - Dropdown shows "Full Re-sync" option
   - Clicking "Sync New Activities" triggers incremental sync
   - Clicking "Full Re-sync" triggers full sync

3. **Toast messages:**
   - Incremental: "Syncing new activities..."
   - Full: "Full sync started..."

4. **Disabled states:**
   - Button disabled when `isPolling = true`
   - Button disabled when `token_expired = true`
   - Dropdown menu items disabled when `isPolling = true`

### Component Tests

```typescript
describe('StravaConnection - Sync Options', () => {
  it('should show simple button for first-time users', () => {
    render(<StravaConnection />, {
      syncStatus: { lastSyncAt: null },
    })

    const button = screen.getByText('Sync Activities')
    expect(button).not.toHaveAttribute('aria-haspopup')
  })

  it('should show dropdown for users with previous sync', () => {
    render(<StravaConnection />, {
      syncStatus: { lastSyncAt: '2024-01-15T10:00:00Z' },
    })

    const trigger = screen.getByRole('button', { name: /sync activities/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')

    fireEvent.click(trigger)

    expect(screen.getByText('Sync New Activities')).toBeInTheDocument()
    expect(screen.getByText('Full Re-sync')).toBeInTheDocument()
  })

  it('should trigger incremental sync when clicking Sync New', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    render(<StravaConnection />, {
      syncStatus: { lastSyncAt: '2024-01-15T10:00:00Z' },
    })

    const trigger = screen.getByRole('button', { name: /sync activities/i })
    fireEvent.click(trigger)

    const incrementalOption = screen.getByText('Sync New Activities')
    fireEvent.click(incrementalOption)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/strava/sync?incremental=true',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('should trigger full sync when clicking Full Re-sync', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    render(<StravaConnection />, {
      syncStatus: { lastSyncAt: '2024-01-15T10:00:00Z' },
    })

    const trigger = screen.getByRole('button', { name: /sync activities/i })
    fireEvent.click(trigger)

    const fullOption = screen.getByText('Full Re-sync')
    fireEvent.click(fullOption)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/strava/sync',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
```

---

## Acceptance Criteria

- [ ] Imports added for DropdownMenu and icons
- [ ] `handleSync` updated to accept `fullSync` parameter
- [ ] Query parameter logic correctly builds URL
- [ ] Dropdown shown when `lastSyncAt` exists
- [ ] Simple button shown when `lastSyncAt` is null
- [ ] "Sync New Activities" triggers incremental sync
- [ ] "Full Re-sync" triggers full sync
- [ ] Toast messages differentiate incremental vs full
- [ ] Translation keys added to all locales
- [ ] Dropdown styling matches existing UI
- [ ] TypeScript compilation passes
- [ ] No linting errors

---

## Accessibility

- Button has proper `aria-haspopup="menu"` when dropdown enabled
- Dropdown items are keyboard navigable
- Icons have descriptive text for screen readers
- Disabled states clearly indicated

---

## Next Steps

After completing this card, proceed to **CARD_8** to add integration tests for the complete incremental sync flow.
