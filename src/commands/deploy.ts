import chalk from 'chalk';
import * as fs from 'fs-extra';
import ora from 'ora';
import * as path from 'path';
import { DeployOptions } from '../types';
import { ConfigManager } from '../utils/config';
import { DeploymentManager } from '../utils/deployment';
import { NostrManager } from '../utils/nostr';

async function performAutoSetup(): Promise<void> {
  const config = await ConfigManager.getInstance();
  const nostr = new NostrManager();

  console.log(chalk.cyan('\n🔐 Skip-setup mode: Checking for existing configuration...\n'));

  // Check if there's already local configuration
  const hasLocalConfig = await config.hasLocalConfig();

  if (hasLocalConfig) {
    const userConfig = config.getConfig();

    // Check if we have existing auth configuration (either private key or public key)
    if (userConfig.nostr?.publicKey || userConfig.nostr?.privateKey) {
      console.log(chalk.green('✅ Found existing authentication configuration!'));

      if (userConfig.nostr.privateKey) {
        console.log(chalk.blue('🔑 Reusing existing private key for deployment'));
        // Try to get the npub for display
        try {
          const npub = await nostr.getNpubSubdomain();
          console.log(chalk.white('Public Key (npub): ') + chalk.blue(npub));
        } catch (error) {
          console.log(
            chalk.yellow('⚠️  Could not display npub, but proceeding with existing keys')
          );
        }
      } else if (userConfig.nostr.publicKey) {
        console.log(chalk.blue('🔍 Reusing existing public key (read-only mode)'));
        console.log(chalk.yellow('⚠️  Note: Public key only - cannot sign new deployments'));
      }

      // Still ensure other configuration is set up with defaults if missing
      if (!userConfig.nostr?.relays || userConfig.nostr.relays.length === 0) {
        const defaultRelays = ['wss://relay.nostr.band'];
        await config.setNostrRelays(defaultRelays);
        console.log(chalk.green('✅ Set up default Nostr relays'));
      }

      if (!userConfig.blossom?.serverUrl) {
        await config.setBlossomServer('https://blossom.primal.net');
        console.log(chalk.green('✅ Set up default Blossom server'));
      }

      if (!userConfig.deployment?.baseDomain) {
        await config.setBaseDomain('nostrdeploy.com');
        console.log(chalk.green('✅ Set up default base domain'));
      }

      console.log(chalk.green('✅ Existing configuration ready for deployment!'));
      return;
    }
  }

  // No existing auth config found, generate new keypair
  console.log(
    chalk.yellow('⚡ No existing auth config found - auto-generating new Nostr keypair...\n')
  );

  // Generate new keypair
  const keyPair = nostr.generateKeyPair();

  console.log(chalk.green('✅ Key pair generated successfully!'));
  console.log(chalk.white('Private Key (nsec): ') + chalk.red(keyPair.nsec));
  console.log(chalk.white('Public Key (npub): ') + chalk.blue(keyPair.npub));
  console.log(chalk.yellow('\n⚠️  IMPORTANT: Save your private key (nsec) securely!'));
  console.log(chalk.yellow('⚠️  This key pair is specific to this deployment.'));

  // Save the keypair
  await config.setNostrKey(keyPair.privateKey, keyPair.publicKey);

  // Set up minimal configuration with defaults
  const defaultRelays = ['wss://relay.nostr.band'];
  await config.setNostrRelays(defaultRelays);

  // Set up minimal blossom config with a default server
  const userConfig = config.getConfig();
  if (!userConfig.blossom?.serverUrl) {
    await config.setBlossomServer('https://blossom.primal.net');
  }

  // Set up default domain if not configured
  if (!userConfig.deployment?.baseDomain) {
    await config.setBaseDomain('nostrdeploy.com');
  }

  console.log(chalk.green('✅ Auto-configuration complete!'));
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  const config = await ConfigManager.getInstance();
  const deployment = new DeploymentManager();
  let spinner: ReturnType<typeof ora>;

  try {
    console.log(chalk.cyan('\n🚀 Starting Deployment\n'));

    const projectName = path.basename(process.cwd());
    console.log(chalk.white('Project: ') + chalk.yellow(projectName));

    // Handle skip-setup flag
    if (options.skipSetup) {
      console.log(chalk.yellow('⚡ Skip-setup mode enabled - auto-configuring...'));
      await performAutoSetup();
    } else {
      // Check if user is authenticated and configured
      const hasLocalConfig = await config.hasLocalConfig();
      if (!hasLocalConfig) {
        console.log(chalk.red('❌ No local configuration found for this project!'));
        console.log(chalk.white('This project needs to be set up before you can deploy.'));
        console.log(chalk.white('Please run the following commands first:'));
        console.log(
          chalk.white('  1. ') +
            chalk.green('nostr-deploy-cli auth') +
            chalk.white(' - Set up authentication for this project')
        );
        console.log(
          chalk.white('  2. ') +
            chalk.green('nostr-deploy-cli config') +
            chalk.white(' - Configure deployment settings')
        );
        console.log(
          chalk.white('  3. ') +
            chalk.green('nostr-deploy-cli info') +
            chalk.white(' - View project configuration')
        );
        console.log(
          chalk.white('Or use: ') +
            chalk.green('nostr-deploy-cli deploy --skip-setup') +
            chalk.white(' to auto-configure and deploy')
        );
        return;
      }

      if (!config.isConfigured()) {
        console.log(chalk.red('❌ Project configuration incomplete!'));
        console.log(chalk.white('Please run the following commands to complete setup:'));
        const userConfig = config.getConfig();
        if (!userConfig.nostr?.publicKey) {
          console.log(
            chalk.white('  • ') +
              chalk.green('nostr-deploy-cli auth') +
              chalk.white(' - Set up authentication')
          );
        }
        if (!userConfig.blossom?.serverUrl) {
          console.log(
            chalk.white('  • ') +
              chalk.green('nostr-deploy-cli config') +
              chalk.white(' - Configure deployment settings')
          );
        }
        console.log(
          chalk.white('  • ') +
            chalk.green('nostr-deploy-cli info') +
            chalk.white(' - View current configuration')
        );
        console.log(
          chalk.white('Or use: ') +
            chalk.green('nostr-deploy-cli deploy --skip-setup') +
            chalk.white(' to auto-configure and deploy')
        );
        return;
      }
    }

    // Determine build directory
    let buildDir = options.dir;
    if (!buildDir) {
      const possibleDirs = ['./build', './dist', './public', './out'];
      for (const dir of possibleDirs) {
        if (await fs.pathExists(dir)) {
          buildDir = dir;
          break;
        }
      }
    }

    if (!buildDir) {
      console.log(chalk.red('❌ No build directory found!'));
      console.log(
        chalk.white('Please specify a directory with: ') + chalk.green('--dir <directory>')
      );
      console.log(chalk.white('Common build directories: build, dist, public, out'));
      return;
    }

    console.log(chalk.blue(`📁 Using build directory: ${buildDir}`));

    // Validate build directory
    if (!(await fs.pathExists(buildDir))) {
      console.log(chalk.red(`❌ Build directory not found: ${buildDir}`));
      return;
    }

    const files = await fs.readdir(buildDir);
    if (files.length === 0) {
      console.log(chalk.red(`❌ Build directory is empty: ${buildDir}`));
      return;
    }

    console.log(chalk.blue(`📄 Found ${files.length} files to deploy`));

    // Start deployment
    spinner = ora('Preparing deployment...').start();

    try {
      const result = await deployment.deployStaticSite(buildDir);

      spinner.succeed('Deployment completed successfully!');

      console.log(chalk.green('\n🎉 Deployment Successful!\n'));
      console.log(chalk.white('Deployment Details:'));
      console.log(chalk.white('  🌐 URL: ') + chalk.cyan(`https://${result.fullUrl}`));
      console.log(chalk.white('  🔑 NPub Subdomain: ') + chalk.blue(result.npubSubdomain));
      console.log(chalk.white('  📅 Deployed: ') + chalk.gray(result.deployedAt.toLocaleString()));
      console.log(chalk.white('  📁 Files: ') + chalk.yellow(result.fileCount.toString()));

      if (result.staticFileEventResults && result.staticFileEventResults.length > 0) {
        console.log(chalk.white('  📡 Static File Events:'));
        result.staticFileEventResults.forEach((eventResult, index: number) => {
          console.log(
            chalk.white(`    ${index + 1}. `) +
              chalk.gray(eventResult.eventId.substring(0, 16) + '...')
          );
          // Show relay status for each event
          const successCount = eventResult.relayResults.filter((r) => r.success).length;
          const totalCount = eventResult.relayResults.length;
          if (successCount === totalCount) {
            console.log(chalk.white(`       ✅ Published to all ${totalCount} relays`));
          } else {
            console.log(
              chalk.yellow(`       ⚠️  Published to ${successCount}/${totalCount} relays`)
            );
            eventResult.relayResults.forEach((result) => {
              if (!result.success) {
                console.log(chalk.red(`         ❌ ${result.relay}: ${result.error}`));
              }
            });
          }
        });
      }

      if (result.userServersEventResult) {
        console.log(
          chalk.white('  🌸 User Servers Event: ') +
            chalk.gray(result.userServersEventResult.eventId.substring(0, 16) + '...')
        );
        // Show relay status for user servers event
        const successCount = result.userServersEventResult.relayResults.filter(
          (r) => r.success
        ).length;
        const totalCount = result.userServersEventResult.relayResults.length;
        if (successCount === totalCount) {
          console.log(chalk.white(`       ✅ Published to all ${totalCount} relays`));
        } else {
          console.log(chalk.yellow(`       ⚠️  Published to ${successCount}/${totalCount} relays`));
          result.userServersEventResult.relayResults.forEach((result) => {
            if (!result.success) {
              console.log(chalk.red(`         ❌ ${result.relay}: ${result.error}`));
            }
          });
        }
      }

      console.log(chalk.cyan('\n📖 About this deployment:'));
      console.log(
        chalk.white('Your site is deployed using the Pubkey Static Websites NIP standard.')
      );
      console.log(
        chalk.white('Each file is published as a kind 34128 event with path and hash information.')
      );
      console.log(chalk.white('Your npub serves as your unique subdomain identifier.'));

      // Exit successfully after deployment
      process.exit(0);
    } catch (error) {
      if (spinner) spinner.fail('Deployment failed');
      throw error;
    }
  } catch (error: unknown) {
    console.error(chalk.red(`\n❌ Deployment failed: ${error}`));

    // Provide helpful error messages
    const errorString = error instanceof Error ? error.message : String(error);
    if (errorString.includes('ENOENT')) {
      console.log(
        chalk.yellow('\n💡 Tip: Make sure your build directory exists and contains static files.')
      );
    } else if (errorString.includes('Network')) {
      console.log(chalk.yellow('\n💡 Tip: Check your internet connection and try again.'));
    } else if (errorString.includes('Authentication')) {
      console.log(
        chalk.yellow('\n💡 Tip: Run ') +
          chalk.green('nostr-deploy-cli auth') +
          chalk.yellow(' to set up authentication for this project.')
      );
    }

    process.exit(1);
  }
}

export async function findBuildDirectory(): Promise<string | null> {
  const possibleDirs = [
    './build',
    './dist',
    './public',
    './out',
    './_site', // Jekyll
    './docs', // GitHub Pages
    './www', // Ionic
  ];

  for (const dir of possibleDirs) {
    try {
      if (await fs.pathExists(dir)) {
        const indexPath = path.join(dir, 'index.html');
        if (await fs.pathExists(indexPath)) {
          return dir;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}
