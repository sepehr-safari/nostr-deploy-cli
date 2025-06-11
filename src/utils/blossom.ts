import axios, { AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import { ConfigManager } from './config';

export interface BlossomUploadResponse {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded?: string;
}

export class BlossomManager {
  private config: ConfigManager | null = null;
  private baseUrl: string = 'https://cdn.hzrd149.com';

  constructor() {
    // Initialize with default URL, will be updated when config is loaded
  }

  private async getConfig(): Promise<ConfigManager> {
    if (!this.config) {
      this.config = await ConfigManager.getInstance();
      const userConfig = this.config.getConfig();
      this.baseUrl = userConfig.blossom?.serverUrl || 'https://cdn.hzrd149.com';
    }
    return this.config;
  }

  public async uploadFiles(filePaths: string[]): Promise<BlossomUploadResponse[]> {
    const results: BlossomUploadResponse[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.uploadSingleFile(filePath);
        results.push(result);
      } catch (error) {
        throw new Error(`Failed to upload ${filePath}: ${error}`);
      }
    }

    return results;
  }

  private async uploadSingleFile(filePath: string): Promise<BlossomUploadResponse> {
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = await fs.readFile(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileName = filePath.split('/').pop() || 'unknown';
    const mimeType = this.getMimeType(fileName);

    // Check if file already exists using GET request
    try {
      const existingFile = await this.getBlob(fileHash);
      if (existingFile) {
        console.log(`  File already exists: ${fileName}`);
        return {
          url: `${this.baseUrl}/${fileHash}`,
          sha256: fileHash,
          size: fileBuffer.length,
          type: mimeType,
          uploaded: new Date().toISOString(),
        };
      }
    } catch {
      // File doesn't exist, continue with upload
    }

    // Step 1: Check upload requirements using HEAD /upload (BUD-06)
    const canUpload = await this.checkUploadRequirements(fileHash, fileBuffer.length, mimeType);
    if (!canUpload.allowed) {
      throw new Error(`Upload rejected: ${canUpload.reason}`);
    }

    // Step 2: Create authorization event if required (BUD-01)
    let authHeader = '';
    if (canUpload.requiresAuth) {
      authHeader = await this.createBlossomAuthEvent('upload', fileHash, fileName);
    }

    // Step 3: Upload the file using PUT /upload (BUD-02)
    try {
      const response: AxiosResponse = await axios.put(`${this.baseUrl}/upload`, fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.length.toString(),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        timeout: 120000, // 2 minute timeout for large files
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;
        return {
          url: responseData?.url || `${this.baseUrl}/${fileHash}`,
          sha256: responseData?.sha256 || fileHash,
          size: responseData?.size || fileBuffer.length,
          type: responseData?.type || mimeType,
          uploaded: responseData?.uploaded || new Date().toISOString(),
        };
      } else {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 'Unknown';
        const statusText = error.response?.statusText || 'Unknown';
        const errorData = error.response?.data;
        const reason = error.response?.headers?.['x-reason'] || errorData;

        throw new Error(`Upload failed: ${status} ${statusText} - ${reason}`);
      }
      throw error;
    }
  }

  private async checkUploadRequirements(
    sha256: string,
    size: number,
    mimeType: string
  ): Promise<{
    allowed: boolean;
    requiresAuth: boolean;
    reason?: string;
  }> {
    try {
      // BUD-06: Check upload requirements using HEAD /upload
      const response = await axios.head(`${this.baseUrl}/upload`, {
        headers: {
          'X-SHA-256': sha256,
          'X-Content-Length': size.toString(),
          'X-Content-Type': mimeType,
        },
        timeout: 10000,
      });

      return {
        allowed: response.status === 200,
        requiresAuth: false,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const reason = error.response?.headers?.['x-reason'] || error.response?.data;

        if (status === 401) {
          // Server requires authorization
          return {
            allowed: true,
            requiresAuth: true,
          };
        } else if (status === 403 || status === 413 || status === 415) {
          // Upload not allowed for this file
          return {
            allowed: false,
            requiresAuth: false,
            reason: reason || `Server rejected upload (${status})`,
          };
        }
      }

      // If HEAD request fails, assume upload is allowed and may require auth
      return {
        allowed: true,
        requiresAuth: true,
      };
    }
  }

  private async createBlossomAuthEvent(
    action: string,
    fileHash: string,
    fileName: string
  ): Promise<string> {
    try {
      const config = await this.getConfig();
      const userConfig = config.getConfig();

      if (!userConfig.nostr?.privateKey) {
        throw new Error('No Nostr private key configured for authentication');
      }

      // Import finalizeEvent from nostr-tools
      const { finalizeEvent } = await import('nostr-tools');

      // BUD-01: Create proper Blossom authorization event
      const now = Math.floor(Date.now() / 1000);
      const expiration = now + 60 * 60; // 1 hour expiration

      const authEvent = {
        kind: 24242, // BUD-01: Must be kind 24242
        content: `Upload ${fileName}`, // BUD-01: Human readable content
        created_at: now,
        tags: [
          ['t', action], // BUD-01: Must have 't' tag with verb
          ['x', fileHash], // BUD-01: Must have 'x' tag with SHA256
          ['expiration', expiration.toString()], // BUD-01: Must have expiration
        ],
      };

      // Convert private key from hex to Uint8Array
      const privateKeyBytes = new Uint8Array(Buffer.from(userConfig.nostr.privateKey, 'hex'));

      // Sign the event properly
      const signedEvent = finalizeEvent(authEvent, privateKeyBytes);

      // BUD-01: Encode as base64 with Nostr scheme
      const eventBase64 = Buffer.from(JSON.stringify(signedEvent)).toString('base64');

      return `Nostr ${eventBase64}`;
    } catch (error) {
      throw new Error(`Failed to create Blossom auth event: ${error}`);
    }
  }

  public async getBlob(sha256: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/${sha256}`, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  public async uploadDirectory(
    dirPath: string
  ): Promise<{ [filename: string]: BlossomUploadResponse }> {
    if (!(await fs.pathExists(dirPath))) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = await this.getAllFiles(dirPath);
    const results: { [filename: string]: BlossomUploadResponse } = {};

    console.log(`📤 Uploading ${files.length} files to Blossom server...`);

    for (const file of files) {
      try {
        const relativePath = file.replace(dirPath + '/', '').replace(dirPath + '\\', '');
        console.log(`  Uploading: ${relativePath}`);
        const uploadResult = await this.uploadSingleFile(file);
        results[relativePath] = uploadResult;
      } catch (error) {
        throw new Error(`Failed to upload ${file}: ${error}`);
      }
    }

    return results;
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = `${dirPath}/${item.name}`;

      if (item.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  public async createManifest(uploadResults: {
    [filename: string]: BlossomUploadResponse;
  }): Promise<BlossomUploadResponse> {
    const manifest = {
      type: 'static-site-manifest',
      files: uploadResults,
      created: new Date().toISOString(),
      version: '1.0',
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const tempManifestPath = `/tmp/site-manifest-${Date.now()}.json`;

    await fs.writeFile(tempManifestPath, manifestBuffer);

    try {
      const result = await this.uploadSingleFile(tempManifestPath);
      await fs.remove(tempManifestPath); // Clean up temp file
      return result;
    } catch (error) {
      await fs.remove(tempManifestPath); // Clean up temp file on error
      throw error;
    }
  }

  public async downloadFile(sha256: string, outputPath: string): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/${sha256}`, {
        responseType: 'stream',
        timeout: 30000,
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  public async deleteFile(sha256: string): Promise<void> {
    try {
      const authHeader = await this.createBlossomAuthEvent('delete', sha256, 'file');

      await axios.delete(`${this.baseUrl}/${sha256}`, {
        headers: {
          Authorization: authHeader,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // File already deleted or doesn't exist
        return;
      }
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();

    const mimeTypes: { [key: string]: string } = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      mjs: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
      txt: 'text/plain',
      xml: 'application/xml',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  public getFileUrl(sha256: string): string {
    return `${this.baseUrl}/${sha256}`;
  }
}
