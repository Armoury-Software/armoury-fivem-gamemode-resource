# Stash synchronization

The UI can update optimistically. `onStashChange` returns immediately; the game client queues writes and sends one at a time, across all stashes. The server validates access, types, indices, amounts and revisions, then persists all affected slots in one oxmysql transaction. Only a successful commit changes the server cache and revisions. Reads return detached snapshots, so other resources cannot accidentally mutate the authoritative cache.

## UI integration still required

Existing `onStashChange` reorder payloads remain supported by the game client. It supplies `baseRevision` and `requestId` when sending to the server. Reorder indices form a **simultaneous permutation**: each mentioned source and destination appears once, and the sets of mentioned indices must match. Unmentioned slots stay in place; null slots participate in the permutation too. Sending just `{previousIndex: 0, currentIndex: 3}` does not describe the intervening shifts and is rejected.

All stash snapshots now include an opaque `revision: string`. The string includes a resource lifetime identifier; revisions from before a resource restart are invalid.

The game client sends these NUI messages:

```typescript
interface StashSyncMessage {
  type: 'inventory:stash:sync';
  ok: boolean;
  error?: string;
  requestId?: string;
  stashes: Array<Stash & { revision: string }>;
  pendingChanges: number;
}
// Access was revoked: remove this stash from the visible inventory.
// { type: 'inventory:stash:revoked', stashId: number }
```

The UI must keep a confirmed baseline separately from its optimistic layout. Successful acknowledgements advance that baseline. While `pendingChanges > 0`, a successful acknowledgement must not replace newer optimistic edits on screen. When no changes remain, display the confirmed snapshot. On a rejection, discard pending optimistic edits and replace the displayed stash data with the supplied authoritative snapshots. The client discards its unsent queue on any rejection, external update, or timeout.

`error: 'external_change'` accompanies a successful viewer update; discard optimistic edits and show the supplied snapshots. `late_confirmation` means a timed-out write subsequently committed: reconcile with its snapshots as well. Timeout recovery requests fresh snapshots and never retries an ambiguous write automatically. Rejections include only stashes the player can still access. An access-denied response with no snapshot must close or remove the affected stash rather than leave it editable. During timeout recovery, `stashes` can be empty until fresh snapshots arrive.

The existing inventory-open network response automatically starts watching each returned stash. For other inventory screens, call `onStashWatch` with `{stashId}` when displaying a stash and `onStashUnwatch` with `{stashId}` when hiding it. Call `onInventoryClose` with `{}` when closing the inventory. These callbacks are registered in the game client; the UI project still needs to invoke the close callback. Changes to watched stashes are pushed automatically. Closing subscriptions does not cancel a write already submitted to the server.

UI callers can omit `baseRevision` and `targetRevision` and let the game client manage revisions. Explicit revisions are preserved and validated, so callers supplying them must account for their own queued optimistic changes. Changes are bounded to 32 queued UI requests and 16 outstanding server requests per player; a player can watch up to 64 stashes.

## Actions

`StashActions`, action interfaces and `StashChange` remain duplicated in the service and both transport files, pending migration to the library.

Transfers must be the only action in a change. They support partial or full stacks into an empty slot, or an explicit full-stack swap with an occupied slot:

```typescript
{
  stashId: 1,
  stashType: 'character_main',
  // The game client can supply this revision for UI callers.
  baseRevision: source.revision,
  actions: [{
    type: 'transfer',
    previousIndex: 0,
    currentIndex: 2,
    amount: 1,
    targetStashId: 2,
    targetStashType: 'vehicle_trunk',
    targetRevision: target.revision,
    swap: false,
  }],
}
```

Both stashes need access and current revisions. No implicit stack merging occurs. Both resulting stashes must satisfy slot and weight constraints; every item must have valid registered `weightPerUnit` and `fullyOccupiesSlot` metadata in the server item cache. Unknown item metadata fails closed. Transfers between slots in the same stash use reorder actions instead.

`remove` is accepted only by the trusted server API. This lets item-use/drop handlers remove a validated quantity, without giving clients a generic destruction endpoint:

```typescript
await Cfx.exports['armoury-roleplay'].applyServerStashChange({
  stashId: stash.id,
  stashType: stash.type,
  baseRevision: stash.revision,
  actions: [{ type: 'remove', slotIndex: 0, itemIdentifier: 'water', amount: 1 }],
});
```

Consumption effects and spawning/persisting world drops are not implemented. Their resource must validate gameplay eligibility and coordinate its own effects with successful removal. Moving items to an existing world stash can use a transfer. Do not expose `applyServerStashChange` through a client event.

## Shared access and other resources

Personal access uses the authenticated session's server-only `persistableId` claim and the stash's `owningPersistableId`. A trusted resource can call `grantStashAccess(playerId, stashId)` after checking shared-container permissions and proximity, then `revokeStashAccess(playerId, stashId)` when access ends. Grants allow both viewing and writing and are bound to the character principal. Viewing an arbitrary stash ID never grants access. Disconnect/session destruction and character login clear grants and subscriptions; queued requests from an earlier session are rejected.

Exports are available directly on `Cfx.exports['armoury-roleplay']` until the gamemode library wrappers are extended:

- Existing `findStashById`, `findStashByIdImmediate`, `findStashes`, `findStashesImmediate`, `findStashesByType` return detached snapshots with revisions.
- `applyServerStashChange(change)` returns `{ok, error?, stashes}`. Supply current revisions, including a target revision for transfers. A stale operation must be reconsidered against the returned snapshots before retrying.
- `grantStashAccess`, `revokeStashAccess`, `watchStash`, `unwatchStash` manage shared access and subscriptions. `watchStash` returns the same result envelope.

All resources must write through this service to get persistence, revision validation and viewer notifications. Direct SQL writes are outside this protocol. The queue coordinates one running `armoury-roleplay` resource, not multiple independent server processes sharing a database. All writes share one queue to avoid transfer deadlocks; this favors correctness over write throughput.

## Verification

Run `npm run test:stash`, `node node_modules/typescript/bin/tsc --noEmit --skipLibCheck`, and `node esbuild.settings.js`. `skipLibCheck` is needed because the installed FiveM framework packages contain duplicate ambient client/server declarations. Tests mock FiveM and database boundaries; a live FiveM/oxmysql smoke test is still needed before deployment.
