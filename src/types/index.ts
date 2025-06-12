export interface NostrConfig {
  privateKey?: string;
  publicKey: string;
  relays: string[];
}

export interface BlossomConfig {
  servers: string[];
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
}

export interface StatusOptions {
  subdomain?: string;
}
