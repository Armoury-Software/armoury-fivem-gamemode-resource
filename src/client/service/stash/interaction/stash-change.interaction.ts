import { UIListener } from '@armoury/fivem-framework-client';
import { Injectable } from 'injection-js';

@Injectable()
export class StashChangeInteraction {
  @UIListener({ eventName: 'onStashChange' })
  protected onChangesMadeToStash(changes: StashChange): void {
    Cfx.emitNet('armoury-roleplay:unsafe:stash:changed', changes);
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
