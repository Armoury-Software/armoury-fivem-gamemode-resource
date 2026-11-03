import { Resource, ResourceRef } from '@armoury/fivem-framework-server';
import { Vehicle } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { PersistableRepository } from '../persistable/persistable.repository';

@Injectable()
export class VehicleRepository {

  public constructor(
    @Resource('oxmysql') private readonly _db: ResourceRef,
    private readonly _persistables: PersistableRepository
  ) {}

  public async create(
    modelHash: string | number,
		type: string,
    colorPrimary: number,
    colorSecondary: number,
    [posX, posY, posZ]: [number, number, number],
    [rotX, rotY, rotZ]: [number, number, number]
  ): Promise<Vehicle> {
    const persistable = await this._persistables.create(
      null, [posX, posY, posZ], [rotX, rotY, rotZ]
    );

    let id: number;
    try {
      id = await this._db.instance.insert_async(
        `INSERT INTO vehicles (
          modelHash, type, owningPersistableId, colorPrimary, colorSecondary
        ) VALUES (?, ?, ?, ?, ?)`,
        [modelHash.toString(), type, persistable.id, colorPrimary, colorSecondary]
      );

      if (!id) {
        throw new Error('Failed to insert vehicle.');
      }
    } catch (error) {
      await this._db.instance.query_async('DELETE FROM persistables WHERE id = ?', [persistable.id]);
      throw error;
    }

    return {
      id,
      modelHash,
      type,
      owningPersistableId: persistable.id,
      colorPrimary,
      colorSecondary,
      lastKnownPosX: posX,
      lastKnownPosY: posY,
      lastKnownPosZ: posZ,
      lastKnownRotX: rotX,
      lastKnownRotY: rotY,
      lastKnownRotZ: rotZ
    };
  }

}
