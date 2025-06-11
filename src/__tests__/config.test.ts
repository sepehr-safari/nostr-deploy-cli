import { ConfigManager } from '../utils/config';

// Mock fs-extra to avoid file system operations during tests
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeJSON: jest.fn().mockResolvedValue(undefined),
  readJSON: jest.fn().mockResolvedValue({}),
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(async () => {
    // Reset singleton instance for each test
    (ConfigManager as any).instance = undefined;
    configManager = await ConfigManager.getInstance();
  });

  it('should create a singleton instance', async () => {
    const instance1 = await ConfigManager.getInstance();
    const instance2 = await ConfigManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should have default configuration when not configured', async () => {
    const config = configManager.getConfig();
    expect(config).toBeDefined();
    expect(config.nostr?.relays).toContain('wss://nos.lol');
  });

  it('should identify when configuration is incomplete', async () => {
    const isConfigured = configManager.isConfigured();
    expect(isConfigured).toBe(false);
  });

  it('should update configuration correctly', async () => {
    const testConfig = {
      nostr: {
        publicKey: 'test-public-key',
        relays: ['wss://test-relay.com'],
      },
    };

    await configManager.updateConfig(testConfig);
    const updatedConfig = configManager.getConfig();

    expect(updatedConfig.nostr?.publicKey).toBe('test-public-key');
    expect(updatedConfig.nostr?.relays).toContain('wss://test-relay.com');
  });

  it('should set Nostr relays correctly', async () => {
    const testRelays = ['wss://relay1.com', 'wss://relay2.com'];

    await configManager.setNostrRelays(testRelays);
    const config = configManager.getConfig();

    expect(config.nostr?.relays).toEqual(testRelays);
  });

  it('should set Blossom server correctly', async () => {
    const testServer = 'https://test-blossom.com';

    await configManager.setBlossomServer(testServer);
    const config = configManager.getConfig();

    expect(config.blossom?.serverUrl).toBe(testServer);
  });
});
