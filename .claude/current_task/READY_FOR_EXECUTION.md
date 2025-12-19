# Strava Incremental Sync - Ready for Execution

**Status:** Ready for Implementation
**Created:** 2025-12-19
**Estimated Effort:** 5-7 hours
**Implementation Cards:** 8 cards

---

## Quick Start

This implementation plan is ready for execution. All necessary context has been gathered and the work is broken down into sequential, atomic cards.

### Implementation Order

**Phase 1: Fix Webhook Processing (2-3 hours)**
1. CARD_1: Add helper functions for TSS calculation (30 min)
2. CARD_2: Update webhook with token refresh (45 min)
3. CARD_3: Add TSS calculation to activity upsert (30 min)
4. CARD_4: Add error handling and logging (20 min)

**Phase 2: Auto-Incremental Sync (3-4 hours)**
5. CARD_5: Update sync API endpoint (45 min)
6. CARD_6: Track sync type metadata (30 min)
7. CARD_7: Update UI with sync options dropdown (60 min)
8. CARD_8: Add integration tests (45 min)

---

## What This Delivers

### User-Facing Improvements

1. **Complete TSS Data**
   - All webhook-synced activities now include TSS
   - Training load tracking works for real-time updates
   - No manual re-sync required after webhook events

2. **Smart Sync Options**
   - "Sync New Activities" - Incremental sync from last sync time
   - "Full Re-sync" - Complete re-sync of all activities
   - Clear UI showing last sync date

3. **Better Performance**
   - 94% reduction in API calls for typical syncs (1 call vs 34 calls)
   - Faster sync times (seconds instead of minutes)
   - Better rate limit efficiency

### Technical Improvements

1. **Automatic Token Refresh**
   - Webhook handler refreshes expired tokens
   - No more failed syncs due to token expiration

2. **Sync Metadata Tracking**
   - `syncType`: 'full' or 'incremental'
   - `syncedFrom`: Timestamp for incremental syncs
   - Better debugging and monitoring

3. **Comprehensive Error Handling**
   - Graceful degradation when TSS calculation fails
   - Detailed logging for troubleshooting
   - Activities stored even if TSS unavailable

---

## Architecture

### Files Modified (8 files)

1. `web/app/api/webhooks/strava/route.ts` - Webhook handler (CARD_1-4)
2. `web/app/api/strava/sync/route.ts` - Sync API endpoint (CARD_5)
3. `web/lib/services/strava-sync-service.ts` - Sync service (CARD_6)
4. `web/components/strava/strava-connection.tsx` - UI component (CARD_7)
5. `web/messages/en.json` - Translation keys (CARD_7)
6. `web/messages/pt.json` - Translation keys (CARD_7)
7. `web/messages/es.json` - Translation keys (CARD_7)
8. `web/messages/fr.json` - Translation keys (CARD_7)

### Files Created (3 test files)

1. `web/app/api/strava/sync/route.test.ts` - API tests (CARD_8)
2. `web/lib/services/strava-sync-service.test.ts` - Service tests (CARD_8)
3. `web/__tests__/integration/strava-incremental-sync.test.ts` - E2E tests (CARD_8)

### Database Changes

**None required** - All necessary fields already exist:
- `strava_activities.tss`
- `strava_activities.tss_method`
- `strava_connections.last_sync_at`
- `athlete_profiles.resting_hr`

---

## Testing Strategy

### Unit Tests (CARD_1-6, CARD_8)
- TSS calculation helper functions
- Token refresh logic
- Incremental sync parameter handling
- Sync metadata tracking

### Integration Tests (CARD_8)
- Complete sync workflow (API → Service → Job → Database)
- Webhook processing with TSS
- Job status polling
- UI interaction

### Manual Testing
- Create activity on Strava → verify webhook syncs with TSS
- Trigger incremental sync → verify only recent activities synced
- Trigger full sync → verify all activities synced
- Check logs for proper metadata and error handling

---

## Deployment

### Pre-Deployment Checklist
- [ ] All 8 cards implemented
- [ ] All tests passing (`pnpm test`)
- [ ] Type checking passing (`pnpm type-check`)
- [ ] Linting passing (`pnpm lint`)
- [ ] Manual testing completed

### Deployment Steps
1. Merge to main branch
2. Automatic deployment via Vercel
3. Monitor logs for webhook processing
4. Verify incremental sync works for existing users

### Post-Deployment Verification
- [ ] Webhook events processed with TSS
- [ ] Incremental sync API endpoint works
- [ ] UI shows sync options dropdown
- [ ] `last_sync_at` updates correctly
- [ ] No errors in production logs

### Rollback Plan
Each phase is independent and can be rolled back separately:
- **Phase 1:** Revert webhook route changes
- **Phase 2:** Revert sync API and UI changes
- **No database changes** - No migrations to rollback

---

## Monitoring

### Key Metrics

**Webhook Health:**
- Events received per hour
- TSS calculation success rate (target: >90%)
- Token refresh success rate (target: >99%)
- Processing time (target: <2 seconds)

**Sync Performance:**
- Sync type distribution (full vs incremental)
- Average activities per sync by type
- API calls per sync by type
- Sync duration by type

**Rate Limit Usage:**
- API calls per 15-minute window
- Daily API call usage
- Rate limit errors (target: 0)

### Log Queries

```typescript
// Successful TSS calculation
"TSS calculated for webhook activity"

// Missing athlete profile (expected)
"TSS calculation returned null" + reason: "Missing athlete profile"

// Incremental sync started
"Incremental sync from last_sync_at"

// Full sync fallback
"No previous sync found, performing full sync"
```

---

## Known Limitations

### Phase 1 + Phase 2 Scope

**Included:**
- ✅ Webhook TSS calculation
- ✅ Automatic token refresh
- ✅ Auto-incremental sync parameter
- ✅ UI sync options dropdown

**Not Included (Future Phases):**
- ❌ Auto-register webhooks on OAuth
- ❌ Background automatic sync
- ❌ Webhook retry queue
- ❌ Webhook subscription management UI

### Edge Cases Handled

- Missing athlete profile → Activity stored with `tss: null`
- Expired token → Automatic refresh before API call
- No `last_sync_at` → Full sync performed
- Activity without metrics → Gracefully stored without TSS

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Webhook-synced activities have TSS calculated
- [ ] Token refresh works automatically
- [ ] No webhook failures due to expired tokens
- [ ] TSS calculation errors logged with diagnostic data

### Phase 2 Complete When:
- [ ] Incremental sync works with `?incremental=true`
- [ ] UI shows sync options for existing users
- [ ] First-time users see simple sync button
- [ ] Sync metadata tracked in job results

### Overall Success When:
- [ ] All 8 cards implemented and tested
- [ ] Production deployment successful
- [ ] No increase in error rates
- [ ] User feedback positive (faster syncs)

---

## Next Steps

1. **Start with CARD_1** - Add TSS helper functions
2. **Follow sequential order** - Each card builds on previous
3. **Test after each card** - Verify changes work before proceeding
4. **Create PR after Phase 1** - Consider reviewing Phase 1 before Phase 2
5. **Deploy and monitor** - Watch metrics after production deployment

---

## Support & Questions

If you encounter issues during implementation:

1. **Check the detailed plan:** `PLAN.md` has full context
2. **Review individual cards:** `PLAN/CARD_X.md` has step-by-step instructions
3. **Reference original spec:** `web/docs/STRAVA_INCREMENTAL_SYNC_PLAN.md`
4. **Check existing code:** All helper services already exist and work

**Ready to execute!** Start with CARD_1 and work through sequentially.
