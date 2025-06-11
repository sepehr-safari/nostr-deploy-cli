export interface NostrConfig {
  privateKey?: string;
  publicKey: string;
  relays: string[];
  pow?: {
    enabled: boolean;
    targetDifficulty: number;
    timeout?: number; // Timeout in milliseconds for PoW computation
  };
}

export interface BlossomConfig {
  serverUrl: string;
  apiKey?: string;
}

export interface DeploymentConfig {
  baseDomain: string;
}

export interface UserConfig {
  nostr: NostrConfig;
  blossom: BlossomConfig;
  deployment: DeploymentConfig;
}

export interface DeploymentInfo {
  subdomain: string;
  fullUrl: string;
  publicKey: string;
  deployedAt: Date;
  fileHash: string;
  blossomUrl: string;
}

export interface DeployOptions {
  dir?: string;
  skipSetup?: boolean;
}

export interface AuthOptions {
  key?: string;
  pubkey?: string;
}

export interface ConfigOptions {
  relays?: string[];
  blossom?: string;
  domain?: string;
  pow?: boolean;
  powDifficulty?: number;
  powTimeout?: number;
}

export interface StatusOptions {
  subdomain?: string;
}
