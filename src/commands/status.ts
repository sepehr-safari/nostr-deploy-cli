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
          chalk.green('nostr-deploy auth') +
          chalk.white(' and ') +
          chalk.green('nostr-deploy config')
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

        if (status.status === 'active') {
          const userConfig = config.getConfig();
          const baseDomain = userConfig.deployment?.baseDomain || 'nostrsite.dev';
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
      // List all user deployments
      console.log(chalk.blue('📋 Fetching your deployment history...\n'));

      try {
        const deployments = await deployment.listUserDeployments();

        if (deployments.length === 0) {
          console.log(chalk.yellow('No deployments found.'));
          console.log(
            chalk.white('Deploy your first site with: ') + chalk.green('nostr-deploy deploy')
          );
          return;
        }

        console.log(chalk.white(`Found ${deployments.length} deployment(s):\n`));

        for (let i = 0; i < deployments.length; i++) {
          const dep = deployments[i];
          const num = chalk.cyan(`${i + 1}.`);

          console.log(`${num} ${chalk.white(dep.siteName || 'Unnamed Site')}`);
          console.log(`   📍 URL: ${chalk.green(`https://${dep.subdomain}`)}`);
          console.log(`   📅 Deployed: ${chalk.gray(new Date(dep.deployedAt).toLocaleString())}`);
          console.log(`   🔗 Blossom: ${chalk.gray(dep.blossomUrl)}`);

          // Check live status
          try {
            const liveStatus = await deployment.getDeploymentStatus(
              dep.subdomain.replace(/^https?:\/\//, '').split('.')[0]
            );
            console.log(
              `   ${getStatusIcon(liveStatus.status)} Status: ${liveStatus.status.toUpperCase()}`
            );
          } catch {
            console.log(`   ❓ Status: UNKNOWN`);
          }

          console.log(''); // Empty line between deployments
        }

        console.log(chalk.cyan('Commands:'));
        console.log(
          chalk.white('• Check specific site: ') + chalk.green('nostr-deploy status -s <subdomain>')
        );
        console.log(chalk.white('• Deploy new site: ') + chalk.green('nostr-deploy deploy'));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to fetch deployments: ${error}`));
        console.log(chalk.yellow('\n💡 This might be due to:'));
        console.log(chalk.white('  • Network connectivity issues'));
        console.log(chalk.white('  • Nostr relay connectivity'));
        console.log(chalk.white('  • Authentication problems'));
      }
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Status check failed: ${error}`));
    process.exit(1);
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
      return '⚠️';
    case 'invalid':
      return '❌';
    default:
      return '❓';
  }
}
