import { Resource, ResourceRef } from '@armoury/fivem-framework-server';
import { Account } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

@Injectable()
export class AccountRepository {
  public constructor(@Resource('oxmysql') private readonly _db: ResourceRef) {}

  public async create(platformId: string, lastKnownName: string): Promise<Account> {
    const id = await this._db.instance.insert_async(
      `INSERT INTO accounts (platformId, lastKnownName)
      VALUES (?, ?)`,
      [platformId, lastKnownName]
    );

    return new Account(id, lastKnownName, platformId);
  }

  public async exists(platformId: string): Promise<boolean> {
    const result = await this._db.instance.scalar_async(
      `SELECT EXISTS(
        SELECT 1
        FROM accounts
        WHERE platformId = ?
      )`,
      [platformId]
    );

    return result === 1;
  }

  public async isPinProtected(platformId: string): Promise<boolean> {
    const result = await this._db.instance.scalar_async(
      `SELECT EXISTS(
        SELECT 1
        FROM accounts
        WHERE platformId = ? AND pin IS NOT NULL
      )`,
      [platformId]
    );

    return result === 1;
  }

  public async findByCredentials(platformId: string, pin?: number): Promise<Account | undefined> {
    const hashedPin = pin?.toString() ?? undefined; // TODO: Don't do this! Instead, hash the pin with scrypt from node:crypto

    const rows = (await this._db.instance.query_async(
      `SELECT id, lastKnownName, email
      FROM accounts
      WHERE platformId = ? AND pin <=> ?
      LIMIT 1;`,
      [platformId, hashedPin ?? null]
    )) as Array<Account>;

    if (rows.length === 0) {
      return undefined;
    }

    return new Account(rows[0].id, rows[0].lastKnownName, platformId, rows[0].email);
  }
}
