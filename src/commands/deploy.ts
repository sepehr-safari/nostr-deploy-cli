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

    // Check if user is authenticated and configured
    if (!config.isConfigured()) {
      console.log(chalk.red('❌ Configuration incomplete!'));
      console.log(chalk.white('Please run the following commands first:'));
      console.log(
        chalk.white('  1. ') +
          chalk.green('nostr-deploy auth') +
          chalk.white(' - Set up authentication')
      );
      console.log(
        chalk.white('  2. ') +
          chalk.green('nostr-deploy config') +
          chalk.white(' - Configure deployment settings')
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

    const indexPath = path.join(buildDir, 'index.html');
    if (!(await fs.pathExists(indexPath))) {
      console.log(chalk.red(`❌ No index.html found in: ${buildDir}`));
      console.log(chalk.white('Make sure your build directory contains a valid static site.'));
      return;
    }

    // Get site name
    const siteName = options.name || (await getSiteNameFromPackageJson()) || 'My Site';
    console.log(chalk.blue(`📝 Site name: ${siteName}`));

    // Start deployment process
    spinner = ora('Preparing deployment...').start();

    try {
      const result = await deployment.deployStaticSite(buildDir, {
        siteName,
        customSubdomain: options.subdomain,
      });

      spinner.succeed('Deployment completed successfully!');

      console.log(chalk.cyan('\n🎉 Deployment Complete!\n'));
      console.log(chalk.white('📍 Site URL: ') + chalk.green(`https://${result.fullUrl}`));
      console.log(chalk.white('🏷️  Subdomain: ') + chalk.blue(result.subdomain));
      console.log(chalk.white('🔗 Blossom URL: ') + chalk.gray(result.blossomManifestUrl));
      console.log(chalk.white('📡 Nostr Event: ') + chalk.gray(result.nostrEventId));
      console.log(chalk.white('⏰ Deployed at: ') + chalk.gray(result.deployedAt.toLocaleString()));

      console.log(chalk.cyan('\n📊 Next Steps:'));
      console.log(chalk.white('• Visit your site: ') + chalk.green(`https://${result.fullUrl}`));
      console.log(
        chalk.white('• Check deployment status: ') +
          chalk.green(`nostr-deploy status -s ${result.subdomain}`)
      );
      console.log(chalk.white('• View all deployments: ') + chalk.green('nostr-deploy status'));
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
          chalk.green('nostr-deploy auth') +
          chalk.yellow(' to set up authentication.')
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
