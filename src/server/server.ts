import { bootstrap } from '@armoury/fivem-roleplay-gamemode-server';
import { Server } from './controllers/server.controller';
import { PedPopulationConfig } from './config/ped-population.config';

bootstrap(Server, {
  eager: [PedPopulationConfig],
});
