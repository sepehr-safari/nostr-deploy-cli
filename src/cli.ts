#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { authCommand } from './commands/auth';
import { configCommand } from './commands/config';
import { deployCommand } from './commands/deploy';
import { statusCommand } from './commands/status';

const program = new Command();

program
  .name('nostr-deploy-cli')
  .description('Deploy static sites using Nostr protocol and Blossom servers')
  .version('1.0.0');

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

// Deploy command
program
  .command('deploy')
  .description('Deploy your static site')
  .option('-d, --dir <directory>', 'Directory to deploy (default: ./build or ./dist)')
  .option('-n, --name <name>', 'Optional site name')
  .option('--subdomain <subdomain>', 'Custom subdomain (if available)')
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

    console.log(chalk.yellow('Quick Start:'));
    console.log(chalk.white('1. Authenticate: ') + chalk.green('nostr-deploy-cli auth'));
    console.log(chalk.white('2. Configure: ') + chalk.green('nostr-deploy-cli config'));
    console.log(chalk.white('3. Deploy: ') + chalk.green('nostr-deploy-cli deploy'));
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
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
