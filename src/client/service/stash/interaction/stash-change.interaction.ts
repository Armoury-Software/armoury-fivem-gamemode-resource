import { EVENT_DIRECTIONS, EventListener, UI, UIListener } from '@armoury/fivem-framework-client';
import { type Stash } from '@armoury/fivem-roleplay-gamemode-client';
import { Injectable } from 'injection-js';

@Injectable()
export class StashChangeInteraction {
  private readonly _snapshots = new Map<number, StashSnapshot>();
  private readonly _watching = new Set<number>();
  private _queue: StashChange[] = [];
  private _inFlight?: StashChange;
  private _request = 0;
  private _timeout?: ReturnType<typeof setTimeout>;
  private readonly _timedOut = new Set<string>();

  @UIListener({ eventName: 'onStashChange' })
  protected onChangesMadeToStash(changes: StashChange): void {
    if (!changes || !Number.isSafeInteger(changes.stashId) || !Array.isArray(changes.actions)) return;
    if (this._queue.length >= 32) {
      this.recover('too_many_requests');
      return;
    }
    this._queue.push({ ...changes, actions: changes.actions.map((action) => ({ ...action })) });
    this.watch(changes.stashId);
    for (const action of changes.actions) if (action.type === StashActions.Transfer) this.watch(action.targetStashId);
    this.flush();
  }

