import { bootstrap } from '@armoury/fivem-roleplay-gamemode-client';

import { Client } from './controllers/client.controller';
import { SpawningConfig } from './config/spawn.config';
import { StashSyncService } from './service/stash/stash-sync.service';

bootstrap(Client, {
  eager: [
    SpawningConfig,
    
    /** Stash */
    StashSyncService,
  ],
});
