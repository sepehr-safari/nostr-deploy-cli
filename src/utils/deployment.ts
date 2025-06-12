import axios from 'axios';
import * as path from 'path';
import { BlossomFileResult, BlossomManager } from './blossom';
import { ConfigManager } from './config';
import { NostrManager, StaticFileInfo } from './nostr';

export interface DeploymentResult {
  npubSubdomain: string;
  fullUrl: string;
  staticFileEventResults: {
    eventId: string;
    relayResults: { relay: string; success: boolean; error?: string }[];
  }[];
  userServersEventResult: {
    eventId: string;
    relayResults: { relay: string; success: boolean; error?: string }[];
  };
  deployedAt: Date;
  fileCount: number;
  blossomResults: { [filename: string]: BlossomFileResult };
}

export class DeploymentManager {
  private config: ConfigManager | null = null;
  private blossom: BlossomManager;
  private nostr: NostrManager;

  constructor() {
    this.blossom = new BlossomManager();
    this.nostr = new NostrManager();
  }

  private async getConfig(): Promise<ConfigManager> {
    if (!this.config) {
      this.config = await ConfigManager.getInstance();
    }
    return this.config;
  }

  public async deployStaticSite(buildDirectory: string): Promise<DeploymentResult> {
    console.log('🚀 Starting deployment process...');

    // Step 1: Validate build directory
    await this.validateBuildDirectory(buildDirectory);

    // Step 2: Get npub subdomain
    console.log('🔑 Generating npub subdomain...');
    const npubSubdomain = await this.nostr.getNpubSubdomain();
    console.log(`🌐 Subdomain: ${npubSubdomain}.nostrdeploy.com`);

    // Step 3: Upload files to Blossom servers
    console.log('📤 Uploading files to Blossom servers...');
    const uploadResults = await this.blossom.uploadDirectory(buildDirectory);

    // Step 4: Create static file info for Nostr events
    console.log('📋 Preparing static file events...');
    const staticFiles: StaticFileInfo[] = [];

    for (const [filePath, blossomResult] of Object.entries(uploadResults)) {
      if (blossomResult.hasSuccess) {
        // Convert file path to absolute path as required by NIP
        const absolutePath = this.normalizeFilePath(filePath);
        staticFiles.push({
          path: absolutePath,
          sha256: blossomResult.sha256,
        });
      } else {
        console.warn(
          `⚠️  Skipping ${filePath} from Nostr events - failed to upload to any Blossom server`
        );
      }
    }

    if (staticFiles.length === 0) {
      throw new Error('No files were successfully uploaded to any Blossom server');
    }

    // Step 5: Get successful Blossom servers for Nostr event
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const configuredServers = userConfig.blossom?.servers || ['https://cdn.hzrd149.com'];

    // Only include servers that had at least one successful upload
    const successfulServers = new Set<string>();
    Object.values(uploadResults).forEach((result) => {
      result.serverResults.forEach((serverResult) => {
        if (serverResult.success) {
          successfulServers.add(serverResult.server);
        }
      });
    });

    const blossomServers = Array.from(successfulServers);
    if (blossomServers.length === 0) {
      throw new Error('No Blossom servers had successful uploads');
    }

    // Step 6: Publish to Nostr according to Pubkey Static Websites NIP
    console.log('📡 Publishing to Nostr using Pubkey Static Websites NIP...');
    const nostrResult = await this.nostr.publishDeploymentMetadata({
      npubSubdomain,
      files: staticFiles,
      blossomServers,
    });

    console.log('✅ Deployment completed successfully!');

    return {
      npubSubdomain,
      fullUrl: `${npubSubdomain}.nostrdeploy.com`,
      staticFileEventResults: nostrResult.staticFileEventResults,
      userServersEventResult: nostrResult.userServersEventResult,
      deployedAt: new Date(),
      fileCount: staticFiles.length,
      blossomResults: uploadResults,
    };
  }

  /**
   * Normalize file path to absolute path format required by NIP
   * Ensures path starts with / and uses forward slashes
   */
  private normalizeFilePath(filePath: string): string {
    // Convert Windows paths to Unix-style
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Ensure path starts with /
    if (!normalizedPath.startsWith('/')) {
      return '/' + normalizedPath;
    }

    return normalizedPath;
  }

  private async validateBuildDirectory(buildDirectory: string): Promise<void> {
    const fs = await import('fs-extra');

    if (!(await fs.pathExists(buildDirectory))) {
      throw new Error(`Build directory not found: ${buildDirectory}`);
    }

    const indexPath = path.join(buildDirectory, 'index.html');
    if (!(await fs.pathExists(indexPath))) {
      throw new Error(`No index.html found in build directory: ${buildDirectory}`);
    }
  }

  public async getDeploymentStatus(npubSubdomain: string): Promise<{
    status: 'active' | 'inactive' | 'error';
    lastChecked: Date;
    responseTime?: number;
    fileCount?: number;
  }> {
    try {
      const startTime = Date.now();
      const baseDomain = await this.getBaseDomain();
      const response = await axios.get(`https://${npubSubdomain}.${baseDomain}`, {
        timeout: 5000,
        validateStatus: (status) => status < 500, // Accept 4xx as valid responses
      });
      const responseTime = Date.now() - startTime;

      // Try to get file count from Nostr events
      let fileCount: number | undefined;
      try {
        const events = await this.nostr.getStaticFileEvents();
        fileCount = events.length;
      } catch (error) {
        // Ignore errors when fetching file count
      }

      return {
        status: response.status < 400 ? 'active' : 'error',
        lastChecked: new Date(),
        responseTime,
        fileCount,
      };
    } catch (error) {
      return {
        status: 'inactive',
        lastChecked: new Date(),
      };
    }
  }

  public async listUserDeployments(): Promise<any[]> {
    try {
      return await this.nostr.getDeploymentHistory();
    } catch (error) {
      console.error('Failed to fetch deployment history:', error);
      return [];
    }
  }

  private async getBaseDomain(): Promise<string> {
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    return userConfig.deployment?.baseDomain || 'nostrdeploy.com';
  }

  /**
   * Get current user's npub subdomain for status checks
   */
  public async getCurrentNpubSubdomain(): Promise<string> {
    return this.nostr.getNpubSubdomain();
  }
}
