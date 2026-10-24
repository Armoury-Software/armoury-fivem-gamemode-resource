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
        stash.slots![row.slotIndex] = {
          stashId: row.id,
          itemIdentifier: row.itemIdentifier,
          amount: row.amount,
          slotIndex: row.slotIndex,
        };
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

  public async reorderSlots(
    stashId: number,
    maxSlots: number,
    actions: StashReorderAction[],
  ): Promise<void> {
    if (actions.length === 0) return;

    const sources = new Set<number>();
    const destinations = new Set<number>();

    for (const action of actions) {
      const { previousIndex, currentIndex } = action;

      if (
        action.type !== 'reorder' ||
        !Number.isSafeInteger(previousIndex) ||
        !Number.isSafeInteger(currentIndex) ||
        previousIndex < 0 ||
        currentIndex < 0 ||
        previousIndex >= maxSlots ||
        currentIndex >= maxSlots ||
        sources.has(previousIndex) ||
        destinations.has(currentIndex)
      ) {
        throw new Error('Invalid stash reorder action.');
      }

      sources.add(previousIndex);
      destinations.add(currentIndex);
    }

    // Require a complete permutation of the affected indices.
    for (const destination of destinations) {
      if (!sources.has(destination)) {
        throw new Error('Incomplete stash reorder permutation.');
      }
    }

    // Temporary indices start beyond the normal slot range.
    const offset = maxSlots;

    if (!Number.isSafeInteger(maxSlots * 2 - 1) ||
        maxSlots * 2 - 1 > 2147483647) {
      throw new Error('Stash slot range is too large.');
    }

    const placeholders = actions.map(() => '?').join(', ');
    const caseStatements = actions
      .map(() => 'WHEN ? THEN ?')
      .join(' ');

    const sourceIndices = actions.map(a => a.previousIndex);

    // Phase 1: Move occupied source slots into temporary space.
    const temporaryQuery = `
      UPDATE stashes_slots
      SET slotIndex = slotIndex + ?
      WHERE stashId = ?
        AND slotIndex IN (${placeholders})
    `;

    // Phase 2: Move temporary slots to their final positions.
    const finalQuery = `
      UPDATE stashes_slots
      SET slotIndex = CASE slotIndex
        ${caseStatements}
        ELSE slotIndex
      END
      WHERE stashId = ?
        AND slotIndex IN (${placeholders})
    `;

    const success = await this._db.instance.transaction_async([
      {
        query: temporaryQuery,
        values: [offset, stashId, ...sourceIndices]
      },
      {
        query: finalQuery,
        values: [
          ...actions.flatMap(a => [
            a.previousIndex + offset,
            a.currentIndex
          ]),
          stashId,
          ...sourceIndices.map(index => index + offset)
        ]
      }
    ]);

    if (!success) {
      throw new Error('Failed to reorder stash slots.');
    }
  }
  
}

// TODO: Move to lib
interface StashReorderAction {
  type: 'reorder';
  previousIndex: number;
  currentIndex: number;
}
