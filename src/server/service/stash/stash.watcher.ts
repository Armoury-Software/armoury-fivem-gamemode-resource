import { EVENT_DIRECTIONS, EventListener } from '@armoury/fivem-framework-server';
import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { createDraft, Draft, finishDraft, type Patch } from 'immer';
import { randomInt } from 'node:crypto';

import { StashService } from './stash.service';
import { StashSlotCache } from './stash-slot.cache';

import { StashChangeHandler, type StashChangeHandlerClass } from './interaction/stash.interaction';
import { StashSlotsSwapInteraction } from './interaction/slots-swap.interaction';
import { StashSlotsMergeInteraction } from './interaction/slots-merge.interaction';
import { StashSlotSplitInteraction } from './interaction/slot-split.interaction';

@Injectable()
export class StashWatcher {

  private _stashWatches = new Map<number, StashWatch>();
  private _playerIdsToStashIds = new Map<number, Set<number>>();

  private readonly _interactions: Map<string/* TODO: Use valid typing, declared in shared lib */, RegisteredStashChangeHandler>;

  public constructor(
    private readonly _stashes: StashService,
    private readonly _stashSlotCache: StashSlotCache,
    swap: StashSlotsSwapInteraction,
    merge: StashSlotsMergeInteraction,
    split: StashSlotSplitInteraction,
  ) {
    this._stashes.playerAllowedToStash$.subscribe(this.onPlayerAllowedToStash.bind(this));
    this._stashes.playerDisallowedFromStash$.subscribe(this.onPlayerDisallowedFromStash.bind(this));

    this._interactions = new Map([
      ['same-stash-slot-swap', { instance: swap, class: StashSlotsSwapInteraction }],
      ['cross-stash-slot-swap', { instance: swap, class: StashSlotsSwapInteraction }],
      ['same-stash-slot-transfer', { instance: merge, class: StashSlotsMergeInteraction }],
      ['cross-stash-slot-transfer', { instance: merge, class: StashSlotsMergeInteraction }],
      ['stash-slots-take', { instance: split, class: StashSlotSplitInteraction }],
    ]);
  }

