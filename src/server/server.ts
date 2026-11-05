import { bootstrap } from '@armoury/fivem-roleplay-gamemode-server';

import { enablePatches, enableArrayMethods } from 'immer';

import { Server } from './controllers/server.controller';

import { PedPopulationConfig } from './config/ped/ped-population.config';
import { AccountRepository } from './repository/account/account.repository';
import { AccountService } from './service/account/account.service';
import { CharacterRepository } from './repository/character/character.repository';
import { CharacterService } from './service/character/character.service';
import { PersistableRepository } from './repository/persistable/persistable.repository';
import { PersistableService } from './service/persistable/persistable.service';
import { StashRepository } from './repository/stash/stash.repository';
import { StashService } from './service/stash/stash.service';
import { StashWatcher } from './service/stash/stash.watcher';
import { StashSlotCache } from './service/stash/stash-slot.cache';
import { VehicleService } from './service/vehicle/vehicle.service';
import { VehicleRepository } from './repository/vehicle/vehicle.repository';
import { SpawningConfig as VehicleSpawningConfig } from './config/vehicle/spawn.config';
import { GroupVehicleSpawningConfig } from './config/group/group-vehicle-spawner.config';
import { ItemService } from './service/stash/items/item.service';

import { StashSlotsSwapInteraction } from './service/stash/interaction/slots-swap.interaction';
import { StashSlotsMergeInteraction } from './service/stash/interaction/slots-merge.interaction';
import { StashSlotSplitInteraction } from './service/stash/interaction/slot-split.interaction';

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
    StashSlotCache,
    StashSlotsMergeInteraction,
    StashSlotsSwapInteraction,
    StashSlotSplitInteraction,

    /** Item */
    ItemService,

    /** Vehicle */
    VehicleService,
    VehicleRepository,
    VehicleSpawningConfig,

    /** Group */
    GroupVehicleSpawningConfig,

    /** Misc */
    PedPopulationConfig,
  ],
  providers: [StashRepository],
});
