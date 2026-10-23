import { Stash } from '@armoury/fivem-roleplay-gamemode-server';

export interface StashInteraction {
  speculate(changes: StashChange, snapshot: Stash): StashInteractionResult;
}

export type StashInteractionResult = {
  needsResync: boolean;
  speculation: Stash;
  async: () => Promise<void>;
  // TODO: Return a promise which should be called by the watcher
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