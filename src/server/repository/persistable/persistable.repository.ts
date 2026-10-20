import { Resource, ResourceRef } from '@armoury/fivem-framework-server';
import { Persistable } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

@Injectable()
export class PersistableRepository {
  public constructor(@Resource('oxmysql') private readonly _db: ResourceRef) {}

  public async create(
    ownerId: number | null = null,
    lastKnownPosition: [number, number, number] | null = null,
    lastKnownRotation: [number, number, number] | null = [0, 0, 0]
  ): Promise<Persistable> {
    const id = await this._db.instance.insert_async(
      `INSERT INTO persistables (
        owner, lastKnownPosX, lastKnownPosY, lastKnownPosZ,
        lastKnownRotX, lastKnownRotY, lastKnownRotZ
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId ?? null,
        lastKnownPosition?.[0] ?? null,
        lastKnownPosition?.[1] ?? null,
        lastKnownPosition?.[2] ?? null,
        lastKnownRotation?.[0] ?? 0,
        lastKnownRotation?.[1] ?? 0,
        lastKnownRotation?.[2] ?? 0,
      ]
    );

    return new Persistable(
      id,
      ownerId,
      lastKnownPosition != null
        ? {
            x: lastKnownPosition[0],
            y: lastKnownPosition[1],
            z: lastKnownPosition[2],
          }
        : null,
      lastKnownRotation != null
        ? {
            x: lastKnownRotation[0],
            y: lastKnownRotation[1],
            z: lastKnownRotation[2],
          }
        : { x: 0, y: 0, z: 0 }
    );
  }

  public async findById(id: number): Promise<Persistable | null> {
    const result = await this._db.instance.query_async(`SELECT * FROM persistables WHERE id = ? LIMIT 1`, [id]);

    if (!result.length) {
      return null;
    }

    return this.rowToPersistable(result[0]);
  }

  private rowToPersistable(row: any): Persistable {
    return new Persistable(
      row.id,
      row.owner,
      { x: row.lastKnownPosX, y: row.lastKnownPosY, z: row.lastKnownPosZ },
      { x: row.lastKnownRotX, y: row.lastKnownRotY, z: row.lastKnownRotZ }
    );
  }
}