  // Existing inventory opening needs no UI changes to start subscribing.
  @EventListener({ eventName: 'inventory:unsafe:open:request:response', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected onInventoryOpened(stashes: Record<string, StashSnapshot | null>): void {
    this.close({});
    for (const stash of Object.values(stashes)) {
      if (!stash) continue;
      if (stash.revision) this._snapshots.set(stash.id, stash);
      this.watch(stash.id);
    }
  }

  @UIListener({ eventName: 'onStashWatch' })
  protected onWatch({ stashId }: { stashId: number }): void {
    this.watch(stashId);
  }

  @UIListener({ eventName: 'onStashUnwatch' })
  protected onUnwatch({ stashId }: { stashId: number }): void {
    this._watching.delete(stashId);
    this._snapshots.delete(stashId);
    if (
      this._queue.some(
        (change) =>
          change.stashId === stashId ||
          change.actions.some((action) => action.type === StashActions.Transfer && action.targetStashId === stashId)
      )
    )
      this._queue = [];
    Cfx.emitNet('armoury-roleplay:unsafe:stash:unwatch', stashId);
  }

  @UIListener({ eventName: 'onInventoryClose' })
  protected close(_data: object): void {
    for (const stashId of [...this._watching]) this.onUnwatch({ stashId });
    this._queue = [];
    // Keep an in-flight request correlated until its acknowledgement arrives.
  }

  @EventListener({ eventName: 'armoury-roleplay:stash:snapshot', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected onSnapshot(result: StashResult & { stashId: number }): void {
    if (!this._watching.has(result.stashId)) return;
    if (!result.ok) {
      this._queue = [];
      this.onRevoked(result.stashId);
    }
    this.receive(result);
    this.flush();
  }

  @EventListener({ eventName: 'armoury-roleplay:stash:result', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected onResult(result: StashResult): void {
    if (this._timedOut.delete(result.requestId)) {
      // A slow database commit can finish after the timeout's snapshot request.
      this._queue = [];
      this.receive({ ...result, error: result.error ?? 'late_confirmation' });
      return;
    }
    if (!this._inFlight || result.requestId !== this._inFlight.requestId) return;
    clearTimeout(this._timeout);
    if (result.error === 'access_denied' || result.error === 'stash_not_found') {
      const ids = [
        this._inFlight.stashId,
        ...this._inFlight.actions
          .filter((action): action is StashTransferAction => action.type === StashActions.Transfer)
          .map((action) => action.targetStashId),
      ];
      for (const stashId of ids) if (!result.stashes.some((stash) => stash.id === stashId)) this.onRevoked(stashId);
    }
    this._inFlight = undefined;
    if (!result.ok) this._queue = [];
    this.receive(result);
    this.flush();
  }

  @EventListener({ eventName: 'armoury-roleplay:stash:updated', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected onUpdated(result: StashResult): void {
    // Queued index operations were based on a different layout; never rebase them blindly.
    this._queue = [];
    this.receive({ ...result, error: 'external_change' });
  }

  @EventListener({ eventName: 'armoury-roleplay:stash:revoked', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected onRevoked(stashId: number): void {
    this.onUnwatch({ stashId });
    this._queue = [];
    UI.sendMessage({ type: 'inventory:stash:revoked', stashId });
  }

  private watch(stashId: number): void {
    if (this._watching.has(stashId)) return;
    this._watching.add(stashId);
    Cfx.emitNet('armoury-roleplay:unsafe:stash:watch', stashId);
  }

  private flush(): void {
    if (this._inFlight || !this._queue.length) return;
    const change = this._queue[0];
    const snapshot = this._snapshots.get(change.stashId);
    if (!snapshot) return;
    const actions = change.actions.map((action) => {
      if (action.type !== StashActions.Transfer) return action;
      const target = this._snapshots.get(action.targetStashId);
      return { ...action, targetRevision: action.targetRevision ?? target?.revision };
    });
    if (actions.some((action) => action.type === StashActions.Transfer && !action.targetRevision)) return;
    this._queue.shift();
    this._inFlight = {
      ...change,
      actions,
      baseRevision: change.baseRevision ?? snapshot.revision,
      requestId: `stash-${++this._request}`,
    };
    Cfx.emitNet('armoury-roleplay:unsafe:stash:changed', this._inFlight);
    const requestId = this._inFlight.requestId;
    this._timeout = setTimeout(() => {
      this._timedOut.add(requestId);
      if (this._timedOut.size > 32) this._timedOut.delete(this._timedOut.values().next().value);
      this._inFlight = undefined;
      this.recover('request_timeout');
    }, 15000);
  }

  private recover(error: string): void {
    this._queue = [];
    this._snapshots.clear();
    UI.sendMessage({ type: 'inventory:stash:sync', ok: false, error, stashes: [], pendingChanges: 0 });
    for (const stashId of this._watching) Cfx.emitNet('armoury-roleplay:unsafe:stash:watch', stashId);
  }

  private receive(result: StashResult): void {
    const accepted: StashSnapshot[] = [];
    for (const stash of result.stashes) {
      if (!this._watching.has(stash.id)) continue;
      const current = this._snapshots.get(stash.id);
      const [epoch, version] = stash.revision.split(':');
      const [currentEpoch, currentVersion] = current?.revision.split(':') ?? [];
      if (epoch === currentEpoch && Number(version) < Number(currentVersion)) continue;
      this._snapshots.set(stash.id, stash);
      accepted.push(stash);
    }
    UI.sendMessage({
      type: 'inventory:stash:sync',
      ...result,
      // A discarded queue may contain optimistic edits to other watched stashes too.
      stashes: !result.ok || result.error ? [...this._snapshots.values()] : accepted,
      pendingChanges: this._queue.length + (this._inFlight ? 1 : 0),
    });
  }
}

interface StashSnapshot extends Stash {
  revision: string;
}
interface StashResult {
  ok: boolean;
  error?: string;
  requestId?: string;
  stashes: StashSnapshot[];
}

// TODO: Extract to gamemode lib
enum StashActions {
  Reorder = 'reorder',
  Transfer = 'transfer',
  Remove = 'remove',
}

// TODO: Extract to gamemode lib
interface StashReorderAction {
  type: StashActions.Reorder;
  previousIndex: number;
  currentIndex: number;
}

// TODO: Extract to gamemode lib
interface StashTransferAction {
  type: StashActions.Transfer;
  previousIndex: number;
  currentIndex: number;
  amount: number;
  targetStashId: number;
  targetStashType: string;
  targetRevision: string;
  swap?: boolean;
}
interface StashRemoveAction {
  type: StashActions.Remove;
  slotIndex: number;
  itemIdentifier: string;
  amount: number;
}
type StashAction = StashReorderAction | StashTransferAction | StashRemoveAction;

// TODO: Extract to gamemode lib
interface StashChange {
  stashId: number;
  stashType: string;
  baseRevision: string;
  requestId?: string;
  // All indices refer to the list before and after the drop. Actions describe
  // one change together; they are not sequential moveItemInArray instructions.
  actions: StashAction[];
}
