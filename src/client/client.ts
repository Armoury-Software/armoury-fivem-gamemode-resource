import { bootstrap } from '@armoury/fivem-roleplay-gamemode-client';

import { Client } from './controllers/client.controller';
import { SpawningConfig } from './config/spawn.config';
import { StashChangeInteraction } from './service/stash/interaction/stash-change.interaction';
import { StashResyncService } from './service/stash/stash-resync.service';

bootstrap(Client, {
  eager: [
    SpawningConfig,
    
    /** Stash */
    StashResyncService,
    StashChangeInteraction
  ],
});
