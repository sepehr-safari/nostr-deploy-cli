import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  Event as NostrEvent,
  SimplePool,
} from 'nostr-tools';
import 'websocket-polyfill';
import { ConfigManager } from './config';

export class NostrManager {
  private pool: SimplePool;
  private config: ConfigManager | null = null;

  constructor() {
    this.pool = new SimplePool();
  }

  private async getConfig(): Promise<ConfigManager> {
    if (!this.config) {
      this.config = await ConfigManager.getInstance();
    }
    return this.config;
  }

  public generateKeyPair(): { privateKey: string; publicKey: string; nsec: string; npub: string } {
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);

    const nsec = nip19.nsecEncode(privateKey);
    const npub = nip19.npubEncode(publicKey);

    return {
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey,
      nsec,
      npub,
    };
  }

  public parseNostrKey(key: string): { type: 'nsec' | 'npub'; data: Uint8Array } {
    try {
      const decoded = nip19.decode(key);
      return { type: decoded.type as 'nsec' | 'npub', data: decoded.data as Uint8Array };
    } catch (error) {
      throw new Error(`Invalid Nostr key format: ${key}`);
    }
  }

  public async publishEvent(
    content: string,
    kind: number = 1,
    tags: string[][] = []
  ): Promise<string> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();

    if (!userConfig.nostr?.privateKey) {
      throw new Error('No private key configured. Run `nostr-deploy auth` first.');
    }

    const privateKeyBytes = new Uint8Array(Buffer.from(userConfig.nostr.privateKey, 'hex'));

    const event = finalizeEvent(
      {
        kind,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content,
      },
      privateKeyBytes
    );

    const relays = userConfig.nostr.relays || [];
    if (relays.length === 0) {
      throw new Error('No relays configured');
    }

    try {
      await Promise.all(this.pool.publish(relays, event));

      return event.id;
    } catch (error) {
      throw new Error(`Failed to publish event: ${error}`);
    }
  }

  public async fetchEvents(filter: any, relays?: string[]): Promise<NostrEvent[]> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const targetRelays = relays || userConfig.nostr?.relays || [];

    if (targetRelays.length === 0) {
      throw new Error('No relays available');
    }

    try {
      const events = await this.pool.querySync(targetRelays, filter);
      return Array.from(events);
    } catch (error) {
      throw new Error(`Failed to fetch events: ${error}`);
    }
  }

  public async publishDeploymentMetadata(deploymentInfo: {
    subdomain: string;
    fileHash: string;
    blossomUrl: string;
    siteName?: string;
  }): Promise<string> {
    const content = JSON.stringify({
      type: 'static-site-deployment',
      subdomain: deploymentInfo.subdomain,
      fileHash: deploymentInfo.fileHash,
      blossomUrl: deploymentInfo.blossomUrl,
      siteName: deploymentInfo.siteName,
      deployedAt: new Date().toISOString(),
    });

    const tags = [
      ['t', 'static-site'],
      ['t', 'deployment'],
      ['subdomain', deploymentInfo.subdomain],
      ['hash', deploymentInfo.fileHash],
    ];

    return this.publishEvent(content, 30000, tags); // Using kind 30000 for app-specific data
  }

  public async getDeploymentHistory(publicKey?: string): Promise<any[]> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const targetPubkey = publicKey || userConfig.nostr?.publicKey;

    if (!targetPubkey) {
      throw new Error('No public key provided');
    }

    const filter = {
      authors: [targetPubkey],
      kinds: [30000],
      '#t': ['static-site', 'deployment'],
    };

    const events = await this.fetchEvents(filter);

    return events
      .map((event) => {
        try {
          const content = JSON.parse(event.content);
          return {
            ...content,
            eventId: event.id,
            createdAt: new Date(event.created_at * 1000),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  public async close(): Promise<void> {
    if (this.config) {
      const userConfig = this.config.getConfig();
      const relays = userConfig.nostr?.relays || [];
      this.pool.close(relays);
    } else {
      this.pool.close([]);
    }
  }
}
