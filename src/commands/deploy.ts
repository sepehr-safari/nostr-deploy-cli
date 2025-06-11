import chalk from 'chalk';
import * as fs from 'fs-extra';
import ora from 'ora';
import * as path from 'path';
import { DeployOptions } from '../types';
import { ConfigManager } from '../utils/config';
import { DeploymentManager } from '../utils/deployment';

export async function deployCommand(options: DeployOptions): Promise<void> {
  const config = await ConfigManager.getInstance();
  const deployment = new DeploymentManager();
  let spinner: ReturnType<typeof ora>;

  try {
    console.log(chalk.cyan('\n🚀 Starting Deployment\n'));

    const projectName = path.basename(process.cwd());
    console.log(chalk.white('Project: ') + chalk.yellow(projectName));

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
      return;
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
      const result = await deployment.deployStaticSite(buildDir, {
        siteName: options.name,
        customSubdomain: options.subdomain,
      });

      spinner.succeed('Deployment completed successfully!');

      console.log(chalk.green('\n🎉 Deployment Successful!\n'));
      console.log(chalk.white('Deployment Details:'));
      console.log(chalk.white('  🌐 URL: ') + chalk.cyan(`https://${result.fullUrl}`));
      console.log(chalk.white('  🔑 NPub Subdomain: ') + chalk.blue(result.npubSubdomain));
      console.log(chalk.white('  📅 Deployed: ') + chalk.gray(result.deployedAt.toLocaleString()));
      console.log(chalk.white('  📁 Files: ') + chalk.yellow(result.fileCount.toString()));

      if (result.staticFileEventIds && result.staticFileEventIds.length > 0) {
        console.log(chalk.white('  📡 Static File Events:'));
        result.staticFileEventIds.forEach((eventId: string, index: number) => {
          console.log(
            chalk.white(`    ${index + 1}. `) + chalk.gray(eventId.substring(0, 16) + '...')
          );
        });
      }

      if (result.userServersEventId) {
        console.log(
          chalk.white('  🌸 User Servers Event: ') +
            chalk.gray(result.userServersEventId.substring(0, 16) + '...')
        );
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

async function getSiteNameFromPackageJson(): Promise<string | null> {
  try {
    const packageJsonPath = './package.json';
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJSON(packageJsonPath);
      return packageJson.name || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
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
