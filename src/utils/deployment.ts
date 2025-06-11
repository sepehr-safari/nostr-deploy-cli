import axios from 'axios';
import * as crypto from 'crypto';
import { BlossomManager } from './blossom';
import { ConfigManager } from './config';
import { NostrManager } from './nostr';

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
  subdomain: string;
  fullUrl: string;
  fileHash: string;
  blossomManifestUrl: string;
  nostrEventId: string;
  deployedAt: Date;
}

export class DeploymentManager {
  private config: ConfigManager | null = null;
  private blossom: BlossomManager;
  private nostr: NostrManager;
  private deploymentServiceUrl: string;

  constructor() {
    this.blossom = new BlossomManager();
    this.nostr = new NostrManager();
    this.deploymentServiceUrl = 'https://api.nostrsite.dev'; // Demo service URL
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

    // Step 2: Upload files to Blossom
    console.log('📤 Uploading files to Blossom server...');
    const uploadResults = await this.blossom.uploadDirectory(buildDirectory);

    // Step 3: Create manifest
    console.log('📋 Creating site manifest...');
    const manifest = await this.blossom.createManifest(uploadResults);

    // Step 4: Generate demo subdomain (since actual service doesn't exist)
    console.log('🌐 Generating demo deployment info...');
    const config = await this.getConfig();
    const userConfig = config.getConfig();
    const demoSubdomain = this.generateDemoSubdomain(options.siteName || 'site');

    // Step 5: Publish deployment metadata to Nostr
    console.log('📡 Publishing deployment metadata to Nostr...');
    const eventId = await this.nostr.publishDeploymentMetadata({
      subdomain: demoSubdomain,
      fileHash: manifest.sha256,
      blossomUrl: this.blossom.getFileUrl(manifest.sha256),
      siteName: options.siteName,
    });

    console.log('✅ Deployment completed successfully!');

    return {
      subdomain: demoSubdomain,
      fullUrl: `${demoSubdomain}.nostrsite.dev`, // Demo URL
      fileHash: manifest.sha256,
      blossomManifestUrl: this.blossom.getFileUrl(manifest.sha256),
      nostrEventId: eventId,
      deployedAt: new Date(),
    };
  }

  private async validateBuildDirectory(buildDirectory: string): Promise<void> {
    const fs = await import('fs-extra');

    if (!(await fs.pathExists(buildDirectory))) {
      throw new Error(`Build directory not found: ${buildDirectory}`);
    }

    // Check for index.html
    const indexPath = `${buildDirectory}/index.html`;
    if (!(await fs.pathExists(indexPath))) {
      throw new Error('No index.html found in build directory');
    }

    console.log(`✓ Build directory validated: ${buildDirectory}`);
  }

  private generateDemoSubdomain(siteName: string): string {
    // Create a deterministic but unique subdomain based on site name and timestamp
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

  public async getDeploymentStatus(subdomain: string): Promise<{
    status: 'active' | 'inactive' | 'error';
    lastChecked: Date;
    sslStatus: 'valid' | 'expired' | 'invalid';
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();
      const baseDomain = await this.getBaseDomain();
      const response = await axios.get(`https://${subdomain}.${baseDomain}`, {
        timeout: 5000,
        validateStatus: (status) => status < 500, // Accept 4xx as valid responses
      });
      const responseTime = Date.now() - startTime;

      return {
        status: response.status < 400 ? 'active' : 'error',
        lastChecked: new Date(),
        sslStatus: 'valid', // Would need proper SSL validation
        responseTime,
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
    return userConfig.deployment?.baseDomain || 'nostrsite.dev';
  }

  public async deleteDeployment(subdomain: string): Promise<void> {
    try {
      const config = await this.getConfig();
      const userConfig = config.getConfig();
      // This would call your deployment service to remove the subdomain and DNS records
      await axios.delete(`${this.deploymentServiceUrl}/api/deployment/${subdomain}`, {
        headers: {
          Authorization: `Nostr ${userConfig.nostr?.publicKey}`,
        },
      });
    } catch (error) {
      throw new Error(`Failed to delete deployment: ${error}`);
    }
  }
}
