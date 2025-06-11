#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { authCommand } from './commands/auth';
import { configCommand } from './commands/config';
import { deployCommand } from './commands/deploy';
import { infoCommand } from './commands/info';
import { statusCommand } from './commands/status';

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('nostr-deploy-cli')
  .description('Deploy static sites using Nostr protocol and Blossom servers')
  .version(packageJson.version);

// Authentication command
program
  .command('auth')
  .description('Authenticate with Nostr')
  .option('-k, --key <key>', 'Nostr private key (nsec format)')
  .option('-p, --pubkey <pubkey>', 'Nostr public key (npub format)')
  .action(authCommand);

// Configuration command
program
  .command('config')
  .description('Configure deployment settings')
  .option('-r, --relays <relays...>', 'Nostr relay URLs (comma-separated or multiple values)')
  .option('-b, --blossom <url>', 'Blossom server URL')
  .option('-d, --domain <domain>', 'Base domain for subdomains')
  .action(configCommand);

// Info command
program
  .command('info')
  .description('Show local project configuration and authentication status')
  .action(infoCommand);

// Deploy command
program
  .command('deploy')
  .description('Deploy your static site')
  .option('-d, --dir <directory>', 'Directory to deploy (default: ./build or ./dist)')
  .option(
    '--skip-setup',
    'Skip auth and config steps, reuse existing config or auto-generate keypair and deploy'
  )
  .action(deployCommand);

// Status command
program
  .command('status')
  .description('Check deployment status')
  .option('-s, --subdomain <subdomain>', 'Check specific subdomain')
  .action(statusCommand);

// Help command
program
  .command('help')
  .description('Show help information')
  .action(() => {
    console.log(chalk.cyan('\n🌟 Nostr Deploy CLI\n'));
    console.log(
      chalk.white('A decentralized static site deployment tool using Nostr and Blossom servers.\n')
    );
    console.log(chalk.yellow('Each project has its own local configuration and Nostr identity.\n'));

    console.log(chalk.yellow('Quick Start:'));
    console.log(
      chalk.white('1. Set up project authentication: ') + chalk.green('nostr-deploy-cli auth')
    );
    console.log(
      chalk.white('2. Configure project settings: ') + chalk.green('nostr-deploy-cli config')
    );
    console.log(
      chalk.white('3. View project configuration: ') + chalk.green('nostr-deploy-cli info')
    );
    console.log(chalk.white('4. Deploy your site: ') + chalk.green('nostr-deploy-cli deploy'));
    console.log('');
    console.log(chalk.yellow('Configuration Options:'));
    console.log(
      chalk.white('Configure relays: ') + chalk.green('nostr-deploy-cli config --relays <urls>')
    );
    console.log('');
    console.log(chalk.yellow('Fast Deploy:'));
    console.log(
      chalk.white('Skip setup and deploy directly: ') +
        chalk.green('nostr-deploy-cli deploy --skip-setup')
    );
    console.log('');

    console.log(
      chalk.gray('💡 Note: Configuration is stored locally in .env.nostr-deploy.local file')
    );
    console.log(chalk.gray('   Each project can have its own Nostr identity and settings'));
    console.log('');

    program.help();
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.log(
    chalk.yellow('Run ') +
      chalk.green('nostr-deploy-cli help') +
      chalk.yellow(' for available commands.')
  );
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
