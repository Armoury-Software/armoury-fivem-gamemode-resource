import { Injectable } from 'injection-js';

@Injectable()
export class PedPopulationConfig {
  public constructor() {
    this.disableGameNPCs();
  }

  private disableGameNPCs(): void {
    Cfx.Server.SetRoutingBucketPopulationEnabled(0, false);
  }
}
