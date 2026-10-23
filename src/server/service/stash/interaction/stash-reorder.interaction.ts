import { Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { StashInteraction, StashInteractionResult } from './stash.interaction';
import { StashRepository } from '../../../repository/stash/stash.repository';

@Injectable()
export class StashReorderInteraction implements StashInteraction {

  public constructor(
    private readonly _repository: StashRepository,
  ) {}

  public speculate(changes: StashChange, snapshot: Stash): StashInteractionResult {
    // TODO: Validations
    // TODO: Ask all relevant resources: is this allowed to be done?
    // TODO: Throw if anything here is wrong

    return {
      needsResync: false,
      speculation: snapshot,
      async: () => this._repository.reorderSlots(snapshot.id, changes.actions)
    }
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