  @EventListener({ eventName: 'armoury-roleplay:unsafe:stash:changed', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected _onChangesProposedToStashUnsafe(changes: any/* TODO: Replace with valid type */): void {
    const playerId = Cfx.source;

    let sourceWatch: StashWatch;
    let targetWatch: StashWatch;

    let sourceStash: Stash;
    let targetStash: Stash;

    try {
      if (
        !changes?.type || changes.sourceRevision == null ||
        !Number.isSafeInteger(changes.sourceStashId) ||
        !Number.isSafeInteger(changes.sourceRevision) ||
        (changes.targetStashId != null && !Number.isSafeInteger(changes.targetStashId)) ||
        (changes.targetStashId != null && !Number.isSafeInteger(changes.targetRevision))
      ) {
        throw new Error('Invalid changes object.');
      }

      sourceStash = this._stashes.stashes.get(changes.sourceStashId);
      targetStash = this._stashes.stashes.get(changes.targetStashId);

      const interaction = this._interactions.get(changes.type);
      if (!interaction) {
        throw new Error('Unknown interaction requested.');
      }

      if (!sourceStash || (changes.targetStashId != null && !targetStash)) {
        throw new Error('Unknown stash ID.');
      }

      sourceWatch = this._stashWatches.get(sourceStash.id);
      if (
        sourceWatch == null
        || !this._playerIdsToStashIds.get(playerId)?.has(sourceStash.id)
        || !sourceWatch.has(playerId)
        || !this._stashes.hasAccessToStash(playerId, sourceStash.id)
      ) {
        throw new Error('Unknown source watch or no access to source stash');
      }

      if (targetStash) {
        targetWatch = this._stashWatches.get(targetStash.id);
        if (
          targetWatch == null
          || !this._playerIdsToStashIds.get(playerId)?.has(targetStash.id)
          || !targetWatch.has(playerId)
          || !this._stashes.hasAccessToStash(playerId, targetStash.id)
        ) {
          throw new Error('Unknown target watch or no access to target stash');
        }
      }

      if (sourceWatch && changes.sourceRevision != null) {
        sourceWatch.updateRevision(playerId, changes.sourceRevision);
      }

      if (!sourceWatch.compare(changes.sourceRevision)) {
        throw new Error('Outdated source revision');
      }

      if (targetWatch && changes.targetRevision != null) {
        targetWatch.updateRevision(playerId, changes.targetRevision);
      }

      if (targetStash && !targetWatch.compare(changes.targetRevision)) {
        throw new Error('Outdated target revision');
      }

      const resolved =
        interaction.instance.validateAndResolve(changes, sourceStash, targetStash);

      const isSameStash = sourceStash.id === targetStash?.id;

      let sourcePatches: Patch[] = [], targetPatches: Patch[] = [];

      const draft: Draft<TransactionState> = createDraft({
        source: sourceStash,
        target: isSameStash ? null : targetStash,
        cache: this._stashSlotCache,
      });

      interaction.class.bake(draft, changes, resolved);

      const { source: nextSource, target: nextTarget } = finishDraft(
        draft,
        producedPatches => {
          sourcePatches = this.extractPatches(producedPatches, 'source');
          targetPatches = this.extractPatches(producedPatches, 'target');
        }
      );

      this._stashes.stashes.set(sourceStash.id, nextSource);
      if (nextTarget) {
        this._stashes.stashes.set(nextTarget.id, nextTarget);
      }

      sourceWatch.commit(sourcePatches, nextSource, playerId);
      if (nextTarget) {
        targetWatch!.commit(targetPatches, nextTarget, playerId);
      }
    } catch (error) {
      console.error('Got an error while receiving proposed change to stash (unsafe)', error);
      if (sourceStash) {
        sourceWatch.resync(playerId, sourceStash, changes.sourceRevision);
      }

      if (targetStash) {
        targetWatch?.resync(playerId, targetStash, changes.targetRevision);
      }
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
      watch = new StashWatch(toStashId);
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

  private extractPatches(
    patches: Patch[],
    root: 'source' | 'target'
  ): Patch[] {
    return patches
      .filter(p => p.path[0] === root)
      .map(p => ({
        ...p,
        path: p.path.slice(1)
      }));
  }

  @EventListener()
  protected onPlayerDisconnect(): void {
    this.dismiss(Cfx.source);
  }

  // TODO: EventListener for when a character got logged out, which calls this.dismiss()
}

interface RegisteredStashChangeHandler<TChange = any> {
  instance: StashChangeHandler<TChange>;
  class: StashChangeHandlerClass<TChange>;
}

type TransactionState = {
  source: Stash;
  target: Stash;
  cache: StashSlotCache;
};

class StashWatch {
  #stashId: number;
  private readonly _playerIdsToLastKnownRevisions: Map<number, number>;
  private readonly _revisions: RevisionHistory;

  public constructor(stashId: number) {
    this.#stashId = stashId;
    this._playerIdsToLastKnownRevisions = new Map<number, number>();
    this._revisions = new RevisionHistory();
  }

  public commit(patches: Patch[], confirmedState: Stash, triggererPlayerId: number): void {
    const revision = this._revisions.generate(patches);

    for (const playerIdToRevision of this._playerIdsToLastKnownRevisions) {
      const playerId = playerIdToRevision[0];
      const playerRevision = playerIdToRevision[1];

      if (playerId == triggererPlayerId) {
        this.notify(playerId, this.#stashId, revision);
      } else {
        this.resync(playerId, confirmedState, playerRevision);
      }
    }
  }

  public resync(playerId: number, confirmedState: Stash, playerRevision: number): void {
    console.log('Last known revision of player', Cfx.Server.GetPlayerName(playerId.toString()), 'is', playerRevision);
    const patches = this._revisions.getDiff(playerRevision);
    if (patches != null) {
      console.log('Patches for player', Cfx.Server.GetPlayerName(playerId.toString()), 'are', patches);
      Cfx.emitNet('armoury-roleplay:safe:stash:resync', playerId, confirmedState.id, patches, this._revisions.get());
      this._playerIdsToLastKnownRevisions.set(playerId, this._revisions.get());
      return;
    }

    // Hard resets instead of resyncing
    Cfx.emitNet('armoury-roleplay:safe:stash:reset', playerId, Stash.toStub(confirmedState), this._revisions.get());
    this._playerIdsToLastKnownRevisions.set(playerId, this._revisions.get());
  }

  private notify(playerId: number, stashId: number, revision: number): void {
    Cfx.emitNet('armoury-roleplay:safe:stash:revision:new', playerId, stashId, revision);
    this._playerIdsToLastKnownRevisions.set(playerId, revision);
  }

  public compare(playerRevision: number): boolean {
    return this._revisions.compare(playerRevision) == RevisionComparison.Equal;
  }

  public include(playerId: number): void {
    this._playerIdsToLastKnownRevisions.set(playerId, this._revisions.get());
  }

  public updateRevision(playerId: number, revision: number): void {
    if (!this._playerIdsToLastKnownRevisions.has(playerId)) {
      return;
    }

    this._playerIdsToLastKnownRevisions.set(playerId, revision);
  }

  public has(playerId: number): boolean {
    return this._playerIdsToLastKnownRevisions.has(playerId);
  }

  public dismiss(playerId: number): void {
    this._playerIdsToLastKnownRevisions.delete(playerId);
  }

  public isStale(): boolean {
    return this._playerIdsToLastKnownRevisions.size == 0;
  }

  public destroy(): void {
    this._playerIdsToLastKnownRevisions.clear();
    this._revisions?.destroy();
  }
}

class RevisionHistory {
  #sequence = 0;
  #current: number = NaN;

  readonly #revisions = new Map<number, number>([
    [NaN, 0]
  ]);
  readonly #revisionsToPatches = new Map<number, Patch[]>([
    [NaN, []]
  ]);

  constructor(
    private readonly _maxHistory = 64,
  ) {
    if (!Number.isSafeInteger(_maxHistory) || _maxHistory < 1) {
      throw new RangeError('maxHistory must be a positive integer.');
    }
  }

  public get(): number { return this.#current; }

  public generate(patches: Patch[]): number {
    let identifier: number;

    do {
      identifier = randomInt(0, 2 ** 48 - 1);
    } while (this.#revisions.has(identifier));

    this.#revisions.set(identifier, ++this.#sequence);
    this.#revisionsToPatches.set(identifier, patches);

    if (this.#revisions.size > this._maxHistory) {
      const oldest = this.#revisions.keys().next().value!;

      this.#revisions.delete(oldest);
      this.#revisionsToPatches.delete(oldest);
    }

    return this.#current = identifier;
  }

  public getDiff(playerRevision: number): Patch[] | null {
    console.log('calling getDiff with revision', playerRevision);
    console.log('current revisions:', Object.fromEntries(this.#revisions));
    console.log('current revisionsToPatches:', Object.fromEntries(this.#revisionsToPatches));

    const sequence = this.#revisions.get(playerRevision);
    if (sequence === undefined) {
      return null;
    }

    const patches: Patch[] = [];
    for (const [identifier, revisionSequence] of this.#revisions) {
      if (revisionSequence <= sequence) {
        continue;
      }

      const batch = this.#revisionsToPatches.get(identifier);
      if (batch === undefined) {
        return null;
      }

      for (let i = 0; i < batch.length; i++) {
        patches.push(batch[i]);
      }
    }

    return patches;
  }

  public compare(
    identifier: number,
    currentIdentifier: number = this.#current,
  ): RevisionComparison {
    const revision = this.#revisions.get(identifier);
    const currentRevision = this.#revisions.get(currentIdentifier);

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
    this.#revisions.clear();
    this.#revisionsToPatches.clear();
  }
}

enum RevisionComparison {
  Invalid = 'invalid',
  Older = 'older',
  Equal = 'equal',
  Newer = 'newer',
}

// TODO: Extract to gamemode lib
export interface StashChange {
  stashId: number;
  stashType: string;
  revision: number;
  actions: Patch[];
}
