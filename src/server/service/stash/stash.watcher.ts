import { EventListener } from '@armoury/fivem-framework-server';
import { Injectable } from 'injection-js';

@Injectable()
export class StashWatcher {

  private _stashWatches = new Map<number, StashWatch>();
  private _playersInspectingStashes = new Map<number, Set<number>>();

  @EventListener()
  protected onPlayerConnect(): void {
    const playerId = Cfx.source;
    if (this._playersInspectingStashes.has(playerId)) {
      console.error(
        `Player [${Cfx.Server.GetPlayerName(playerId.toString())} (playerId: ${playerId})]`,
        'has joined, but they already were cached as \'inspecting a stash\'. This should',
        'never happen. Player kicked.'
      );

      Cfx.Server.DropPlayer(
        playerId.toString(),
        'An unknown error has occured. Please try creating a bug report. (Error Code: STW-000)'
      );
    }
  }

  @EventListener()
  protected onPlayerDisconnect(): void {
    const playerId = Cfx.source;
    if (this._playersInspectingStashes.has(playerId)) {
      // for (const test of this._playersInspectingStashes.get(playerId)!.values()) {

      // }
    }
  }

}

class StashWatch {
  public readonly playerIds: Array<number> = [];
}
