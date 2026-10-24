import { EVENT_DIRECTIONS, EventListener } from '@armoury/fivem-framework-server';
import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { randomInt } from 'node:crypto';

import { StashService } from './stash.service';
import { StashInteraction } from './interaction/stash.interaction';
import { StashReorderInteraction } from './interaction/stash-reorder.interaction';

@Injectable()
export class StashWatcher {

  private _stashWatches = new Map<number, StashWatch>();
  private _playerIdsToStashIds = new Map<number, Set<number>>();

  private readonly _interactions: Map<StashActions, StashInteraction>;

  public constructor(
    private readonly _stashes: StashService,
    reorder: StashReorderInteraction,
  ) {
    this._stashes.playerAllowedToStash$.subscribe(this.onPlayerAllowedToStash.bind(this));
    this._stashes.playerDisallowedFromStash$.subscribe(this.onPlayerDisallowedFromStash.bind(this));

    this._interactions = new Map([
      [StashActions.Reorder, reorder]
    ]);
  }

  @EventListener({ eventName: 'armoury-roleplay:unsafe:stash:changed', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected _onChangesMadeToStashUnsafe(changes: StashChange): void {
    if (
      !changes
      || !Number.isSafeInteger(changes.stashId)
      || typeof changes.stashType !== 'string'
      || !Array.isArray(changes.actions)
      || changes.actions.length === 0
    ) {
      return;
    }
  
    const playerId = Cfx.source;
    const watch = this._stashWatches.get(changes.stashId);

    if (
      watch == null
      || !this._playerIdsToStashIds.get(playerId)?.has(changes.stashId)
      || !watch.has(playerId)
      || !this._stashes.hasAccessToStash(playerId, changes.stashId)
    ) {
      // TODO: Emit some sort of event so that the client gets any UI closed and any cached data purged
      return;
    }

    if (!watch.compare(changes.revision)) {
      watch.resync(playerId);
      return;
    }

    if (!this._stashes.stashes.has(changes.stashId)) {
      console.error(
        'Received stash change request from',
        `Player [${Cfx.Server.GetPlayerName(playerId.toString())} (playerId: ${playerId})]`,
        'but there was no stash registered with that ID even though the watch knew about',
        'it. This should never happen. Operation was rejected.'
      );
      watch.resync(playerId);
      return;
    }

    try {
      for (const action of changes.actions) {
        if (
          !action
          || typeof action !== 'object'
          || action.type !== StashActions.Reorder
          || !Number.isSafeInteger(action.previousIndex)
          || !Number.isSafeInteger(action.currentIndex)
          || action.previousIndex < 0
          || action.currentIndex < 0
        ) {
          throw new Error('Invalid stash action.');
        }
      }

      const interaction = this._interactions.get(changes.actions[0].type);
      if (!interaction) {
        throw new Error('Unsupported stash action.');
      }

      const speculation = watch.getLatestSpeculation();
      if (!speculation) {
        throw new Error('Stash snapshot is unavailable.');
      }

      const result = interaction.speculate(changes, speculation);
      watch.commit(result.speculation, result.async, playerId);

      if (result.needsResync) {
        watch.resync(playerId);
      }
    } catch (error) {
      watch.resync(playerId); // TODO: Do we need to watch.resyncForAll here? Or just leave it as-is, with watch.resync?
      console.error(error);
      return;
    }

    console.log(`Received changes from playerId ${playerId}:`, changes);
  }

  private onPlayerAllowedToStash([playerId, toStashId]: [number, number]): void {
    let stashIds = this._playerIdsToStashIds.get(playerId);
    if (!stashIds) {
      stashIds = new Set<number>();
      this._playerIdsToStashIds.set(playerId, stashIds);
    }
    stashIds.add(toStashId);

    let watch = this._stashWatches.get(toStashId);
    if (watch == null) {
      watch = new StashWatch(toStashId, this._stashes, () => {
        if (watch.isStale()) {
          watch.destroy();
          this._stashWatches.delete(toStashId);
        }
      });
      this._stashWatches.set(toStashId, watch);
    }

    watch.include(playerId);
  }

  private onPlayerDisallowedFromStash([playerId, fromStashId]: [number, number]): void {
    const stashIds = this._playerIdsToStashIds.get(playerId);
    stashIds?.delete(fromStashId);
    if (stashIds?.size === 0) {
      this._playerIdsToStashIds.delete(playerId);
    }

    const watch = this._stashWatches.get(fromStashId);
    if (watch == null) {
      return;
    }

    watch.dismiss(playerId);
    if (watch.isStale()) {
      watch.destroy();
      this._stashWatches.delete(fromStashId);
    }
  }

  private dismiss(playerId: number): void {
    if (!this._playerIdsToStashIds.has(playerId)) {
      return;
    }

    for (const stashId of this._playerIdsToStashIds.get(playerId)!.values()) {
      const watch = this._stashWatches.get(stashId);
      if (watch == null) { continue; }

      watch.dismiss(playerId);

      if (watch.isStale()) {
        watch.destroy();
        this._stashWatches.delete(stashId);
      }
    }

    this._playerIdsToStashIds.delete(playerId);
  }

  @EventListener()
  protected onPlayerDisconnect(): void {
    this.dismiss(Cfx.source);
  }

  // TODO: EventListener for when a character got logged out, which calls this.dismiss()

}

class StashWatch {
  private readonly _playerIds = new Set<number>();
  private readonly _revisions = new RevisionGenerator();

  /**
   * Contains speculations of what Stashes may look like as a result of this revision
   * When promises related to the speculation succeed, the speculation becomes truth,
   * and the StashService's stash gets updated with the speculated version.
  */
  private readonly _queue = new Queue<RevisionSpeculation>();
  private _processing = false;

  public constructor(
    private readonly _stashId: number,
    private readonly _stashes: StashService,
    private readonly _onIdle: () => void,
  ) {}

  public commit(speculation: Stash, asyncCall: () => Promise<void>, triggererPlayerId: number): void {
    const queueItem: RevisionSpeculation = {
      revision: this._revisions.generate(),
      speculation,
      async: asyncCall,
    };
    this._queue.enqueue(queueItem);

    try {
      for (const playerId of this._playerIds) {
        if (playerId == triggererPlayerId) {
          this.notify(playerId, queueItem);
        } else {
          this.resync(playerId, speculation);
        }
      }
    } finally {
      // Start processing even if sending an optimistic notification fails.
      void this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this._processing) {
      return;
    }

    this._processing = true;

    try {
      let item: RevisionSpeculation | undefined;
      // Keep the active item queued so new changes can speculate from it.
      while ((item = this._queue.peek()) !== undefined) {
        await item.async();
        this._stashes.stashes.set(this._stashId, item.speculation);
        this._queue.dequeue();
      }
    } catch (error) {
      this._queue.clear();
      // Invalidate the failed speculation and every revision based on it.
      this._revisions.generate();
      console.error(`Failed to commit stash (id: ${this._stashId}). Pending changes discarded.`, error);
      this.resyncForAll();
    } finally {
      this._processing = false;
      this._onIdle();
    }
  }

  public resync(playerId: number, speculation?: Stash): void {
    const latestQueueItem = this._queue.peekTail();
    if (!(speculation ??= latestQueueItem?.speculation ?? this._stashes.stashes.get(this._stashId))) {
      return;
    }

    Cfx.emitNet(
      'armoury-roleplay:safe:stash:resync',
      playerId,
      latestQueueItem?.revision ?? this._revisions.get(),
      Stash.toStub(speculation)
    );
  }

  public resyncForAll(speculation?: Stash): void {
    for (const playerId of this._playerIds) {
      this.resync(playerId, speculation);
    }
  }

  public getLatestSpeculation(): Stash | null {
    const speculation = this._queue.peekTail()?.speculation ?? this._stashes.stashes.get(this._stashId);
    if (!speculation) {
      return null;
    }
  
    return structuredClone(speculation);
  }

  private notify(playerId: number, queueItem: RevisionSpeculation): void {
    Cfx.emitNet(
      'armoury-roleplay:safe:stash:revision:new',
      playerId,
      queueItem.revision,
      queueItem.speculation.id, // OR: Stash.toStub(queueItem.speculation), if needed
    );
  }

  public compare(playerRevision: number): boolean {
    return this._revisions.compare(playerRevision) == RevisionComparison.Equal;
  }

  public include(playerId: number): void {
    this._playerIds.add(playerId);
  }

  public has(playerId: number): boolean {
    return this._playerIds.has(playerId);
  }

  public dismiss(playerId: number): void {
    this._playerIds.delete(playerId);
  }

  public isStale(): boolean {
    return this._playerIds.size == 0 && !this._processing && this._queue.size == 0;
  }

  public destroy(): void {
    this._playerIds.clear();
    this._revisions?.destroy();
  }
}

type RevisionSpeculation = {
  revision: number;
  speculation: Stash;
  async: () => Promise<void>;
};

class RevisionGenerator {
  #sequence = 0;
  #current: number = NaN;

  private readonly revisions = new Map<number, number>();

  constructor(
    private readonly maxHistory = 128,
  ) {
    if (!Number.isSafeInteger(maxHistory) || maxHistory < 1) {
      throw new RangeError('maxHistory must be a positive integer.');
    }
  }

  public get(): number { return this.#current; }

  public generate(): number {
    let identifier: number;

    do {
      identifier = randomInt(0, 2 ** 48 - 1);
    } while (this.revisions.has(identifier));

    this.revisions.set(identifier, ++this.#sequence);

    if (this.revisions.size > this.maxHistory) {
      const oldest = this.revisions.keys().next().value!;

      this.revisions.delete(oldest);
    }

    return this.#current = identifier;
  }

  public compare(
    identifier: number,
    currentIdentifier: number = this.#current,
  ): RevisionComparison {
    const revision = this.revisions.get(identifier);
    const currentRevision = this.revisions.get(currentIdentifier);

    if (this.#sequence == 0 && isNaN(this.#current)) {
      return RevisionComparison.Equal;
    }

    if (revision === undefined || currentRevision === undefined) {
      return RevisionComparison.Invalid;
    }

    if (revision < currentRevision) {
      return RevisionComparison.Older;
    }

    if (revision > currentRevision) {
      return RevisionComparison.Newer;
    }

    return RevisionComparison.Equal;
  }

  public destroy(): void {
    this.#current = NaN;
    this.revisions.clear();
  }
}

enum RevisionComparison {
  Invalid = 'invalid',
  Older = 'older',
  Equal = 'equal',
  Newer = 'newer',
}

class Queue<T> {
  private readonly items = new Map<number, T>();

  private head = 0;
  private tail = 0;

  public enqueue(item: T): void {
    this.items.set(this.tail++, item);
  }

  public dequeue(): T | undefined {
    if (this.head === this.tail) {
      return undefined;
    }

    const item = this.items.get(this.head);

    this.items.delete(this.head++);

    return item;
  }

  public peek(): T | undefined {
    return this.items.get(this.head);
  }

  public peekTail(): T | undefined {
    return this.items.get(this.tail - 1);
  }

  public get size(): number {
    return this.tail - this.head;
  }

  public clear(): void {
    this.items.clear();
    this.head = 0;
    this.tail = 0;
  }
}

// TODO: Extract to gamemode lib
enum StashActions {
  Reorder = 'reorder',
}

// TODO: Extract to gamemode lib
interface StashReorderAction {
  type: StashActions.Reorder;
  previousIndex: number;
  currentIndex: number;
}

// TODO: Extract to gamemode lib
type StashAction = StashReorderAction;

// TODO: Extract to gamemode lib
interface StashChange {
  stashId: number;
  stashType: string;
  revision: number;
  // All indices refer to the list before and after the drop. Actions describe
  // one change together; they are not sequential moveItemInArray instructions.
  actions: StashAction[];
}
