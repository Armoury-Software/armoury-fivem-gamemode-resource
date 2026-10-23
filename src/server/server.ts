import { bootstrap } from '@armoury/fivem-roleplay-gamemode-server';

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
import { StashChangeInteraction } from './service/stash/interaction/stash-change.interaction';
import { StashWatcher } from './service/stash/stash.watcher';

bootstrap(Server, {
  eager: [
    AccountRepository,
    AccountService,
    CharacterRepository,
    CharacterService,
    PersistableRepository,
    PersistableService,
    PedPopulationConfig,
    StashService,
    StashChangeInteraction,
    StashWatcher,
  ],
  providers: [StashRepository],
});
