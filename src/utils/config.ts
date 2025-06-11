import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { UserConfig } from '../types';

const CONFIG_DIR = path.join(os.homedir(), '.nostr-deploy-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Partial<UserConfig> = {};
  private initialized = false;

  private constructor() {
    // Don't call loadConfig here since constructor can't be async
  }

  public static async getInstance(): Promise<ConfigManager> {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }

    if (!ConfigManager.instance.initialized) {
      await ConfigManager.instance.loadConfig();
      ConfigManager.instance.initialized = true;
    }

    return ConfigManager.instance;
  }

  private async loadConfig(): Promise<void> {
    try {
      if (await fs.pathExists(CONFIG_FILE)) {
        const configData = await fs.readJSON(CONFIG_FILE);
        this.config = configData;
      } else {
        // Create default config
        this.config = {
          nostr: {
            publicKey: '',
            relays: ['wss://nos.lol', 'wss://ditto.pub/relay', 'wss://relay.damus.io'],
          },
          blossom: {
            serverUrl: 'https://cdn.hzrd149.com',
          },
          deployment: {
            baseDomain: 'nostrdeploy.com',
          },
        };
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Error loading config:', error);
      throw error;
    }
  }

  public async saveConfig(): Promise<void> {
    try {
      await fs.ensureDir(CONFIG_DIR);
      await fs.writeJSON(CONFIG_FILE, this.config, { spaces: 2 });
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  public getConfig(): Partial<UserConfig> {
    return this.config;
  }

  public async updateConfig(updates: Partial<UserConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  public async setNostrKey(privateKey: string, publicKey: string): Promise<void> {
    if (!this.config.nostr) {
      this.config.nostr = { publicKey: '', relays: [] };
    }
    this.config.nostr.privateKey = privateKey;
    this.config.nostr.publicKey = publicKey;
    await this.saveConfig();
  }

  public async setNostrRelays(relays: string[]): Promise<void> {
    if (!this.config.nostr) {
      this.config.nostr = { publicKey: '', relays: [] };
    }
    this.config.nostr.relays = relays;
    await this.saveConfig();
  }

  public async setBlossomServer(serverUrl: string): Promise<void> {
    if (!this.config.blossom) {
      this.config.blossom = { serverUrl: '' };
    }
    this.config.blossom.serverUrl = serverUrl;
    await this.saveConfig();
  }

  public async setBaseDomain(baseDomain: string): Promise<void> {
    if (!this.config.deployment) {
      this.config.deployment = {
        baseDomain: 'nostrdeploy.com',
      };
    }
    this.config.deployment.baseDomain = baseDomain;
    await this.saveConfig();
  }

  public isConfigured(): boolean {
    return !!(this.config.nostr?.publicKey && this.config.blossom?.serverUrl);
  }
}
