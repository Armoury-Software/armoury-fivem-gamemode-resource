import { bootstrap } from '@armoury/fivem-roleplay-gamemode-server';

import { enablePatches, enableArrayMethods, setAutoFreeze } from 'immer';

import { Server } from './controllers/server.controller';

import { PedPopulationConfig } from './config/ped-population.config';
import { AccountRepository } from './repository/account/account.repository';
import { AccountService } from './service/account/account.service';
import { CharacterRepository } from './repository/character/character.repository';
import { CharacterService } from './service/character/character.service';
import { PersistableRepository } from './repository/persistable/persistable.repository';
import { PersistableService } from './service/persistable/persistable.service';
import { StashRepository } from './repository/stash/stash.repository';
import { StashService } from './service/stash/stash.service';
import { StashWatcher } from './service/stash/stash.watcher';
import { CrossStashSwapInteraction } from './service/stash/interaction/cross-stash-swap.interaction';
import { SameStashSwapInteraction } from './service/stash/interaction/same-stash-swap.interaction';

enablePatches();
enableArrayMethods();

bootstrap(Server, {
  eager: [
    /** Account */
    AccountRepository,
    AccountService,

    /** Character */
    CharacterRepository,
    CharacterService,

    /** Persistable */
    PersistableRepository,
    PersistableService,
    
    /** Stash */
    StashService,
    StashWatcher,
    CrossStashSwapInteraction,
    SameStashSwapInteraction,

    /** Misc */
    PedPopulationConfig,
  ],
  providers: [StashRepository],
});
