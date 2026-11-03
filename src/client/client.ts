import { bootstrap } from '@armoury/fivem-roleplay-gamemode-client';

import { Client } from './controllers/client.controller';
import { SpawningConfig as PlayerSpawningConfig } from './config/player/spawn.config';
import { SpawningConfig as VehicleSpawningConfig } from './config/vehicle/spawn.config';
import { StashSyncService } from './service/stash/stash-sync.service';
import { ItemRegistry } from './repository/item.registry';

bootstrap(Client, {
  eager: [
    /** Player */
    PlayerSpawningConfig,

    /** Item */
    ItemRegistry,
    
    /** Stash */
    StashSyncService,

    /** Vehicle */
    VehicleSpawningConfig,
  ],
});
