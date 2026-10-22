import { EVENT_DIRECTIONS, EventListener } from '@armoury/fivem-framework-common';
import { Injectable } from 'injection-js';

import { StashService } from '../stash.service';

@Injectable()
export class StashChangeInteraction {
  private readonly _pending = new Map<number, number>();

  public constructor(private readonly _stashes: StashService) {}

  @EventListener({ eventName: 'armoury-roleplay:unsafe:stash:changed', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected async _onChangesMadeToStashUnsafe(changes: StashChange): Promise<void> {
    const playerId = Cfx.source;
    const generation = this._stashes.playerGeneration(playerId);
    const requestId =
      typeof changes?.requestId === 'string' && changes.requestId.length <= 128 ? changes.requestId : undefined;
    // Bound outstanding work even when a modified client bypasses the client queue.
    if ((this._pending.get(playerId) ?? 0) >= 16) {
      const snapshot = this._stashes.playerSnapshot(playerId, changes?.stashId);
      Cfx.emitNet('armoury-roleplay:stash:result', playerId, {
        ok: false,
        error: 'too_many_requests',
        requestId,
        stashes: snapshot ? [snapshot] : [],
      });
      return;
    }
    this._pending.set(playerId, (this._pending.get(playerId) ?? 0) + 1);
    try {
      const result = await this._stashes.applyPlayerChange(playerId, changes);
      if (generation === this._stashes.playerGeneration(playerId)) {
        Cfx.emitNet('armoury-roleplay:stash:result', playerId, { ...result, requestId });
      }
    } finally {
      const count = (this._pending.get(playerId) ?? 1) - 1;
      if (count > 0) this._pending.set(playerId, count);
      else this._pending.delete(playerId);
    }
  }

  @EventListener({ eventName: 'armoury-roleplay:unsafe:stash:watch', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected async onWatch(stashId: number): Promise<void> {
    const playerId = Cfx.source;
    const generation = this._stashes.playerGeneration(playerId);
    const result = await this._stashes.watchStash(playerId, stashId);
    if (result.error === 'watch_cancelled') return;
    if (generation === this._stashes.playerGeneration(playerId)) {
      Cfx.emitNet('armoury-roleplay:stash:snapshot', playerId, { ...result, stashId });
    }
  }

  @EventListener({ eventName: 'armoury-roleplay:unsafe:stash:unwatch', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected onUnwatch(stashId: number): void {
    this._stashes.unwatchStash(Cfx.source, stashId);
  }

  @EventListener({ direction: EVENT_DIRECTIONS.SERVER_TO_SERVER })
  protected onPlayerSessionDestroyed(playerId: number): void {
    this._stashes.forgetPlayer(playerId);
  }

  @EventListener({ eventName: 'armoury:character-logged-into', direction: EVENT_DIRECTIONS.SERVER_TO_SERVER })
  protected onCharacterChanged(playerId: number): void {
    this._stashes.forgetPlayer(playerId);
  }
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
