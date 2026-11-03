import { Export } from '@armoury/fivem-framework-server';
import { Persistable } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { PersistableRepository } from '../../repository/persistable/persistable.repository';

@Injectable()
export class PersistableService {
  public constructor(private readonly _repository: PersistableRepository) {}

  @Export()
  public async createPersistable(
    ownerId: number | null = null,
    lastKnownPosition: [number, number, number] | null = null,
    lastKnownRotation: [number, number, number] | null = [0, 0, 0]
  ): Promise<Persistable> {
    const persistable = await this._repository.create(ownerId, lastKnownPosition, lastKnownRotation);

    console.log(
      `A new persistable (id: ${persistable.id}) has been created. ` + `Owner: ${ownerId ? 'ID ' + ownerId : 'None'}.`
    );

    return persistable;
  }

  @Export()
  public getPersistableCreateQuery(
    ownerId: number | null = null,
    lastKnownPosition: [number, number, number] | null = null,
    lastKnownRotation: [number, number, number] | null = [0, 0, 0]
  ): { query: string; values: unknown[] } {
    return this._repository.getCreateQuery(ownerId, lastKnownPosition, lastKnownRotation);
  }
}
