import { EVENT_DIRECTIONS, EventListener, type Stub, UI } from '@armoury/fivem-framework-client';
import { Stash } from '@armoury/fivem-roleplay-gamemode-client';
import { Injectable } from 'injection-js';

@Injectable()
export class StashResyncService {

  @EventListener({ eventName: 'armoury-roleplay:safe:stash:revision:new', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected _onRevisionUpdatedAsResultOfOwnChange(revision: number, stashId: number) {
    console.log('revision changed:', revision);

    UI.sendMessage({
      type: 'global:stash:revision:new',
      stashId,
      revision,
    });
  }

  @EventListener({ eventName: 'armoury-roleplay:safe:stash:resync', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected _onStashChangedBySomeoneElse(revision: number, updatedStash: Stub<Stash>) {
    console.log('revision changed:', revision);
    console.log('new stash:', updatedStash);

    UI.sendMessage({
      type: 'global:stash:resync',
      stashId: updatedStash.id,
      revision,
    });
  }

}
