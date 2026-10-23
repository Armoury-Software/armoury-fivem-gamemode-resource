import { EVENT_DIRECTIONS, EventListener } from '@armoury/fivem-framework-common';
import { Injectable } from 'injection-js';

import { StashService } from '../stash.service';

@Injectable()
export class StashChangeInteraction {
  public constructor(private readonly _stashes: StashService) {}

  @EventListener({ eventName: 'armoury-roleplay:unsafe:stash:changed', direction: EVENT_DIRECTIONS.CLIENT_TO_SERVER })
  protected _onChangesMadeToStashUnsafe(changes: StashChange): void {
    const playerId = Cfx.source;

    // TODO: Add validation: Is this stash owned by the player, or does he have access to it?

    console.log(`Received changes from playerId ${playerId}:`, changes);
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
  // All indices refer to the list before and after the drop. Actions describe
  // one change together; they are not sequential moveItemInArray instructions.
  actions: StashAction[];
}
