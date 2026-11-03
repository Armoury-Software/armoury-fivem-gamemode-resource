import { EventListener, Resource, ResourceRef } from '@armoury/fivem-framework-server';
import { Vehicle } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { VehicleService } from '../../service/vehicle/vehicle.service';

@Injectable()
export class GroupVehicleSpawningConfig {

  public constructor(
    @Resource('oxmysql') private readonly _db: ResourceRef,
    private readonly _vehicles: VehicleService,
  ) {}

  @EventListener()
  protected onServerResourceStart(resourceName: string): void {
    if (resourceName == Cfx.Server.GetCurrentResourceName()) {
      this.spawnAllVehiclesAttachedToGroups();
    }
  }

  private async spawnAllVehiclesAttachedToGroups(): Promise<void> {
    const vehicles = (await this._db.instance.query_async(
      `SELECT
        v.id,
        v.modelHash,
        v.type,
        v.owningPersistableId,
        v.colorPrimary,
        v.colorSecondary,
        p.lastKnownPosX,
        p.lastKnownPosY,
        p.lastKnownPosZ,
        p.lastKnownRotX,
        p.lastKnownRotY,
        p.lastKnownRotZ
      FROM vehicles v
      LEFT JOIN persistables p
        ON p.id = v.owningPersistableId
      WHERE EXISTS (
        SELECT 1
        FROM vehicles_to_groups vtg
        WHERE vtg.vehicleId = v.id
      )`
    )) as Vehicle[];

    for (const vehicle of vehicles) {
      this._vehicles.spawn(
        vehicle.modelHash,
        vehicle.type,
        vehicle.colorPrimary,
        vehicle.colorSecondary,
        [vehicle.lastKnownPosX, vehicle.lastKnownPosY, vehicle.lastKnownPosZ],
        [vehicle.lastKnownRotX, vehicle.lastKnownRotY, vehicle.lastKnownRotZ]
      );
    }

    console.log(
      `${vehicles.length} vehicles have been eagerly spawned. (cause: Attached to Groups)`
    );
  }

}
