import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigOptions } from '../types';
import { ConfigManager } from '../utils/config';

export async function configCommand(options: ConfigOptions): Promise<void> {
  const config = await ConfigManager.getInstance();

  try {
    console.log(chalk.cyan('\n⚙️  Deployment Configuration\n'));

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

    // If no options provided, run interactive configuration
    if (!options.relays && !options.blossom && !options.domain) {
      console.log(chalk.white('Current configuration:'));
      console.log(
        chalk.gray('  Nostr relays: '),
        currentConfig.nostr?.relays?.join(', ') || 'Not configured'
      );
      console.log(
        chalk.gray('  Blossom server: '),
        currentConfig.blossom?.serverUrl || 'Not configured'
      );
      console.log('');

      const configChoice = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'settings',
          message: 'What would you like to configure?',
          choices: [
            { name: '📡 Nostr Relays', value: 'relays' },
            { name: '🌸 Blossom Server', value: 'blossom' },
            { name: '🌐 Base Domain', value: 'domain' },
          ],
        },
      ]);

      if (configChoice.settings.includes('relays')) {
        const relaysInput = await inquirer.prompt([
          {
            type: 'input',
            name: 'relays',
            message: 'Enter Nostr relay URLs (comma-separated):',
            default:
              currentConfig.nostr?.relays?.join(', ') ||
              'wss://nos.lol,wss://ditto.pub/relay,wss://relay.damus.io',
            filter: (input: string) =>
              input
                .split(',')
                .map((r) => r.trim())
                .filter((r) => r.length > 0),
          },
        ]);

        await config.setNostrRelays(relaysInput.relays);
        console.log(chalk.green(`✅ Updated Nostr relays (${relaysInput.relays.length} relays)`));
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
              try {
                new URL(input);
                return true;
              } catch {
                return 'Please enter a valid domain';
              }
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
      console.log(chalk.cyan('\n🎉 Configuration complete!'));
      console.log(
        chalk.white('You can now deploy sites using: ') + chalk.green('nostr-deploy-cli deploy')
      );
    } else {
      console.log(chalk.yellow('\n⚠️  Configuration incomplete.'));
      console.log(chalk.white('Make sure to configure:'));

      const currentConfig = config.getConfig();
      if (!currentConfig.nostr?.publicKey) {
        console.log(chalk.white('  • Authentication: ') + chalk.green('nostr-deploy-cli auth'));
      }
      if (!currentConfig.blossom?.serverUrl) {
        console.log(chalk.white('  • Blossom server URL'));
      }
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Configuration failed: ${error}`));
    process.exit(1);
  }
}
