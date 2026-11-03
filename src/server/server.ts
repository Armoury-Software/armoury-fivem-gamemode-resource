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
import { CrossStashSwapInteraction } from './service/stash/interaction/cross-stash-swap.interaction';
import { SameStashSwapInteraction } from './service/stash/interaction/same-stash-swap.interaction';
import { VehicleService } from './service/vehicle/vehicle.service';
import { VehicleRepository } from './repository/vehicle/vehicle.repository';
import { SpawningConfig as VehicleSpawningConfig } from './config/vehicle/spawn.config';
import { GroupVehicleSpawningConfig } from './config/group/group-vehicle-spawner.config';
import { ItemService } from './service/stash/items/item.service';
import { ServerOnlyAddItemInteraction } from './service/stash/interaction/add-item.interaction';
import { ServerOnlyRemoveItemInteraction } from './service/stash/interaction/remove-item.interaction';
import { SameStashMergeInteraction } from './service/stash/interaction/same-stash-merge.interaction';
import { CrossStashMergeInteraction } from './service/stash/interaction/cross-stash-merge.interaction';
import { StashSlotSplitInteraction } from './service/stash/interaction/stash-slot-split.interaction';

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
    CrossStashSwapInteraction,
    CrossStashMergeInteraction,
    SameStashSwapInteraction,
    SameStashMergeInteraction,
    ServerOnlyAddItemInteraction,
    ServerOnlyRemoveItemInteraction,
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
