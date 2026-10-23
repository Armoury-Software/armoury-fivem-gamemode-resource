import { EventListener, Export } from '@armoury/fivem-framework-server';
import { type Stash } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { StashRepository } from '../../repository/stash/stash.repository';
import { Subject } from 'rxjs';

@Injectable()
export class StashService {
  public readonly stashes = new Map<number, Stash>();
  public readonly playerStashAllowance = new Map<number, Set<number>>();

  private readonly _playerAllowedToStash$ = new Subject<[number, number]>();
  public get playerAllowedToStash$() { return this._playerAllowedToStash$.asObservable(); }

  private readonly _playerDisallowedFromStash$ = new Subject<[number, number]>();
  public get playerDisallowedFromStash$() { return this._playerDisallowedFromStash$.asObservable(); }

  public constructor(private readonly _repository: StashRepository) {}

  // TODO: public async createInWorldSpace

  /**
   * Before a player can make any change to a stash, they need to be allowed
   * access to that stash.
   * Access to a stash is not permanent, and it is revoked as soon as they
   * stop interaction with that stash.
   * @param playerId the playerId (NOT characterId/principal!)
   * @param toStashId the stashId the player is going to be allowed to use
   */
  @Export()
  public allowAccessToStash(playerId: number, toStashId: number): boolean {
    const allowance = this.playerStashAllowance.get(playerId);
    if (allowance?.has(toStashId)) {
      console.warn(
        `Player [${Cfx.Server.GetPlayerName(playerId.toString())} (playerId: ${playerId})]`,
        `was requested to be allowed to stash (id: ${toStashId}), but they already were`,
        'allowed to it. This should never happen. Doing nothing..'
      );
      return;
    }

    this.playerStashAllowance.set(
      playerId,
      new Set([...allowance ?? [], toStashId])
    );

    this._playerAllowedToStash$.next([playerId, toStashId]);
    console.log(`Player (id: ${playerId}) has received access to stash (id: ${toStashId})!`);
  }

  /**
   * Before a player can make any change to a stash, they need to be allowed
   * access to that stash.
   * Access to a stash is not permanent, and it is revoked as soon as they
   * stop interaction with that stash.
   * @param playerId the playerId (NOT characterId/principal!)
   * @param toStashId the stashId the player is going to be disallowed from
   */
  @Export()
  public disallowAccessToStash(playerId: number, fromStashId: number): boolean {
    const allowance = this.playerStashAllowance.get(playerId);
    if (!allowance?.has(fromStashId)) {
      console.warn(
        `Player [${Cfx.Server.GetPlayerName(playerId.toString())} (playerId: ${playerId})]`,
        `was requested to be disallowed from stash (id: ${fromStashId}), but they never even`,
        'were allowed to it. This should never happen. Doing nothing..'
      );
      return;
    }

    allowance.delete(fromStashId);
    this._playerDisallowedFromStash$.next([playerId, fromStashId]);

    if (!allowance.size) {
      this.playerStashAllowance.delete(playerId);
    }

    console.log(`Player (id: ${playerId}) has been revoked access to stash (id: ${fromStashId})!`);
  }

  @Export()
  public async findStashById(stashId: number): Promise<Stash | null> {
    return (await this.findStashes(stashId))?.[0] ?? null;
  }

  @Export()
  public findStashByIdImmediate(stashId: number): Stash | null {
    if (!this.stashes.has(stashId)) {
      return null;
    }

    return this.stashes.get(stashId)!;
  }

  @Export()
  public async findStashes(...stashIds: number[]): Promise<Stash[]> {
    const missingIds = new Set<number>();

    for (const stashId of stashIds) {
      if (!this.stashes.has(stashId)) {
        missingIds.add(stashId);
      }
    }

    if (missingIds.size > 0) {
      const fetchedStashes = await this._repository.fetch(...missingIds);

      for (const stash of fetchedStashes) {
        this.stashes.set(stash.id, stash);
      }
    }

    const stashes: Stash[] = [];

    for (const stashId of stashIds) {
      const stash = this.stashes.get(stashId);

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
      this.stashes.set(stash.id, stash);
    }

    return stashes;
  }

  @EventListener()
  protected onPlayerConnect(): void {
    const playerId = Cfx.source;
    if (this.playerStashAllowance.has(playerId)) {
      console.error(
        `Player [${Cfx.Server.GetPlayerName(playerId.toString())} (playerId: ${playerId})]`,
        'has joined, but they already were cached as \'allowed to a stash\'. This should',
        'never happen. Player kicked.'
      );

      Cfx.Server.DropPlayer(
        playerId.toString(),
        'An unknown error has occured. Please try creating a bug report. (Error Code: STW-000)'
      );
      return;
    }
  }

  @EventListener()
  protected onPlayerDisconnect(): void {
    const playerId = Cfx.source;
    if (this.playerStashAllowance.has(playerId)) {
      for (const stashId of this.playerStashAllowance.get(playerId)!) {
        this.disallowAccessToStash(playerId, stashId);
      }

      console.log(
        `Player [${Cfx.Server.GetPlayerName(playerId.toString())} (playerId: ${playerId})]`,
        'has disconnected, and their access to stashes has been released.'
      );
    }
  }
}
