import { bootstrap } from '@armoury/fivem-roleplay-gamemode-client';

import { Client } from './controllers/client.controller';
import { SpawningConfig } from './config/spawn.config';

bootstrap(Client, {
  eager: [SpawningConfig],
});
