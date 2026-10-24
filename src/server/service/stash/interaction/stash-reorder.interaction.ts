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
    if (changes.stashId !== snapshot.id || changes.stashType !== snapshot.type) {
      throw new Error('Stash change does not match the snapshot.');
    }

    const sources = new Set<number>();
    const destinations = new Set<number>();
    const actions = changes.actions.map(action => ({ ...action }));

    for (const action of actions) {
      if (
        !action
        || action.type !== StashActions.Reorder
        || !Number.isSafeInteger(action.previousIndex)
        || !Number.isSafeInteger(action.currentIndex)
        || action.previousIndex < 0
        || action.currentIndex < 0
        || action.previousIndex >= snapshot.maxSlots
        || action.currentIndex >= snapshot.maxSlots
        || sources.has(action.previousIndex)
        || destinations.has(action.currentIndex)
      ) {
        throw new Error('Invalid stash reorder action.');
      }

      sources.add(action.previousIndex);
      destinations.add(action.currentIndex);
    }

    for (const destination of destinations) {
      if (!sources.has(destination)) {
        throw new Error('Incomplete stash reorder permutation.');
      }
    }

    // TODO: Ask all relevant resources: is this allowed to be done?

    // Read every source from the original layout, including empty slots.
    const slots = snapshot.slots.slice();
    for (const action of actions) {
      const slot = snapshot.slots[action.previousIndex];
      slots[action.currentIndex] = slot == null ? null : { ...slot, slotIndex: action.currentIndex };
    }
    snapshot.slots = slots;

    return {
      needsResync: false,
      speculation: snapshot,
      async: () => this._repository.reorderSlots(snapshot.id, snapshot.maxSlots, actions)
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
