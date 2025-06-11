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
      await config.setBlossomServer(options.blossom);
      console.log(chalk.green(`✅ Updated Blossom server: ${options.blossom}`));
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

    // Handle PoW configuration
    if (
      options.pow !== undefined ||
      options.powDifficulty !== undefined ||
      options.powTimeout !== undefined
    ) {
      const currentConfig = config.getConfig();
      const currentPow = currentConfig.nostr?.pow || { enabled: false, targetDifficulty: 30 };

      const enabled = options.pow !== undefined ? options.pow : currentPow.enabled;
      const difficulty =
        options.powDifficulty !== undefined ? options.powDifficulty : currentPow.targetDifficulty;
      const timeout = options.powTimeout !== undefined ? options.powTimeout : currentPow.timeout;

      await config.setNostrPow(enabled, difficulty, timeout);

      const status = enabled
        ? `enabled with difficulty ${difficulty}${timeout ? ` and timeout ${timeout}ms` : ''}`
        : 'disabled';
      console.log(chalk.green(`✅ Updated Proof of Work: ${status}`));
    }

    // If no command line options provided, show interactive configuration
    if (
      !options.relays &&
      !options.blossom &&
      !options.domain &&
      options.pow === undefined &&
      options.powDifficulty === undefined &&
      options.powTimeout === undefined
    ) {
      console.log(chalk.white('\nCurrent project configuration:'));
      console.log(
        chalk.white('  Nostr relays: ') +
          chalk.gray(currentConfig.nostr?.relays?.join(', ') || 'Not configured')
      );
      console.log(
        chalk.white('  Blossom server: ') +
          chalk.gray(currentConfig.blossom?.serverUrl || 'Not configured')
      );
      console.log(
        chalk.white('  Base domain: ') +
          chalk.gray(currentConfig.deployment?.baseDomain || 'Not configured')
      );

      // Show PoW configuration
      const powConfig = currentConfig.nostr?.pow;
      const powStatus = powConfig?.enabled
        ? `Enabled (difficulty: ${powConfig.targetDifficulty}${
            powConfig.timeout ? `, timeout: ${powConfig.timeout}ms` : ''
          })`
        : 'Disabled';
      console.log(chalk.white('  Proof of Work: ') + chalk.gray(powStatus));

      const configChoice = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'settings',
          message: 'What would you like to configure for this project?',
          choices: [
            { name: '📡 Nostr Relays', value: 'relays' },
            { name: '🌸 Blossom Server', value: 'blossom' },
            { name: '🌐 Base Domain', value: 'domain' },
            { name: '⚡ Proof of Work', value: 'pow' },
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
            default:
              currentConfig.nostr?.relays?.join(', ') ||
              'wss://nos.lol,wss://ditto.pub/relay,wss://relay.damus.io',
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
            name: 'serverUrl',
            message: 'Enter Blossom server URL:',
            default: currentConfig.blossom?.serverUrl || 'https://cdn.hzrd149.com',
            validate: (input: string) => {
              try {
                new URL(input);
                return true;
              } catch {
                return 'Please enter a valid URL';
              }
            },
          },
        ]);

        await config.setBlossomServer(blossomInput.serverUrl);
        console.log(chalk.green(`✅ Updated Blossom server: ${blossomInput.serverUrl}`));
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

      if (configChoice.settings.includes('pow')) {
        const currentPow = currentConfig.nostr?.pow || { enabled: false, targetDifficulty: 30 };

        const powInput = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enabled',
            message: 'Enable Proof of Work for published events?',
            default: currentPow.enabled,
          },
        ]);

        if (powInput.enabled) {
          const powDetails = await inquirer.prompt([
            {
              type: 'number',
              name: 'difficulty',
              message: 'Enter target difficulty (0-20 recommended for reasonable performance):',
              default: currentPow.targetDifficulty || 30,
              validate: (input: number) => {
                if (input < 0) return 'Difficulty must be 0 or greater';
                if (input > 30) return 'Difficulty above 30 may take extremely long to compute';
                return true;
              },
            },
            {
              type: 'number',
              name: 'timeout',
              message: 'Enter timeout in milliseconds (optional, 0 = no timeout):',
              default: currentPow.timeout || 0,
              validate: (input: number) => {
                if (input < 0) return 'Timeout must be 0 or greater';
                return true;
              },
            },
          ]);

          await config.setNostrPow(
            true,
            powDetails.difficulty,
            powDetails.timeout > 0 ? powDetails.timeout : undefined
          );

          console.log(
            chalk.green(
              `✅ Enabled Proof of Work with difficulty ${powDetails.difficulty}${
                powDetails.timeout > 0 ? ` and timeout ${powDetails.timeout}ms` : ''
              }`
            )
          );
        } else {
          await config.setNostrPow(false, 0);
          console.log(chalk.green('✅ Disabled Proof of Work'));
        }
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
      if (!currentConfig.blossom?.serverUrl) {
        console.log(chalk.white('  • Blossom server URL'));
      }

      console.log(chalk.white('  • View current status: ') + chalk.green('nostr-deploy-cli info'));
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Configuration failed: ${error}`));
    process.exit(1);
  }
}
