import chalk from 'chalk';
import * as path from 'path';
import { ConfigManager } from '../utils/config';
import { NostrManager } from '../utils/nostr';

export async function infoCommand(): Promise<void> {
  const config = await ConfigManager.getInstance();
  const nostr = new NostrManager();

  try {
    console.log(chalk.cyan('\n📋 Local Project Configuration\n'));

    const hasLocalConfig = await config.hasLocalConfig();
    const configPath = config.getConfigPath();
    const currentDir = process.cwd();
    const projectName = path.basename(currentDir);

    console.log(chalk.white('Project Details:'));
    console.log(chalk.white('  📁 Project Name: ') + chalk.yellow(projectName));
    console.log(chalk.white('  📍 Project Path: ') + chalk.gray(currentDir));
    console.log(chalk.white('  ⚙️  Config Path: ') + chalk.gray(configPath));
    console.log(
      chalk.white('  📄 Config Exists: ') +
        (hasLocalConfig ? chalk.green('✅ Yes') : chalk.red('❌ No'))
    );

    if (!hasLocalConfig) {
      console.log(chalk.yellow('\n⚠️  No local configuration found for this project.'));
      console.log(chalk.white('To set up authentication for this project, run:'));
      console.log(chalk.green('  nostr-deploy-cli auth'));
      console.log(chalk.white('To configure deployment settings, run:'));
      console.log(chalk.green('  nostr-deploy-cli config'));
      return;
    }

    const userConfig = config.getConfig();

    console.log(chalk.white('\nAuthentication Status:'));

    if (userConfig.nostr?.publicKey) {
      console.log(chalk.white('  🔑 Public Key: ') + chalk.green('✅ Configured'));

      try {
        const npub = await nostr.getNpubSubdomain();
        console.log(chalk.white('  🌐 Your npub: ') + chalk.blue(npub));

        const baseDomain = userConfig.deployment?.baseDomain || 'nostrdeploy.com';
        console.log(
          chalk.white('  🌍 Deployment URL: ') + chalk.cyan(`https://${npub}.${baseDomain}`)
        );
      } catch (error) {
        console.log(chalk.white('  🌐 npub: ') + chalk.red('❌ Error generating npub'));
      }

      if (userConfig.nostr?.privateKey) {
        console.log(chalk.white('  🔐 Private Key: ') + chalk.green('✅ Configured (can deploy)'));
      } else {
        console.log(
          chalk.white('  🔐 Private Key: ') + chalk.yellow('⚠️  Not configured (read-only)')
        );
      }
    } else {
      console.log(chalk.white('  🔑 Authentication: ') + chalk.red('❌ Not configured'));
    }

    console.log(chalk.white('\nNostr Configuration:'));
    if (userConfig.nostr?.relays && userConfig.nostr.relays.length > 0) {
      console.log(
        chalk.white('  📡 Relays: ') +
          chalk.green(`✅ ${userConfig.nostr.relays.length} configured`)
      );
      userConfig.nostr.relays.forEach((relay, index) => {
        console.log(chalk.white(`    ${index + 1}. `) + chalk.gray(relay));
      });
    } else {
      console.log(chalk.white('  📡 Relays: ') + chalk.red('❌ Not configured'));
    }

    console.log(chalk.white('\nDeployment Configuration:'));
    if (userConfig.blossom?.serverUrl) {
      console.log(chalk.white('  🌸 Blossom Server: ') + chalk.green('✅ Configured'));
      console.log(chalk.white('    URL: ') + chalk.gray(userConfig.blossom.serverUrl));
    } else {
      console.log(chalk.white('  🌸 Blossom Server: ') + chalk.red('❌ Not configured'));
    }

    if (userConfig.deployment?.baseDomain) {
      console.log(chalk.white('  🌐 Base Domain: ') + chalk.green('✅ Configured'));
      console.log(chalk.white('    Domain: ') + chalk.gray(userConfig.deployment.baseDomain));
    } else {
      console.log(chalk.white('  🌐 Base Domain: ') + chalk.red('❌ Not configured'));
    }

    console.log(chalk.white('\nConfiguration Status:'));
    if (config.isConfigured()) {
      console.log(chalk.green('  ✅ Ready to deploy! All required settings are configured.'));
      console.log(chalk.white('\nNext steps:'));
      console.log(chalk.white('  • Deploy your site: ') + chalk.green('nostr-deploy-cli deploy'));
      console.log(
        chalk.white('  • Check deployment status: ') + chalk.green('nostr-deploy-cli status')
      );
    } else {
      console.log(chalk.yellow('  ⚠️  Configuration incomplete. Missing required settings.'));
      console.log(chalk.white('\nRequired next steps:'));

      if (!userConfig.nostr?.publicKey) {
        console.log(
          chalk.white('  • Set up authentication: ') + chalk.green('nostr-deploy-cli auth')
        );
      }
      if (!userConfig.blossom?.serverUrl) {
        console.log(
          chalk.white('  • Configure Blossom server: ') + chalk.green('nostr-deploy-cli config')
        );
      }
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to load configuration: ${error}`));
    process.exit(1);
  }
}
