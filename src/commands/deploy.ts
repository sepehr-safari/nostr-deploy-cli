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

  // Check if there's already local configuration
  const hasLocalConfig = await config.hasLocalConfig();

  if (hasLocalConfig) {
    const userConfig = config.getConfig();

    // Check if we have existing auth configuration (either private key or public key)
    if (userConfig.nostr?.publicKey || userConfig.nostr?.privateKey) {
      console.log(chalk.green('✅ Using existing configuration'));

      // Still ensure other configuration is set up with defaults if missing
      if (!userConfig.nostr?.relays || userConfig.nostr.relays.length === 0) {
        const defaultRelays = [
          'wss://relay.nostr.band',
          'wss://nostrue.com',
          'wss://purplerelay.com',
          'wss://relay.primal.net',
        ];
        await config.setNostrRelays(defaultRelays);
      }

      if (!userConfig.blossom?.servers || userConfig.blossom.servers.length === 0) {
        await config.setBlossomServers([
          'https://cdn.hzrd149.com',
          'https://blossom.primal.net',
          'https://blossom.band',
          'https://blossom.f7z.io',
        ]);
      }

      if (!userConfig.deployment?.baseDomain) {
        await config.setBaseDomain('nostrdeploy.com');
      }

      return;
    }
  }

  // No existing auth config found, generate new keypair
  console.log(chalk.yellow('⚡ Generating new Nostr keypair...'));

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
  const defaultRelays = [
    'wss://relay.nostr.band',
    'wss://nostrue.com',
    'wss://purplerelay.com',
    'wss://relay.primal.net',
  ];
  await config.setNostrRelays(defaultRelays);

  // Set up minimal blossom config with a default server
  const userConfig = config.getConfig();
  if (!userConfig.blossom?.servers || userConfig.blossom.servers.length === 0) {
    await config.setBlossomServers([
      'https://cdn.hzrd149.com',
      'https://blossom.primal.net',
      'https://blossom.band',
      'https://blossom.f7z.io',
    ]);
  }

  // Set up default domain if not configured
  if (!userConfig.deployment?.baseDomain) {
    await config.setBaseDomain('nostrdeploy.com');
  }
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  const config = await ConfigManager.getInstance();
  const deployment = new DeploymentManager();
  let spinner: ReturnType<typeof ora>;

  try {
    console.log(chalk.cyan('\n🚀 Starting Deployment\n'));

    // Handle skip-setup flag
    if (options.skipSetup) {
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
        if (!userConfig.blossom?.servers || userConfig.blossom.servers.length === 0) {
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

    // Validate build directory
    if (!(await fs.pathExists(buildDir))) {
      console.log(chalk.red(`❌ Build directory not found: ${buildDir}`));
      return;
    }

    // Get all files recursively to show accurate count
    const getAllFiles = async (dirPath: string): Promise<string[]> => {
      const files: string[] = [];
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = `${dirPath}/${item.name}`;

        if (item.isDirectory()) {
          const subFiles = await getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }

      return files;
    };

    const files = await getAllFiles(buildDir);
    if (files.length === 0) {
      console.log(chalk.red(`❌ Build directory is empty: ${buildDir}`));
      return;
    }

    console.log(chalk.blue(`📄 Deploying ${files.length} files from ${buildDir}`));

    // Start deployment
    spinner = ora('Preparing deployment...').start();

    try {
      const result = await deployment.deployStaticSite(buildDir);

      spinner.succeed('Deployment completed successfully!');

      console.log(chalk.green('\n🎉 Deployment Successful!\n'));
      console.log(chalk.white('  🌐 URL: ') + chalk.cyan(`https://${result.fullUrl}`));
      console.log(chalk.white('  📁 Files: ') + chalk.yellow(result.fileCount.toString()));
      console.log(chalk.white('  📅 Deployed: ') + chalk.gray(result.deployedAt.toLocaleString()));

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
