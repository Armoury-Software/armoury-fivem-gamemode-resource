import { Resource, ResourceRef } from '@armoury/fivem-framework-server';
import { PersistableService, Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

@Injectable()
export class StashRepository {
  public constructor(
    @Resource('oxmysql') private readonly _db: ResourceRef,
    private readonly _persistables: PersistableService
  ) {}

  public async create(
    maxSlots: number,
    type: string,
    maxWeight: number | null = null,
    owningCharacterId: number | null = null,
    [posX, posY, posZ]: [number?, number?, number?] = [],
    [rotX, rotY, rotZ]: [number?, number?, number?] = []
  ): Promise<Stash> {
    const persistable = await this._persistables.create(
      owningCharacterId,
      posX != null && posY != null && posZ != null ? [posX, posY, posZ] : null,
      rotX != null && rotY != null && rotZ != null ? [rotX, rotY, rotZ] : null
    );

    const id = await this._db.instance.insert_async(
      `INSERT INTO stashes (owningPersistableId, type, maxSlots, maxWeight) VALUES (?, ?, ?, ?)`,
      [persistable.id, type, maxSlots, maxWeight]
    );

    return {
      id,
      type,
      maxSlots,
      maxWeight: maxWeight ?? Number.MAX_SAFE_INTEGER,
      owningPersistableId: persistable.id,
      slots: new Array(maxSlots).fill(null),
    };
  }

  public async fetch(...ids: number[]): Promise<Stash[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => '?').join(', ');

    const rows = await this._db.instance.query_async(
      `SELECT
        s.id,
        s.owningPersistableId,
        s.type,
        s.maxSlots,
        s.maxWeight,
        ss.itemIdentifier,
        ss.amount,
        ss.metadata,
        ss.slotIndex
      FROM stashes s
      LEFT JOIN stashes_slots ss ON ss.stashId = s.id
      WHERE s.id IN (${placeholders})
      ORDER BY s.id, ss.slotIndex`,
      ids
    );

    const stashes = new Map<number, Stash>();

    for (const row of rows) {
      let stash = stashes.get(row.id);

      if (!stash) {
        stash = {
          id: row.id,
          owningPersistableId: row.owningPersistableId,
          maxSlots: row.maxSlots,
          maxWeight: row.maxWeight,
          type: row.type,
          slots: new Array(row.maxSlots).fill(null),
        };

        stashes.set(row.id, stash);
      }

      if (row.slotIndex !== null) {
        const slot = {
          stashId: row.id,
          itemIdentifier: row.itemIdentifier,
          amount: row.amount,
          slotIndex: row.slotIndex,
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata ?? null,
        };
        stash.slots![row.slotIndex] = slot;
      }
    }

    return Array.from(stashes.values());
  }

  public async fetchByType(type: string, owningPersistableId?: number): Promise<Stash[]> {
    const rows = await this._db.instance.query_async(
      `SELECT id FROM stashes WHERE type = ?${owningPersistableId !== undefined ? ' AND owningPersistableId = ?' : ''}`,
      owningPersistableId !== undefined ? [type, owningPersistableId] : [type]
    );

    return this.fetch(...rows.map((row: { id: number }) => row.id));
  }

  public async saveSlots(stash: Stash): Promise<void> {
    if (!Array.isArray(stash.slots)) {
      throw new Error(`Cannot save stash ${stash.id} without its slots.`);
    }

    const queries: Array<{ query: string; values: unknown[] }> = [
      { query: 'DELETE FROM stashes_slots WHERE stashId = ?', values: [stash.id] },
    ];
    const placeholders: string[] = [];
    const values: unknown[] = [];
    for (let slotIndex = 0; slotIndex < stash.slots.length; slotIndex++) {
      const slot = stash.slots[slotIndex] as (NonNullable<Stash['slots'][number]> & { metadata?: unknown }) | null;
      if (slot == null) {
        continue;
      }

      placeholders.push('(?, ?, ?, ?, ?)');
      values.push(
        stash.id, slotIndex, slot.itemIdentifier, slot.amount,
        slot.metadata == null ? null : JSON.stringify(slot.metadata)
      );
    }

    if (values.length > 0) {
      queries.push({
        query: `INSERT INTO stashes_slots (stashId, slotIndex, itemIdentifier, amount, metadata) VALUES ${placeholders.join(', ')}`,
        values,
      });
    }

    if (!await this._db.instance.transaction_async(queries)) {
      throw new Error(`Failed to persist slots for stash ${stash.id}.`);
    }
  }
  
}
