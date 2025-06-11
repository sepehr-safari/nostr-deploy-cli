import axios from 'axios';
import * as crypto from 'crypto';
import * as path from 'path';
import { BlossomManager } from './blossom';
import { ConfigManager } from './config';
import { NostrManager, StaticFileInfo } from './nostr';

export interface SubdomainRequest {
  publicKey: string;
  siteName?: string;
  customSubdomain?: string;
}

export interface SubdomainResponse {
  subdomain: string;
  fullUrl: string;
  sslCertificate: {
    issued: boolean;
    expiresAt?: string;
  };
}

export interface DeploymentResult {
  npubSubdomain: string;
  fullUrl: string;
  staticFileEventIds: string[];
  userServersEventId: string;
  deployedAt: Date;
  fileCount: number;
}

export class DeploymentManager {
  private config: ConfigManager | null = null;
  private blossom: BlossomManager;
  private nostr: NostrManager;
  private deploymentServiceUrl: string;

  constructor() {
    this.blossom = new BlossomManager();
    this.nostr = new NostrManager();
    this.deploymentServiceUrl = 'https://api.nostrdeploy.com'; // Production service URL
  }

  private async getConfig(): Promise<ConfigManager> {
    if (!this.config) {
      this.config = await ConfigManager.getInstance();
    }
    return this.config;
  }

  public async deployStaticSite(
    buildDirectory: string,
    options: {
      siteName?: string;
      customSubdomain?: string;
    } = {}
  ): Promise<DeploymentResult> {
    console.log('🚀 Starting deployment process...');

    // Step 1: Validate build directory
    await this.validateBuildDirectory(buildDirectory);

    // Step 2: Get npub subdomain
    console.log('🔑 Generating npub subdomain...');
    const npubSubdomain = await this.nostr.getNpubSubdomain();
    console.log(`🌐 Subdomain: ${npubSubdomain}.nostrdeploy.com`);

    // Step 3: Upload files to Blossom
    console.log('📤 Uploading files to Blossom server...');
    const uploadResults = await this.blossom.uploadDirectory(buildDirectory);

    // Step 4: Create static file info for Nostr events
    console.log('📋 Preparing static file events...');
    const staticFiles: StaticFileInfo[] = [];

    for (const [filePath, uploadResult] of Object.entries(uploadResults)) {
      // Convert file path to absolute path as required by NIP
      const absolutePath = this.normalizeFilePath(filePath);
      staticFiles.push({
        path: absolutePath,
        sha256: uploadResult.sha256,
      });
    }

    // Step 5: Get Blossom server info
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const blossomServer = userConfig.blossom?.serverUrl || 'https://blossom.hzrd149.com';

    // Step 6: Publish to Nostr according to Pubkey Static Websites NIP
    console.log('📡 Publishing to Nostr using Pubkey Static Websites NIP...');
    const nostrResult = await this.nostr.publishDeploymentMetadata({
      npubSubdomain,
      files: staticFiles,
      blossomServers: [blossomServer],
      siteName: options.siteName,
    });

    console.log('✅ Deployment completed successfully!');

    return {
      npubSubdomain,
      fullUrl: `${npubSubdomain}.nostrdeploy.com`,
      staticFileEventIds: nostrResult.staticFileEventIds,
      userServersEventId: nostrResult.userServersEventId,
      deployedAt: new Date(),
      fileCount: staticFiles.length,
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

  /**
   * Legacy method - kept for backwards compatibility
   * New deployments should use npub subdomains
   */
  private generateDemoSubdomain(siteName: string): string {
    console.warn('⚠️  Using legacy subdomain generation. Consider migrating to npub subdomains.');
    const timestamp = Date.now().toString(36);
    const hash = crypto.createHash('md5').update(siteName).digest('hex').substring(0, 6);
    return `${siteName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${hash}-${timestamp}`;
  }

  private async requestSubdomain(request: SubdomainRequest): Promise<SubdomainResponse> {
    try {
      const response = await axios.post(`${this.deploymentServiceUrl}/api/subdomain`, request, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Nostr ${request.publicKey}`,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 409) {
          throw new Error(`Subdomain already taken: ${message}`);
        } else if (status === 403) {
          throw new Error(`Authentication failed: ${message}`);
        } else {
          throw new Error(`Failed to request subdomain: ${status} ${message}`);
        }
      }
      throw new Error(`Network error while requesting subdomain: ${error}`);
    }
  }

  public generateRandomSubdomain(prefix: string = ''): string {
    const randomBytes = crypto.randomBytes(8);
    const randomString = randomBytes.toString('hex');
    return prefix ? `${prefix}-${randomString}` : randomString;
  }

  public async getDeploymentStatus(npubSubdomain: string): Promise<{
    status: 'active' | 'inactive' | 'error';
    lastChecked: Date;
    sslStatus: 'valid' | 'expired' | 'invalid';
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
        sslStatus: 'valid', // Would need proper SSL validation
        responseTime,
        fileCount,
      };
    } catch (error) {
      return {
        status: 'inactive',
        lastChecked: new Date(),
        sslStatus: 'invalid',
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

  public async deleteDeployment(npubSubdomain: string): Promise<void> {
    try {
      const config = await this.getConfig();
      const userConfig = config.getConfig();
      // This would call your deployment service to remove the subdomain and DNS records
      await axios.delete(`${this.deploymentServiceUrl}/api/deployment/${npubSubdomain}`, {
        headers: {
          Authorization: `Nostr ${userConfig.nostr?.publicKey}`,
        },
      });
    } catch (error) {
      throw new Error(`Failed to delete deployment: ${error}`);
    }
  }

  /**
   * Get current user's npub subdomain for status checks
   */
  public async getCurrentNpubSubdomain(): Promise<string> {
    return this.nostr.getNpubSubdomain();
  }
}
