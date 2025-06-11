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
      await config.setNostrRelays(options.relays);
      console.log(chalk.green(`✅ Updated Nostr relays (${options.relays.length} relays)`));
    }

    if (options.blossom) {
      await config.setBlossomServer(options.blossom);
      console.log(chalk.green(`✅ Updated Blossom server: ${options.blossom}`));
    }

    // If no options provided, run interactive configuration
    if (!options.relays && !options.blossom) {
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
            { name: '🔗 Nostr Relays', value: 'relays' },
            { name: '🌸 Blossom Server', value: 'blossom' },
            { name: '🔒 SSL Provider', value: 'ssl' },
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
              'wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band',
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
            default: currentConfig.blossom?.serverUrl || 'https://blossom.server.example.com',
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

      if (configChoice.settings.includes('ssl')) {
        const sslInput = await inquirer.prompt([
          {
            type: 'list',
            name: 'provider',
            message: 'Choose SSL certificate provider:',
            choices: [
              { name: "🔒 Let's Encrypt (Free)", value: 'letsencrypt' },
              { name: '☁️  Cloudflare (Requires API key)', value: 'cloudflare' },
            ],
            default: currentConfig.deployment?.sslProvider || 'letsencrypt',
          },
        ]);

        const updatedConfig = config.getConfig();
        if (updatedConfig.deployment) {
          updatedConfig.deployment.sslProvider = sslInput.provider as 'letsencrypt' | 'cloudflare';
        } else {
          updatedConfig.deployment = {
            baseDomain: 'nostrsite.dev',
            sslProvider: sslInput.provider as 'letsencrypt' | 'cloudflare',
          };
        }
        await config.updateConfig(updatedConfig);
        console.log(chalk.green(`✅ Updated SSL provider: ${sslInput.provider}`));
      }
    }

    // Check if configuration is complete
    if (config.isConfigured()) {
      console.log(chalk.cyan('\n🎉 Configuration complete!'));
      console.log(
        chalk.white('You can now deploy sites using: ') + chalk.green('nostr-deploy deploy')
      );
    } else {
      console.log(chalk.yellow('\n⚠️  Configuration incomplete.'));
      console.log(chalk.white('Make sure to configure:'));

      const currentConfig = config.getConfig();
      if (!currentConfig.nostr?.publicKey) {
        console.log(chalk.white('  • Authentication: ') + chalk.green('nostr-deploy auth'));
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
