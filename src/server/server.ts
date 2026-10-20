import { bootstrap } from '@armoury/fivem-roleplay-gamemode-server';

import { Server } from './controllers/server.controller';

import { PedPopulationConfig } from './config/ped-population.config';
import { AccountRepository } from './repository/account/account.repository';
import { AccountService } from './service/account/account.service';
import { CharacterRepository } from './repository/character/character.repository';
import { CharacterService } from './service/character/character.service';
import { PersistableRepository } from './repository/persistable/persistable.repository';
import { PersistableService } from './service/persistable/persistable.service';

bootstrap(Server, {
  eager: [
    AccountRepository,
    AccountService,
    CharacterRepository,
    CharacterService,
    PersistableRepository,
    PersistableService,
    PedPopulationConfig,
  ],
});
