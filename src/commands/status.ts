import chalk from 'chalk';
import { StatusOptions } from '../types';
import { ConfigManager } from '../utils/config';
import { DeploymentManager } from '../utils/deployment';

export async function statusCommand(options: StatusOptions): Promise<void> {
  const config = await ConfigManager.getInstance();
  const deployment = new DeploymentManager();

  try {
    console.log(chalk.cyan('\n📊 Deployment Status\n'));

    if (!config.isConfigured()) {
      console.log(chalk.red('❌ Configuration incomplete!'));
      console.log(
        chalk.white('Please run: ') +
          chalk.green('nostr-deploy-cli auth') +
          chalk.white(' and ') +
          chalk.green('nostr-deploy-cli config')
      );
      return;
    }

    if (options.subdomain) {
      // Check specific subdomain status
      console.log(chalk.blue(`🔍 Checking status for: ${options.subdomain}`));

      try {
        const status = await deployment.getDeploymentStatus(options.subdomain);

        console.log(chalk.white('\nStatus Details:'));
        console.log(
          chalk.white('  Status: ') +
            getStatusIcon(status.status) +
            ' ' +
            status.status.toUpperCase()
        );
        console.log(
          chalk.white('  SSL: ') +
            getSSLIcon(status.sslStatus) +
            ' ' +
            status.sslStatus.toUpperCase()
        );
        console.log(
          chalk.white('  Last Checked: ') + chalk.gray(status.lastChecked.toLocaleString())
        );

        if (status.responseTime) {
          console.log(chalk.white('  Response Time: ') + chalk.gray(`${status.responseTime}ms`));
        }

        if (status.fileCount) {
          console.log(
            chalk.white('  Files Deployed: ') + chalk.yellow(status.fileCount.toString())
          );
        }

        if (status.status === 'active') {
          const userConfig = config.getConfig();
          const baseDomain = userConfig.deployment?.baseDomain || 'nostrdeploy.com';
          console.log(
            chalk.green(`\n✅ Site is live at: https://${options.subdomain}.${baseDomain}`)
          );
        } else {
          console.log(chalk.yellow('\n⚠️  Site appears to be offline or experiencing issues.'));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Failed to check status: ${error}`));
      }
    } else {
      // List all deployments using new NIP format
      console.log(chalk.blue('📋 Fetching your deployment history from Nostr...'));

      try {
        const deployments = await deployment.listUserDeployments();
        const currentNpub = await deployment.getCurrentNpubSubdomain();

        if (deployments.length === 0) {
          console.log(chalk.yellow('\n📭 No deployments found.'));
          console.log(
            chalk.white('Deploy your first site with: ') + chalk.green('nostr-deploy-cli deploy')
          );
          console.log(
            chalk.white('Your sites will be available at: ') +
              chalk.cyan(`${currentNpub}.nostrdeploy.com`)
          );
          return;
        }

        console.log(chalk.green(`\nFound ${deployments.length} deployment(s):\n`));

        deployments.forEach((dep, index) => {
          console.log(chalk.white(`${index + 1}. Deployment`));
          console.log(
            chalk.white('   📍 URL: ') + chalk.cyan(`https://${currentNpub}.nostrdeploy.com`)
          );
          console.log(chalk.white('   📅 Deployed: ') + chalk.gray(dep.createdAt.toLocaleString()));
          console.log(chalk.white('   📁 Files: ') + chalk.yellow(dep.files.length.toString()));
          console.log(
            chalk.white('   📡 Event ID: ') + chalk.gray(dep.eventId.substring(0, 16) + '...')
          );

          if (index < deployments.length - 1) {
            console.log('');
          }
        });

        console.log(chalk.cyan('\n📊 Next Steps:'));
        console.log(
          chalk.white('• Check specific deployment: ') +
            chalk.green(`nostr-deploy-cli status -s ${currentNpub}`)
        );
        console.log(chalk.white('• Deploy new site: ') + chalk.green('nostr-deploy-cli deploy'));
        console.log(
          chalk.white('• Your npub subdomain: ') + chalk.cyan(`${currentNpub}.nostrdeploy.com`)
        );
      } catch (error) {
        console.error(chalk.red(`❌ Failed to fetch deployment history: ${error}`));
      }
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error}`));
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'active':
      return '✅';
    case 'inactive':
      return '❌';
    case 'error':
      return '⚠️';
    default:
      return '❓';
  }
}

function getSSLIcon(sslStatus: string): string {
  switch (sslStatus) {
    case 'valid':
      return '🔒';
    case 'expired':
      return '⏰';
    case 'invalid':
      return '🔓';
    default:
      return '❓';
  }
}
