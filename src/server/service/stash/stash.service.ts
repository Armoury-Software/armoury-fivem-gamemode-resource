import { Export, SessionService } from '@armoury/fivem-framework-server';
import { type Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';
import { randomBytes } from 'crypto';

import { StashRepository } from '../../repository/stash/stash.repository';
import { Server } from '../../controllers/server.controller';

@Injectable()
export class StashService {
  private readonly _stashes = new Map<number, Stash>();
  private readonly _versions = new Map<number, number>();
  private readonly _epoch = randomBytes(12).toString('hex');
  private readonly _viewers = new Map<number, Map<number, number>>();
  private readonly _grants = new Map<number, Map<number, number>>();
  private readonly _playerGenerations = new Map<number, number>();
  private readonly _watchTokens = new Map<number, Map<number, number>>();
  private _nextWatchToken = 0;
  // A single write queue also makes cross-stash transfers deadlock-free.
  private _writes: Promise<unknown> = Promise.resolve();

  public constructor(
    private readonly _repository: StashRepository,
    private readonly _sessions: SessionService,
    private readonly _items: Server
  ) {}

  @Export()
  public async findStashById(stashId: number): Promise<StashSnapshot | null> {
    return (await this.findStashes(stashId))[0] ?? null;
  }

  @Export()
  public findStashByIdImmediate(stashId: number): StashSnapshot | null {
    const stash = this._stashes.get(stashId);
    return stash ? this.snapshot(stash) : null;
  }

  @Export()
  public async findStashes(...stashIds: number[]): Promise<StashSnapshot[]> {
    const missing = [...new Set(stashIds.filter((id) => !this._stashes.has(id)))];
    if (missing.length) this.cacheMissing(await this._repository.fetch(...missing));
    return stashIds
      .map((id) => this.findStashByIdImmediate(id))
      .filter((stash): stash is StashSnapshot => stash !== null);
  }

  @Export()
  public findStashesImmediate(...stashIds: number[]): Array<StashSnapshot | null> {
    return stashIds.map((id) => this.findStashByIdImmediate(id));
  }

  @Export()
  public async findStashesByType(type: string, owningPersistableId?: number): Promise<StashSnapshot[]> {
    const fetched = await this._repository.fetchByType(type, owningPersistableId);
    this.cacheMissing(fetched);
    return fetched.map((stash) => this.snapshot(this._stashes.get(stash.id)!));
  }

  /** Trusted resources must check proximity/permissions before granting shared access. */
  @Export()
  public grantStashAccess(playerId: number, stashId: number): void {
    const principal = this.principal(playerId);
    if (principal === null) throw new StashValidationError('access_denied');
    if (!this._grants.has(stashId)) this._grants.set(stashId, new Map());
    this._grants.get(stashId)!.set(playerId, principal);
  }

  @Export()
  public revokeStashAccess(playerId: number, stashId: number): void {
    this.removePlayer(this._grants, stashId, playerId);
    this.unwatchStash(playerId, stashId);
    Cfx.emitNet('armoury-roleplay:stash:revoked', playerId, stashId);
  }

  @Export()
  public async watchStash(playerId: number, stashId: number): Promise<StashResult> {
    if (!this.validId(stashId)) return { ok: false, error: 'invalid_change', stashes: [] };
    const principal = this.principal(playerId);
    const generation = this.playerGeneration(playerId);
    if (principal === null) return { ok: false, error: 'access_denied', stashes: [] };
    if (!this._watchTokens.has(playerId)) this._watchTokens.set(playerId, new Map());
    const tokens = this._watchTokens.get(playerId)!;
    if (tokens.size >= 64 && !tokens.has(stashId)) return { ok: false, error: 'too_many_subscriptions', stashes: [] };
    const token = ++this._nextWatchToken;
    tokens.set(stashId, token);
    try {
      const stash = await this.findStashById(stashId);
      if (this._watchTokens.get(playerId)?.get(stashId) !== token || generation !== this.playerGeneration(playerId)) {
        return { ok: false, error: 'watch_cancelled', stashes: [] };
      }
      if (!stash || principal !== this.principal(playerId) || !this.canAccess(playerId, stash)) {
        tokens.delete(stashId);
        return { ok: false, error: 'access_denied', stashes: [] };
      }
      if (!this._viewers.has(stashId)) this._viewers.set(stashId, new Map());
      this._viewers.get(stashId)!.set(playerId, principal);
      return { ok: true, stashes: [this.findStashByIdImmediate(stashId)!] };
    } catch (error) {
      if (tokens.get(stashId) === token) tokens.delete(stashId);
      console.error('Unable to watch stash', error);
      return { ok: false, error: 'storage_error', stashes: [] };
    }
  }

  @Export()
  public unwatchStash(playerId: number, stashId: number): void {
    this._watchTokens.get(playerId)?.delete(stashId);
    this.removePlayer(this._viewers, stashId, playerId);
  }

  public forgetPlayer(playerId: number): void {
    this._playerGenerations.set(playerId, this.playerGeneration(playerId) + 1);
    this._watchTokens.delete(playerId);
    for (const map of [this._viewers, this._grants]) {
      for (const stashId of map.keys()) this.removePlayer(map, stashId, playerId);
    }
  }

  public applyPlayerChange(playerId: number, change: StashChange): Promise<StashResult> {
    const principal = this.principal(playerId);
    const generation = this.playerGeneration(playerId);
    return this.enqueue(() => this.apply(change, playerId, principal, generation));
  }

  public playerGeneration(playerId: number): number {
    return this._playerGenerations.get(playerId) ?? 0;
  }

  public playerSnapshot(playerId: number, stashId: number): StashSnapshot | null {
    const snapshot = this.findStashByIdImmediate(stashId);
    return snapshot && this.canAccess(playerId, snapshot) ? snapshot : null;
  }

  /** Server-only API. All resources must mutate via this API to persist and notify viewers. */
  @Export()
  public applyServerStashChange(change: StashChange): Promise<StashResult> {
    return this.enqueue(() => this.apply(change));
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const pending = this._writes.then(work);
    this._writes = pending.catch(() => undefined);
    return pending;
  }

  private async apply(
    change: StashChange,
    playerId?: number,
    principal?: number | null,
    generation?: number
  ): Promise<StashResult> {
    const ids: number[] = [];
    try {
      if (!change || !this.validId(change.stashId)) throw new StashValidationError('invalid_change');
      ids.push(change.stashId);
      if (!Array.isArray(change.actions) || !change.actions.length || change.actions.length > 512) {
        throw new StashValidationError('invalid_change');
      }
      for (const action of change.actions) {
        if (!action || typeof action !== 'object') throw new StashValidationError('invalid_change');
        if (action.type === StashActions.Transfer) {
          if (!this.validId(action.targetStashId) || action.targetStashId === change.stashId) {
            throw new StashValidationError('invalid_change');
          }
          if (!ids.includes(action.targetStashId)) ids.push(action.targetStashId);
        }
      }
      const originals = await this.findStashes(...ids);
      if (originals.length !== ids.length) throw new StashValidationError('stash_not_found');
      if (
        playerId !== undefined &&
        (generation !== this.playerGeneration(playerId) ||
          principal === null ||
          principal !== this.principal(playerId) ||
          originals.some((stash) => !this.canAccess(playerId, stash)))
      )
        throw new StashValidationError('access_denied');
      const source = originals.find((stash) => stash.id === change.stashId)!;
      if (change.stashType !== source.type) throw new StashValidationError('type_mismatch');
      if (change.baseRevision !== source.revision) throw new StashValidationError('revision_mismatch');
      const drafts = originals.map((stash) => this.clone(stash));
      const draft = drafts.find((stash) => stash.id === source.id)!;
      if (change.actions.every((action) => action.type === StashActions.Reorder)) {
        this.reorder(draft, change.actions as StashReorderAction[]);
      } else {
        if (change.actions.length !== 1) throw new StashValidationError('invalid_change');
        const action = change.actions[0];
        if (action.type === StashActions.Remove && playerId === undefined) {
          this.remove(draft, action);
        } else if (action.type === StashActions.Transfer) {
          const target = drafts.find((stash) => stash.id === action.targetStashId)!;
          const original = originals.find((stash) => stash.id === target.id)!;
          if (action.targetStashType !== target.type) throw new StashValidationError('type_mismatch');
          if (action.targetRevision !== original.revision) throw new StashValidationError('revision_mismatch');
          this.transfer(draft, target, action);
          this.validateCapacity(draft);
          this.validateCapacity(target);
        } else throw new StashValidationError('unsupported_action');
      }
      await this._repository.saveSlots(drafts);
      // No await between commit and cache publication.
      for (const stash of drafts) {
        this._stashes.set(stash.id, stash);
        this._versions.set(stash.id, (this._versions.get(stash.id) ?? 0) + 1);
      }
      const stashes = drafts.map((stash) => this.snapshot(stash));
      try {
        const sameSession = playerId !== undefined && generation === this.playerGeneration(playerId);
        this.notify(stashes, sameSession ? playerId : undefined);
      } catch (error) {
        console.error('Unable to notify stash viewers after commit', error);
      }
      return { ok: true, stashes };
    } catch (error) {
      if (!(error instanceof StashValidationError)) console.error('Stash change failed', error);
      return {
        ok: false,
        error: error instanceof StashValidationError ? error.message : 'storage_error',
        stashes: ids
          .map((id) => this.findStashByIdImmediate(id))
          .filter(
            (stash): stash is StashSnapshot =>
              stash !== null &&
              (playerId === undefined ||
                (generation === this.playerGeneration(playerId) &&
                  principal === this.principal(playerId) &&
                  this.canAccess(playerId, stash)))
          ),
      };
    }
  }

  private reorder(stash: Stash, actions: StashReorderAction[]): void {
    const from = new Set<number>();
    const to = new Set<number>();
    for (const action of actions) {
      this.validateIndex(stash, action.previousIndex);
      this.validateIndex(stash, action.currentIndex);
      if (from.has(action.previousIndex) || to.has(action.currentIndex))
        throw new StashValidationError('invalid_reorder');
      from.add(action.previousIndex);
      to.add(action.currentIndex);
    }
    // Unmentioned slots stay in place; mentioned slots must form a permutation.
    if ([...from].some((index) => !to.has(index))) throw new StashValidationError('invalid_reorder');
    const before = stash.slots.slice();
    for (const action of actions) {
      const slot = before[action.previousIndex];
      stash.slots[action.currentIndex] = slot ? { ...slot, slotIndex: action.currentIndex } : null;
    }
  }

  private remove(stash: Stash, action: StashRemoveAction): void {
    this.validateIndex(stash, action.slotIndex);
    const slot = stash.slots[action.slotIndex];
    if (
      !slot ||
      slot.itemIdentifier !== action.itemIdentifier ||
      !Number.isSafeInteger(action.amount) ||
      action.amount <= 0 ||
      action.amount > slot.amount
    )
      throw new StashValidationError('invalid_amount');
    slot.amount -= action.amount;
    if (!slot.amount) stash.slots[action.slotIndex] = null;
  }

  private transfer(source: Stash, target: Stash, action: StashTransferAction): void {
    this.validateIndex(source, action.previousIndex);
    this.validateIndex(target, action.currentIndex);
    const slot = source.slots[action.previousIndex];
    const other = target.slots[action.currentIndex];
    if (!slot || !Number.isSafeInteger(action.amount) || action.amount <= 0 || action.amount > slot.amount) {
      throw new StashValidationError('invalid_amount');
    }
    const moved = { ...slot, amount: action.amount, stashId: target.id, slotIndex: action.currentIndex };
    if (other) {
      if (action.swap !== true || action.amount !== slot.amount) throw new StashValidationError('slot_occupied');
      source.slots[action.previousIndex] = { ...other, stashId: source.id, slotIndex: action.previousIndex };
    } else {
      slot.amount -= action.amount;
      if (!slot.amount) source.slots[action.previousIndex] = null;
    }
    target.slots[action.currentIndex] = moved;
  }

  private validateCapacity(stash: Stash): void {
    let weight = 0;
    const items = this._items.getCachedItems();
    for (const slot of stash.slots) {
      if (!slot) continue;
      const item = items.find((candidate) => candidate.identifier === slot.itemIdentifier);
      if (
        !item ||
        !Number.isFinite(item.weightPerUnit) ||
        item.weightPerUnit < 0 ||
        !Number.isSafeInteger(slot.amount) ||
        slot.amount <= 0 ||
        (item.fullyOccupiesSlot && slot.amount !== 1)
      ) {
        throw new StashValidationError('invalid_item');
      }
      weight += item.weightPerUnit * slot.amount;
    }
    if (!Number.isFinite(weight) || (stash.maxWeight != null && weight > stash.maxWeight)) {
      throw new StashValidationError('weight_exceeded');
    }
  }

  private validateIndex(stash: Stash, index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= stash.maxSlots)
      throw new StashValidationError('invalid_index');
  }

  private validId(id: number): boolean {
    return Number.isSafeInteger(id) && id > 0;
  }

  private principal(playerId: number): number | null {
    if (!this._sessions.isPlayerConnected(playerId)) return null;
    return this._sessions.getSessionByPlayerId(playerId)?.principal ?? null;
  }

  private canAccess(playerId: number, stash: Stash): boolean {
    const principal = this.principal(playerId);
    if (principal === null) return false;
    const persistableId = this._sessions.getSessionByPlayerId(playerId).getServerClaimValue<number>('persistableId');
    return (
      (persistableId != null && stash.owningPersistableId === persistableId) ||
      this._grants.get(stash.id)?.get(playerId) === principal
    );
  }

  private notify(stashes: StashSnapshot[], actor?: number): void {
    const recipients = new Set<number>();
    for (const stash of stashes) {
      for (const [playerId, principal] of this._viewers.get(stash.id) ?? []) {
        if (principal === this.principal(playerId) && this.canAccess(playerId, stash)) recipients.add(playerId);
        else this.removePlayer(this._viewers, stash.id, playerId);
      }
    }
    for (const playerId of recipients) {
      if (playerId === actor) continue;
      const visible = stashes.filter(
        (stash) => this._viewers.get(stash.id)?.has(playerId) && this.canAccess(playerId, stash)
      );
      try {
        Cfx.emitNet('armoury-roleplay:stash:updated', playerId, { ok: true, stashes: visible });
      } catch (error) {
        console.error('Unable to notify stash viewer', error);
      }
    }
  }

  private removePlayer(map: Map<number, Map<number, number>>, stashId: number, playerId: number): void {
    map.get(stashId)?.delete(playerId);
    if (map.get(stashId)?.size === 0) map.delete(stashId);
  }

  private cacheMissing(stashes: Stash[]): void {
    // A slow database read must not replace a newer cache entry.
    for (const stash of stashes) if (!this._stashes.has(stash.id)) this._stashes.set(stash.id, this.clone(stash));
  }

  private clone(stash: Stash): Stash {
    return {
      ...stash,
      slots: Array.from({ length: stash.maxSlots }, (_, index) =>
        stash.slots[index] ? { ...stash.slots[index]! } : null
      ),
    };
  }

  private snapshot(stash: Stash): StashSnapshot {
    return { ...this.clone(stash), revision: `${this._epoch}:${this._versions.get(stash.id) ?? 0}` };
  }
}

class StashValidationError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, StashValidationError.prototype);
  }
}
interface StashSnapshot extends Stash {
  revision: string;
}
interface StashResult {
  ok: boolean;
  error?: string;
  stashes: StashSnapshot[];
}

// TODO: Extract to gamemode lib. Keep these duplicated at transport boundaries.
enum StashActions {
  Reorder = 'reorder',
  Transfer = 'transfer',
  Remove = 'remove',
}
interface StashReorderAction {
  type: StashActions.Reorder;
  previousIndex: number;
  currentIndex: number;
}
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
interface StashChange {
  stashId: number;
  stashType: string;
  baseRevision: string;
  requestId?: string;
  // Reorder indices describe a simultaneous permutation, not sequential moves.
  // Transfer/remove must be the only action in a change.
  actions: StashAction[];
}
