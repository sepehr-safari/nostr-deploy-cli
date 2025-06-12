import chalk from 'chalk';
import inquirer from 'inquirer';
import * as path from 'path';
import { ConfigOptions } from '../types';
import { ConfigManager } from '../utils/config';

export async function configCommand(options: ConfigOptions): Promise<void> {
  const config = await ConfigManager.getInstance();

  try {
    const projectName = path.basename(process.cwd());
    const hasLocalConfig = await config.hasLocalConfig();

    console.log(chalk.cyan('\n⚙️  Deployment Configuration\n'));
    console.log(chalk.white('Project: ') + chalk.yellow(projectName));
    console.log(chalk.white('Config: ') + chalk.gray(config.getConfigPath()));

    if (!hasLocalConfig) {
      console.log(chalk.yellow('\n⚠️  No local configuration found for this project.'));
      console.log(chalk.white('You need to set up authentication first:'));
      console.log(chalk.green('  nostr-deploy-cli auth'));
      console.log(chalk.white('Then you can configure deployment settings.'));
      return;
    }

    const currentConfig = config.getConfig();

    // Handle command line options
    if (options.relays) {
      // Handle both comma-separated and space-separated relays
      const relayList = options.relays
        .flatMap((relay) =>
          relay.includes(',') ? relay.split(',').map((r) => r.trim()) : [relay.trim()]
        )
        .filter((relay) => relay.length > 0);

      await config.setNostrRelays(relayList);
      console.log(chalk.green(`✅ Updated Nostr relays (${relayList.length} relays)`));
    }

    if (options.blossom) {
      await config.setBlossomServers([options.blossom]);
      console.log(chalk.green(`✅ Updated Blossom servers: ${options.blossom}`));
    }

    if (options.domain) {
      const updatedConfig = config.getConfig();
      if (updatedConfig.deployment) {
        updatedConfig.deployment.baseDomain = options.domain;
      } else {
        updatedConfig.deployment = {
          baseDomain: options.domain,
        };
      }
      await config.updateConfig(updatedConfig);
      console.log(chalk.green(`✅ Updated base domain: ${options.domain}`));
    }

    // If no command line options provided, show interactive configuration
    if (!options.relays && !options.blossom && !options.domain) {
      console.log(chalk.white('\nCurrent project configuration:'));
      console.log(
        chalk.white('  Nostr relays: ') +
          chalk.gray(currentConfig.nostr?.relays?.join(', ') || 'Not configured')
      );
      console.log(
        chalk.white('  Blossom servers: ') +
          chalk.gray((currentConfig.blossom?.servers || []).join(', ') || 'Not configured')
      );
      console.log(
        chalk.white('  Base domain: ') +
          chalk.gray(currentConfig.deployment?.baseDomain || 'Not configured')
      );

      const configChoice = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'settings',
          message: 'What would you like to configure for this project?',
          choices: [
            { name: '📡 Nostr Relays', value: 'relays' },
            { name: '🌸 Blossom Servers', value: 'blossom' },
            { name: '🌐 Base Domain', value: 'domain' },
          ],
        },
      ]);

      if (configChoice.settings.length === 0) {
        console.log(chalk.yellow('\n⏸️  No changes made.'));
        return;
      }

      if (configChoice.settings.includes('relays')) {
        const relaysInput = await inquirer.prompt([
          {
            type: 'input',
            name: 'relayUrls',
            message: 'Enter Nostr relay URLs (comma-separated):',
            default: currentConfig.nostr?.relays?.join(', ') || 'wss://relay.nostr.band',
            filter: (input: string) => input.split(',').map((r) => r.trim()),
            validate: (input: string[]) => {
              if (input.length === 0) return 'Please enter at least one relay URL';
              const validUrls = input.every((url) => {
                try {
                  const parsed = new URL(url);
                  return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
                } catch {
                  return false;
                }
              });
              return validUrls || 'Please enter valid WebSocket URLs (wss:// or ws://)';
            },
          },
        ]);

        await config.setNostrRelays(relaysInput.relayUrls);
        console.log(
          chalk.green(`✅ Updated Nostr relays (${relaysInput.relayUrls.length} relays)`)
        );
      }

      if (configChoice.settings.includes('blossom')) {
        const blossomInput = await inquirer.prompt([
          {
            type: 'input',
            name: 'servers',
            message: 'Enter Blossom server URLs (comma-separated):',
            default: (currentConfig.blossom?.servers || ['https://cdn.hzrd149.com']).join(', '),
            validate: (input: string) => {
              const servers = input
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
              if (servers.length === 0) {
                return 'Please enter at least one server URL';
              }
              for (const server of servers) {
                if (!server.startsWith('http://') && !server.startsWith('https://')) {
                  return `Invalid URL: ${server}. URLs must start with http:// or https://`;
                }
              }
              return true;
            },
          },
        ]);

        const servers = blossomInput.servers
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        await config.setBlossomServers(servers);
        console.log(chalk.green(`✅ Updated Blossom servers: ${servers.join(', ')}`));
      }

      if (configChoice.settings.includes('domain')) {
        const domainInput = await inquirer.prompt([
          {
            type: 'input',
            name: 'baseDomain',
            message: 'Enter base domain:',
            default: currentConfig.deployment?.baseDomain || 'nostrdeploy.com',
            validate: (input: string) => {
              // Basic domain validation
              const domainPattern =
                /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
              return domainPattern.test(input) || 'Please enter a valid domain name';
            },
          },
        ]);

        const updatedConfig = config.getConfig();
        if (updatedConfig.deployment) {
          updatedConfig.deployment.baseDomain = domainInput.baseDomain;
        } else {
          updatedConfig.deployment = {
            baseDomain: domainInput.baseDomain,
          };
        }
        await config.updateConfig(updatedConfig);
        console.log(chalk.green(`✅ Updated base domain: ${domainInput.baseDomain}`));
      }
    }

    // Check if configuration is complete
    if (config.isConfigured()) {
      console.log(chalk.cyan('\n🎉 Project configuration complete!'));
      console.log(
        chalk.white('You can now deploy sites from this project using: ') +
          chalk.green('nostr-deploy-cli deploy')
      );
      console.log(
        chalk.white('View complete project info with: ') + chalk.green('nostr-deploy-cli info')
      );
    } else {
      console.log(chalk.yellow('\n⚠️  Project configuration incomplete.'));
      console.log(chalk.white('Make sure to configure:'));

      const currentConfig = config.getConfig();
      if (!currentConfig.nostr?.publicKey) {
        console.log(chalk.white('  • Authentication: ') + chalk.green('nostr-deploy-cli auth'));
      }
      if (!currentConfig.blossom?.servers || currentConfig.blossom.servers.length === 0) {
        console.log(chalk.white('  • Blossom server URLs'));
      }

      console.log(chalk.white('  • View current status: ') + chalk.green('nostr-deploy-cli info'));
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Configuration failed: ${error}`));
    process.exit(1);
  }
}
