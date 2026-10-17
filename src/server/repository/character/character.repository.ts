import { Resource, ResourceRef } from '@armoury/fivem-framework-server';
import { Character } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

@Injectable()
export class CharacterRepository {
  public constructor(@Resource('oxmysql') private readonly _db: ResourceRef) {}

  public async findById(id: number): Promise<Character | null> {
    const result = await this._db.instance.query_async(`SELECT * FROM characters WHERE id = ? LIMIT 1`, [id]);

    if (!result.length) {
      return null;
    }

    return this.rowToCharacter(result[0]);
  }

  public async findByAccountId(accountId: number): Promise<Character[]> {
    const result = await this._db.instance.query_async(`SELECT * FROM characters WHERE accountId = ?`, [accountId]);

    return result.map((row: any) => this.rowToCharacter(row));
  }

  public async create(
    accountId: number,
    firstName: string,
    lastName: string,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): Promise<Character> {
    const id = await this._db.instance.insert_async(
      `INSERT INTO characters (accountId, firstName, lastName,
        lastLocationPosX, lastLocationPosY, lastLocationPosZ,
        lastLocationRotX, lastLocationRotY, lastLocationRotZ
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId, firstName, lastName, position.x, position.y, position.z, rotation.x, rotation.y, rotation.z]
    );

    return new Character(id, accountId, 0, 'en-US', firstName, lastName, position, rotation, new Date());
  }

  private rowToCharacter(row: any): Character {
    return new Character(
      row.id,
      row.accountId,
      row.hoursPlayed,
      row.language,
      row.firstName,
      row.lastName,
      { x: row.lastLocationPosX, y: row.lastLocationPosY, z: row.lastLocationPosZ },
      { x: row.lastLocationRotX, y: row.lastLocationRotY, z: row.lastLocationRotZ },
      new Date()
    );
  }
}
