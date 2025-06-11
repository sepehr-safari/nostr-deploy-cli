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

export interface StaticFileInfo {
  path: string;
  sha256: string;
}

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
      throw new Error('No private key configured. Run `nostr-deploy-cli auth` first.');
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

  /**
   * Publish static file events according to Pubkey Static Websites NIP
   * Kind 34128 events with d (absolute path) and x (sha256 hash) tags
   */
  public async publishStaticFileEvents(files: StaticFileInfo[]): Promise<string[]> {
    const eventIds: string[] = [];

    for (const file of files) {
      const eventId = await this.publishEvent(
        '', // Empty content as per NIP
        34128, // Kind for static file definition
        [
          ['d', file.path], // Absolute path ending with filename and extension
          ['x', file.sha256], // SHA256 hash of the file
        ]
      );
      eventIds.push(eventId);
    }

    return eventIds;
  }

  /**
   * Publish a BUD-03 user servers event (kind 10063) to specify Blossom servers
   */
  public async publishUserServersEvent(blossomServers: string[]): Promise<string> {
    const content = '';
    const tags = blossomServers.map((server) => ['server', server]);

    return this.publishEvent(content, 10063, tags);
  }

  /**
   * Get the npub (bech32 encoded public key) for subdomain generation
   */
  public async getNpubSubdomain(): Promise<string> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();

    if (!userConfig.nostr?.publicKey) {
      throw new Error('No public key configured. Run `nostr-deploy-cli auth` first.');
    }

    // Convert hex public key to npub format
    const npub = nip19.npubEncode(userConfig.nostr.publicKey);
    return npub;
  }

  /**
   * Get the public key from private key (for auth flow)
   */
  public getPublicKeyFromPrivate(privateKeyHex: string): string {
    const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyHex, 'hex'));
    return getPublicKey(privateKeyBytes);
  }

  public async publishDeploymentMetadata(deploymentInfo: {
    npubSubdomain: string;
    files: StaticFileInfo[];
    blossomServers: string[];
  }): Promise<{ staticFileEventIds: string[]; userServersEventId: string }> {
    console.log('📡 Publishing static file events (kind 34128)...');
    const staticFileEventIds = await this.publishStaticFileEvents(deploymentInfo.files);

    console.log('📡 Publishing user servers event (kind 10063)...');
    const userServersEventId = await this.publishUserServersEvent(deploymentInfo.blossomServers);

    return {
      staticFileEventIds,
      userServersEventId,
    };
  }

  public async getStaticFileEvents(publicKey?: string, path?: string): Promise<NostrEvent[]> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const targetPubkey = publicKey || userConfig.nostr?.publicKey;

    if (!targetPubkey) {
      throw new Error('No public key provided');
    }

    const filter: any = {
      authors: [targetPubkey],
      kinds: [34128],
    };

    if (path) {
      filter['#d'] = [path];
    }

    return this.fetchEvents(filter);
  }

  public async getUserServersEvent(publicKey?: string): Promise<NostrEvent | null> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const targetPubkey = publicKey || userConfig.nostr?.publicKey;

    if (!targetPubkey) {
      throw new Error('No public key provided');
    }

    const filter = {
      authors: [targetPubkey],
      kinds: [10063],
      limit: 1,
    };

    const events = await this.fetchEvents(filter);
    return events.length > 0 ? events[0] : null;
  }

  /**
   * Legacy method - kept for compatibility but should transition to new NIP
   */
  public async getDeploymentHistory(publicKey?: string): Promise<any[]> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const targetPubkey = publicKey || userConfig.nostr?.publicKey;

    if (!targetPubkey) {
      throw new Error('No public key provided');
    }

    // Look for static file events instead of deployment metadata
    const events = await this.getStaticFileEvents(targetPubkey);

    // Group by deployment (could be based on timestamp proximity)
    const deployments = new Map();

    events.forEach((event) => {
      const dTag = event.tags.find((t) => t[0] === 'd')?.[1];
      const xTag = event.tags.find((t) => t[0] === 'x')?.[1];

      if (dTag && xTag) {
        const deploymentKey = Math.floor(event.created_at / 3600); // Group by hour
        if (!deployments.has(deploymentKey)) {
          deployments.set(deploymentKey, {
            files: [],
            createdAt: new Date(event.created_at * 1000),
            eventId: event.id,
          });
        }
        deployments.get(deploymentKey).files.push({ path: dTag, hash: xTag });
      }
    });

    return Array.from(deployments.values());
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
