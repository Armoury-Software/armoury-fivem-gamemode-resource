import { Config, EVENT_DIRECTIONS, EventListener, Session, SessionService } from '@armoury/fivem-framework-server';
import { Account, Character } from '@armoury/fivem-roleplay-gamemode-server';
import { Injectable } from 'injection-js';

import { AccountService } from '../account/account.service';
import { CharacterRepository } from '../../repository/character/character.repository';
import { PersistableService } from '../persistable/persistable.service';

@Injectable()
export class CharacterService {
  private _charactersLoggedIn: Map<number, Character> = new Map();
  private _playerIdsToCharacterIds: Map<number, number> = new Map();

  public constructor(
    @Config('spawn') private readonly _spawnConfig: SpawnConfig,
    private readonly _repository: CharacterRepository,
    private readonly _accountService: AccountService,
    private readonly _persistableService: PersistableService,
    private readonly _sessionService: SessionService
  ) {}

  public async pick(playerId: number, character: Character): Promise<void>;
  public async pick(playerId: number, characterId: number): Promise<void>;
  public async pick(playerId: number, characterOrId: Character | number): Promise<void> {
    // TODO: Check if that player actually owns that characterId

    const character =
      characterOrId instanceof Character ? characterOrId : await this._repository.findById(characterOrId);

    if (!character) {
      Cfx.Server.DropPlayer(
        playerId.toString(),
        "There's been an error while selecting your character. Please try again. (Error code: CSP-000)"
      );

      console.error(
        "A player has picked a character, but couldn't find that character ID inside the database. " +
          'This should never happen, and the player has been kicked.'
      );

      return;
    }

    this._charactersLoggedIn.set(character.id, character);
    this._playerIdsToCharacterIds.set(playerId, character.id);

    this._sessionService.setPlayerPrincipal(playerId, character.id);

    const session = this._sessionService.getSessionByPrincipal(character.id);
    const accountId = this._accountService.findByPlayerId(playerId)?.id;

    session.setState('principal', character.id, true);
    session.setState('firstName', character.firstName, true);
    session.setState('lastName', character.lastName, true);
    session.setState('language', character.language);
    session.setState('hoursPlayed', character.hoursPlayed);
    session.setServerClaim('persistableId', character.persistableId);

    console.log(
      `Player [${Cfx.Server.GetPlayerName(
        playerId.toString()
      )} (${playerId})] (accountId: ${accountId}) just logged into character ` +
        `[${character.firstName} ${character.lastName} (${character.id})]`
    );

    Cfx.emit('armoury:character-logged-into', playerId, character);
  }

  public async create(account: Account): Promise<Character> {
    const position: [number, number, number] = [
      this._spawnConfig.position.x,
      this._spawnConfig.position.y,
      this._spawnConfig.position.z,
    ];

    const rotation: [number, number, number] = [
      this._spawnConfig.rotation.x,
      this._spawnConfig.rotation.y,
      this._spawnConfig.rotation.z,
    ];

    const character = await this._repository.create(
      account.id,
      '',
      '',
      this._spawnConfig.position,
      this._spawnConfig.rotation
    );

    const persistable = await this._persistableService.create(character.id, position, rotation);
    character.persistableId = persistable.id;

    return character;
  }

  private async showCharacterSelection(account: Account, session: Session) {
    const characters = await this._repository.findByAccountId(account.id);
    if (!characters.length) {
      const character = await this.create(account);
      await this.pick(session.id, character.id);
      return;
    }

    await this.pick(session.id, characters[0]); // TODO:  Don't do this - it's only for debugging. Instead, launch
    //        .. the character creation process
  }

  @EventListener({ direction: EVENT_DIRECTIONS.SERVER_TO_SERVER })
  protected onAccountCreated(account: Account, session: Session): void {
    this.showCharacterSelection(account, session);
  }

  @EventListener({ direction: EVENT_DIRECTIONS.SERVER_TO_SERVER })
  protected onAccountAuthenticated(account: Account, session: Session): void {
    this.showCharacterSelection(account, session);
  }

  @EventListener({ direction: EVENT_DIRECTIONS.SERVER_TO_SERVER })
  protected onPlayerSessionDestroyed(playerId: number, principal: number | null) {
    if (principal == null) {
      // Player was not logged in
      return;
    }

    if (!this._charactersLoggedIn.has(principal)) {
      console.warn(
        'A player has disconnected and it had a valid principal, but no character ' +
          'was cached in the list for it. This should never happen.'
      );

      return;
    }

    if (!this._playerIdsToCharacterIds.has(playerId)) {
      console.warn(
        'A player has disconnected and it had a valid principal, but no character ' +
          'was cached in the playerId-accountId map for it. This should never happen.'
      );
    }

    const character = this._charactersLoggedIn.get(principal)!;

    this._charactersLoggedIn.delete(principal);
    this._playerIdsToCharacterIds.delete(playerId);

    this._accountService.drop(character.accountId);

    console.log(
      `Player [${Cfx.Server.GetPlayerName(
        playerId.toString()
      )} (${playerId})] (characterId: ${principal}) disconnected. Character authentication removed.`
    );
  }
}

interface SpawnConfig {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}
