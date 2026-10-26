import { EVENT_DIRECTIONS, EventListener, type Stub, UI, UIListener } from '@armoury/fivem-framework-client';
import { Stash } from '@armoury/fivem-roleplay-gamemode-client';
import { Injectable } from 'injection-js';
import { type Patch } from 'immer';

@Injectable()
export class StashSyncService {

  @UIListener({ eventName: 'onStashChanges' })
  protected _onStashChanges(message: object): void {
    Cfx.emitNet('armoury-roleplay:unsafe:stash:changed', message);
  }

  @EventListener({ eventName: 'armoury-roleplay:safe:stash:revision:new', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected _onRevisionUpdatedAsResultOfOwnChange(stashId: number, revision: number) {
    console.log('revision changed:', revision, 'stashId:', stashId);
    
    UI.sendMessage({ type: 'global:stash:revision:new', stashId, revision });
  }

  @EventListener({ eventName: 'armoury-roleplay:safe:stash:resync', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected _onStashChangedBySomeoneElse(stashId: number, patches: Patch[], revision: number) {
    console.log('revision changed:', revision);
    console.log('new patches:', patches);

    UI.sendMessage({ type: 'global:stash:resync', stashId, patches, revision });
  }

  @EventListener({ eventName: 'armoury-roleplay:safe:stash:reset', direction: EVENT_DIRECTIONS.SERVER_TO_CLIENT })
  protected _onResetNeededAsResultOfOwnChange(stash: Stash, revision: number) {
    console.log('revision changed:', revision);

    UI.sendMessage({ type: 'global:stash:reset', stash, revision });
  }

}
                         