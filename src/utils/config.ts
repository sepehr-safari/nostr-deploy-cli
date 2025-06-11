import * as fs from 'fs-extra';
import * as path from 'path';
import { UserConfig } from '../types';

const CONFIG_FILE = '.env.nostr-deploy.local';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Partial<UserConfig> = {};
  private initialized = false;
  private projectPath: string;

  private constructor() {
    this.projectPath = process.cwd();
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

  public getConfigPath(): string {
    return path.join(this.projectPath, CONFIG_FILE);
  }

  public async hasLocalConfig(): Promise<boolean> {
    return await fs.pathExists(this.getConfigPath());
  }

  private async loadConfig(): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      if (await fs.pathExists(configPath)) {
        const envContent = await fs.readFile(configPath, 'utf-8');
        this.config = this.parseEnvFile(envContent);
      } else {
        // Create default config structure (don't save to file)
        this.config = {
          nostr: {
            publicKey: '',
            relays: ['wss://nos.lol', 'wss://ditto.pub/relay', 'wss://relay.damus.io'],
            pow: {
              enabled: true,
              targetDifficulty: 30,
            },
          },
          blossom: {
            serverUrl: 'https://cdn.hzrd149.com',
          },
          deployment: {
            baseDomain: 'nostrdeploy.com',
          },
        };
      }
    } catch (error) {
      console.error('Error loading config:', error);
      throw error;
    }
  }

  private parseEnvFile(content: string): Partial<UserConfig> {
    const lines = content.split('\n');
    const config: Partial<UserConfig> = {
      nostr: {
        publicKey: '',
        relays: [],
        pow: {
          enabled: true,
          targetDifficulty: 30,
        },
      },
      blossom: { serverUrl: '' },
      deployment: { baseDomain: '' },
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').trim();

      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');

      switch (key?.trim()) {
        case 'NOSTR_PRIVATE_KEY':
          if (config.nostr) config.nostr.privateKey = cleanValue;
          break;
        case 'NOSTR_PUBLIC_KEY':
          if (config.nostr) config.nostr.publicKey = cleanValue;
          break;
        case 'NOSTR_RELAYS':
          if (config.nostr) {
            config.nostr.relays = cleanValue ? cleanValue.split(',').map((r) => r.trim()) : [];
          }
          break;
        case 'NOSTR_POW_ENABLED':
          if (config.nostr) {
            if (!config.nostr.pow) config.nostr.pow = { enabled: true, targetDifficulty: 30 };
            config.nostr.pow.enabled = cleanValue.toLowerCase() === 'true';
          }
          break;
        case 'NOSTR_POW_DIFFICULTY':
          if (config.nostr) {
            if (!config.nostr.pow) config.nostr.pow = { enabled: true, targetDifficulty: 30 };
            config.nostr.pow.targetDifficulty = parseInt(cleanValue, 10) || 30;
          }
          break;
        case 'NOSTR_POW_TIMEOUT':
          if (config.nostr) {
            if (!config.nostr.pow) config.nostr.pow = { enabled: true, targetDifficulty: 30 };
            config.nostr.pow.timeout = parseInt(cleanValue, 10) || undefined;
          }
          break;
        case 'BLOSSOM_SERVER_URL':
          if (config.blossom) config.blossom.serverUrl = cleanValue;
          break;
        case 'BASE_DOMAIN':
          if (config.deployment) config.deployment.baseDomain = cleanValue;
          break;
      }
    }

    return config;
  }

  private generateEnvContent(): string {
    const lines: string[] = [];
    lines.push('# Nostr Deploy CLI Configuration');
    lines.push('# This file contains sensitive information - do not commit to version control');
    lines.push('');

    // Nostr configuration
    lines.push('# Nostr Authentication');
    if (this.config.nostr?.privateKey) {
      lines.push(`NOSTR_PRIVATE_KEY=${this.config.nostr.privateKey}`);
    }
    if (this.config.nostr?.publicKey) {
      lines.push(`NOSTR_PUBLIC_KEY=${this.config.nostr.publicKey}`);
    }
    if (this.config.nostr?.relays && this.config.nostr.relays.length > 0) {
      lines.push(`NOSTR_RELAYS=${this.config.nostr.relays.join(',')}`);
    }

    lines.push('');
    lines.push('# Proof of Work Configuration');

    // Always add PoW configuration with defaults
    const powConfig = this.config.nostr?.pow || { enabled: true, targetDifficulty: 30 };
    lines.push(`NOSTR_POW_ENABLED=${powConfig.enabled}`);
    lines.push(`NOSTR_POW_DIFFICULTY=${powConfig.targetDifficulty}`);
    if (powConfig.timeout) {
      lines.push(`NOSTR_POW_TIMEOUT=${powConfig.timeout}`);
    }

    lines.push('');

    // Blossom configuration
    lines.push('# Blossom File Storage');
    if (this.config.blossom?.serverUrl) {
      lines.push(`BLOSSOM_SERVER_URL=${this.config.blossom.serverUrl}`);
    }

    lines.push('');

    // Deployment configuration
    lines.push('# Deployment Settings');
    if (this.config.deployment?.baseDomain) {
      lines.push(`BASE_DOMAIN=${this.config.deployment.baseDomain}`);
    }

    return lines.join('\n') + '\n';
  }

  public async saveConfig(): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      const envContent = this.generateEnvContent();
      await fs.writeFile(configPath, envContent, 'utf-8');
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

  public async setNostrPow(
    enabled: boolean,
    targetDifficulty: number,
    timeout?: number
  ): Promise<void> {
    if (!this.config.nostr) {
      this.config.nostr = { publicKey: '', relays: [] };
    }
    this.config.nostr.pow = {
      enabled,
      targetDifficulty,
      timeout,
    };
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
