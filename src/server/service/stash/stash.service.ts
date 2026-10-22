import { Export } from '@armoury/fivem-framework-server';
import { type Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { StashRepository } from '../../repository/stash/stash.repository';

@Injectable()
export class StashService {
  private _stashes = new Map<number, Stash>();

  public constructor(private readonly _repository: StashRepository) {}

  // TODO: public async createInWorldSpace

  @Export()
  public async findStashById(stashId: number): Promise<Stash | null> {
    return (await this.findStashes(stashId))?.[0] ?? null;
  }

  @Export()
  public findStashByIdImmediate(stashId: number): Stash | null {
    if (!this._stashes.has(stashId)) {
      return null;
    }

    return this._stashes.get(stashId)!;
  }

  @Export()
  public async findStashes(...stashIds: number[]): Promise<Stash[]> {
    const missingIds = new Set<number>();

    for (const stashId of stashIds) {
      if (!this._stashes.has(stashId)) {
        missingIds.add(stashId);
      }
    }

    if (missingIds.size > 0) {
      const fetchedStashes = await this._repository.fetch(...missingIds);

      for (const stash of fetchedStashes) {
        this._stashes.set(stash.id, stash);
      }
    }

    const stashes: Stash[] = [];

    for (const stashId of stashIds) {
      const stash = this._stashes.get(stashId);

      if (stash) {
        stashes.push(stash);
      }
    }

    console.log(
      `${stashIds.length} were requested from the database. ${missingIds.size} were already`,
      `cached, and ${stashes.length - missingIds.size} were taken fresh from the database.`
    );

    return stashes;
  }

  @Export()
  public findStashesImmediate(...stashIds: number[]): Array<Stash | null> {
    const stashes: Array<Stash | null> = [];

    for (const stashId of stashIds) {
      stashes.push(this.findStashByIdImmediate(stashId));
    }

    return stashes;
  }

  @Export()
  public async findStashesByType(type: string, owningPersistableId?: number): Promise<Stash[]> {
    const stashes = await this._repository.fetchByType(type, owningPersistableId);

    for (const stash of stashes) {
      this._stashes.set(stash.id, stash);
    }

    return stashes;
  }
}
