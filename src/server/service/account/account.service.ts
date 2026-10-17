import { EventListener, Session } from '@armoury/fivem-framework-server';
import { Account as ɵAccount } from '@armoury/fivem-roleplay-gamemode-common';
import { Injectable } from 'injection-js';

import { AccountRepository } from '../../repository/account/account.repository';

@Injectable()
export class AccountService {
  private _accountsLoggedIn: Map<number, Account> = new Map();
  private _playerIdsToAccountIds: Map<number, number> = new Map();

  public constructor(private readonly _accountRepository: AccountRepository) {}

  public findByPlayerId(playerId: number): Account | null {
    return this._accountsLoggedIn.get(playerId) ?? null;
  }

  public drop(accountId: number): void {
    if (!this._accountsLoggedIn.has(accountId)) {
      console.warn(
        'A player has disconnected and their account should have been dropped, but ' +
          'no account was cached in the list for it. This should never happen.'
      );

      return;
    }

    const playerId = this._accountsLoggedIn.get(accountId)!.playerId;
    if (!this._playerIdsToAccountIds.has(playerId)) {
      console.warn(
        'A player has disconnected and it had a valid principal, but no account ' +
          'was cached in the playerId-accountId map for it. This should never happen.'
      );
    }

    this._accountsLoggedIn.delete(accountId);
    this._playerIdsToAccountIds.delete(playerId);

    console.log(
      `Player [${Cfx.Server.GetPlayerName(
        playerId.toString()
      )} (${playerId})] (accountId: ${accountId}) disconnected. Account authentication removed.`
    );
  }

  private async fetchAccount(session: Session): Promise<{ account: Account; isCreated: boolean }> {
    let account: Account;
    let isCreated = false;
    if (await this._accountRepository.exists(session.platformId)) {
      if (await this._accountRepository.isPinProtected(session.platformId)) {
        // TODO:  Implement this - If it's pin protected, it should ask the user for a pin, then proceed.
        //        When this happens, a promise race will happen: one promise will wait for 2 minutes, ..
        //        .. and one promise will resolve once the pin has been inputted. "fetchAccount" will NOT
        //        .. continue until either of those ends. If 2-minutes promise wins the race, the player
        //        .. gets kicked.

        console.log(
          `An account exists for [${Cfx.Server.GetPlayerName(session.id.toString())} ` +
            `(${session.id})] (platformId: ${session.platformId}), but the account is ` +
            'pin-protected. Awaiting PIN confirmation.'
        );

        Cfx.Server.DropPlayer(session.id.toString(), 'PIN-protected sessions are not yet implemented.');
        throw new Error('PIN-protected sessions are not yet implemented.');
      } else {
        const result = await this._accountRepository.findByCredentials(session.platformId);
        if (!result) {
          throw new Error("An account with no pin has been detected, but couldn't fetch the account.");
        }

        account = <Account>result;
        isCreated = true;

        console.log(
          `An account has been found for [${Cfx.Server.GetPlayerName(session.id.toString())} ` +
            `(${session.id})] (platformId: ${session.platformId}). Account ID: ${account.id}.`
        );
      }
    } else {
      account = <Account>await this._accountRepository.create(session.platformId, session.lastKnownName);

      console.log(
        `An account was not found for [${Cfx.Server.GetPlayerName(session.id.toString())} ` +
          `(${session.id})] (platformId: ${session.platformId}). An account has been created ` +
          `for them. (Account ID: ${account.id}.)`
      );
    }

    account.playerId = session.id;

    return { account, isCreated };
  }

  @EventListener()
  protected async onPlayerSessionCreated(session: Session) {
    if (this._playerIdsToAccountIds.has(session.id)) {
      console.warn('A player tried to authenticate but already has an authentication. This should not happen.');
      Cfx.Server.DropPlayer(
        session.id.toString(),
        'You already have a session. Please reconnect. (Error code: AUT-001)'
      );
      return;
    }

    const result = await this.fetchAccount(session);
    if (this._accountsLoggedIn.has(result.account.id)) {
      console.warn('A player tried to authenticate but already has an authentication. This should not happen.');
      Cfx.Server.DropPlayer(
        session.id.toString(),
        'You already have a session. Please reconnect. (Error code: AUT-002)'
      );
      return;
    }

    this._accountsLoggedIn.set(result.account.id, result.account);
    this._playerIdsToAccountIds.set(session.id, result.account.id);

    // session.setServerClaim('accountId', result.account.id); // TODO: Put this back

    console.log(
      `Player [${Cfx.Server.GetPlayerName(session.id.toString())} (${session.id})] authenticated (accountId: ${
        result.account.id
      }).`
    );

    if (result.isCreated) {
      Cfx.emit('armoury:account-created', result.account, session);
      Cfx.emitNet('armoury:account-created', session.id);
    } else {
      Cfx.emit('armoury:account-authenticated', result.account, session);
      Cfx.emitNet('armoury:account-authenticated', session.id);
    }
  }
}

class Account extends ɵAccount {
  public playerId!: number;
}
