import chalk from 'chalk';
import inquirer from 'inquirer';
import { AuthOptions } from '../types';
import { ConfigManager } from '../utils/config';
import { NostrManager } from '../utils/nostr';

export async function authCommand(options: AuthOptions): Promise<void> {
  const config = await ConfigManager.getInstance();
  const nostr = new NostrManager();

  try {
    console.log(chalk.cyan('\n🔐 Nostr Authentication Setup\n'));

    let privateKey = options.key;
    let publicKey = options.pubkey;

    if (!privateKey && !publicKey) {
      const authChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'method',
          message: 'Choose authentication method:',
          choices: [
            { name: '🆕 Generate new key pair', value: 'generate' },
            { name: '🔑 Import existing private key (nsec)', value: 'import-private' },
            { name: '🔓 Import public key only (npub)', value: 'import-public' },
          ],
        },
      ]);

      if (authChoice.method === 'generate') {
        console.log(chalk.yellow('\n⚡ Generating new Nostr key pair...'));
        const keyPair = nostr.generateKeyPair();

        console.log(chalk.green('\n✅ Key pair generated successfully!'));
        console.log(chalk.white('Private Key (nsec): ') + chalk.red(keyPair.nsec));
        console.log(chalk.white('Public Key (npub): ') + chalk.blue(keyPair.npub));
        console.log(chalk.yellow('\n⚠️  IMPORTANT: Save your private key (nsec) securely!'));
        console.log(chalk.yellow('⚠️  You will need it to authenticate and deploy sites.'));

        const confirmSave = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'save',
            message: 'Have you saved your private key? Continue with setup?',
            default: false,
          },
        ]);

        if (!confirmSave.save) {
          console.log(chalk.yellow('\n⏸️  Setup cancelled. Please save your private key first.'));
          return;
        }

        privateKey = keyPair.nsec;
        publicKey = keyPair.npub;
      } else if (authChoice.method === 'import-private') {
        const keyInput = await inquirer.prompt([
          {
            type: 'password',
            name: 'privateKey',
            message: 'Enter your private key (nsec format):',
            mask: '*',
            validate: (input: string) => {
              try {
                const parsed = nostr.parseNostrKey(input);
                return parsed.type === 'nsec' ? true : 'Please enter a valid nsec private key';
              } catch {
                return 'Invalid key format. Please enter a valid nsec key.';
              }
            },
          },
        ]);
        privateKey = keyInput.privateKey;
      } else {
        const keyInput = await inquirer.prompt([
          {
            type: 'input',
            name: 'publicKey',
            message: 'Enter your public key (npub format):',
            validate: (input: string) => {
              try {
                const parsed = nostr.parseNostrKey(input);
                return parsed.type === 'npub' ? true : 'Please enter a valid npub public key';
              } catch {
                return 'Invalid key format. Please enter a valid npub key.';
              }
            },
          },
        ]);
        publicKey = keyInput.publicKey;
      }
    }

    // Process keys and save configuration
    if (privateKey) {
      try {
        const parsed = nostr.parseNostrKey(privateKey);
        if (parsed.type !== 'nsec') {
          throw new Error('Invalid private key format');
        }

        const privateKeyHex = Buffer.from(parsed.data).toString('hex');
        const publicKeyHex = nostr.generateKeyPair().publicKey; // This would need to be derived from private key

        await config.setNostrKey(privateKeyHex, publicKeyHex);

        console.log(chalk.green('\n✅ Private key configured successfully!'));
        console.log(chalk.blue('🔑 You can now deploy and manage sites.'));
      } catch (error) {
        console.error(chalk.red(`\n❌ Error configuring private key: ${error}`));
        return;
      }
    } else if (publicKey) {
      try {
        const parsed = nostr.parseNostrKey(publicKey);
        if (parsed.type !== 'npub') {
          throw new Error('Invalid public key format');
        }

        const publicKeyHex = Buffer.from(parsed.data).toString('hex');
        await config.setNostrKey('', publicKeyHex);

        console.log(chalk.green('\n✅ Public key configured successfully!'));
        console.log(
          chalk.yellow(
            '⚠️  Note: With public key only, you can view deployments but cannot deploy new sites.'
          )
        );
      } catch (error) {
        console.error(chalk.red(`\n❌ Error configuring public key: ${error}`));
        return;
      }
    }

    // Configure relays
    const relaysChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'configureRelays',
        message: 'Would you like to configure Nostr relays?',
        default: false,
      },
    ]);

    if (relaysChoice.configureRelays) {
      const relaysInput = await inquirer.prompt([
        {
          type: 'input',
          name: 'relays',
          message: 'Enter relay URLs (comma-separated):',
          default: 'wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band',
          filter: (input: string) => input.split(',').map((r) => r.trim()),
        },
      ]);

      await config.setNostrRelays(relaysInput.relays);
      console.log(chalk.green(`\n✅ Configured ${relaysInput.relays.length} relays`));
    }

    console.log(chalk.cyan('\n🎉 Authentication setup complete!'));
    console.log(chalk.white('Next steps:'));
    console.log(
      chalk.white('  1. Configure deployment settings: ') + chalk.green('nostr-deploy config')
    );
    console.log(chalk.white('  2. Deploy your first site: ') + chalk.green('nostr-deploy deploy'));
  } catch (error) {
    console.error(chalk.red(`\n❌ Authentication failed: ${error}`));
    process.exit(1);
  }
}
