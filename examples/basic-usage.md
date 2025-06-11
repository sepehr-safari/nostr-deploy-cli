# Basic Usage Examples - Pubkey Static Websites NIP

This document shows how to use the Nostr Deploy CLI with the **Pubkey Static Websites NIP** standard, where your Nostr public key (npub) becomes your unique subdomain.

## First Time Setup

### 1. Install the CLI

```bash
npm install -g nostr-deploy-cli
```

### 2. Generate New Nostr Keys

```bash
nostr-deploy-cli auth
```

Choose "Generate new key pair" and save your keys securely:

```
🔐 Nostr Authentication Setup

? Choose authentication method: 🆕 Generate new key pair

⚡ Generating new Nostr key pair...

✅ Key pair generated successfully!
Private Key (nsec): nsec1abc123def456...
Public Key (npub): npub1xyz789ghi012...

⚠️  IMPORTANT: Save your private key (nsec) securely!
⚠️  You will need it to authenticate and deploy sites.

? Have you saved your private key? Continue with setup? Yes

✅ Private key configured successfully!
🔑 You can now deploy and manage sites.
📍 Your sites will be deployed to: npub1xyz789ghi012....nostrdeploy.com
```

**Important**: Your npub becomes your permanent subdomain. All your sites will be deployed to the same npub subdomain.

### 3. Configure Deployment Settings

```bash
nostr-deploy-cli config
```

Interactive configuration:

```
⚙️  Deployment Configuration

Current configuration:
  Nostr relays: wss://relay.damus.io, wss://nos.lol, wss://relay.nostr.band
  Blossom server: Not configured
  Base domain: Not configured

? What would you like to configure?
❯ ◉ 🌸 Blossom Server
  ◉ 🌐 Base Domain
  ◯ 📡 DNS Provider

? Enter Blossom server URL: https://blossom.hzrd149.com
✅ Updated Blossom server: https://blossom.hzrd149.com

? Enter base domain for subdomains: nostrdeploy.com
✅ Updated base domain: nostrdeploy.com

🎉 Configuration complete!
You can now deploy sites using: nostr-deploy-cli deploy
```

## Deploying Sites

### React App Deployment

```bash
# Build your React app
cd my-react-app
npm run build

# Deploy to your npub subdomain
nostr-deploy-cli deploy
```

Output:

```
🚀 Starting Deployment

📁 Using build directory: ./build
📝 Site name: my-react-app

🚀 Starting deployment process...
🔑 Generating npub subdomain...
🌐 Subdomain: npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
📤 Uploading files to Blossom server...
📋 Preparing static file events...
📡 Publishing to Nostr using Pubkey Static Websites NIP...
📡 Publishing static file events (kind 34128)...
📡 Publishing user servers event (kind 10063)...
✅ Deployment completed successfully!

🎉 Deployment Complete!

📍 Site URL: https://npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
🔑 NPub Subdomain: npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78
📁 Files deployed: 15
📡 Static file events: 15
🌸 User servers event: note1abc123def456...
⏰ Deployed at: 12/15/2023, 3:45:22 PM

📊 Next Steps:
• Visit your site: https://npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
• Check deployment status: nostr-deploy-cli status -s npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78
• View all deployments: nostr-deploy-cli status

🔗 About Pubkey Static Websites:
Your site is deployed using the Pubkey Static Websites NIP standard.
Each file is published as a kind 34128 event with path and hash information.
Your npub serves as your unique subdomain identifier.
```

### Vue.js App with Custom Name

```bash
cd my-vue-app
npm run build
nostr-deploy-cli deploy -n "My Portfolio"
```

### Next.js Static Export

```bash
cd my-nextjs-app
npm run build
npm run export
nostr-deploy-cli deploy -d ./out -n "My Blog"
```

## Managing Deployments

### Check All Your Deployments

```bash
nostr-deploy-cli status
```

Output:

```
📊 Deployment Status

📋 Fetching your deployment history from Nostr...

Found 3 deployment(s):

1. Deployment
   📍 URL: https://npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
   📅 Deployed: 12/15/2023, 3:45:22 PM
   📁 Files: 15
   📡 Event ID: note1abc123def456...

2. Deployment
   📍 URL: https://npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
   📅 Deployed: 12/14/2023, 2:30:15 PM
   📁 Files: 8
   📡 Event ID: note1def456ghi789...

3. Deployment
   📍 URL: https://npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
   📅 Deployed: 12/13/2023, 1:20:45 PM
   📁 Files: 12
   📡 Event ID: note1ghi789abc123...

📊 Next Steps:
• Check specific deployment: nostr-deploy-cli status -s npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78
• Deploy new site: nostr-deploy-cli deploy
• Your npub subdomain: npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
```

### Check Specific Site Status

```bash
nostr-deploy-cli status -s npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78
```

Output:

```
📊 Deployment Status

🔍 Checking status for: npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78

Status Details:
  Status: ✅ ACTIVE
  Last Checked: 12/15/2023, 4:00:00 PM
  Response Time: 245ms
  Files Deployed: 15

✅ Site is live at: https://npub1xyz789ghi012abc456def789ghi012abc456def789ghi012abc456def78.nostrdeploy.com
```

## Understanding the Pubkey Static Websites NIP

### How Your NPub Subdomain Works

1. **Consistent Identity**: Your npub is derived from your Nostr public key and never changes
2. **Cryptographic Verification**: Anyone can verify that your site belongs to your Nostr identity
3. **Decentralized**: No central registry - your subdomain is determined by cryptography

### Static File Events (Kind 34128)

Each file in your deployment creates a Nostr event like this:

```json
{
  "kind": 34128,
  "content": "",
  "pubkey": "your-hex-public-key",
  "tags": [
    ["d", "/index.html"],
    ["x", "186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99"]
  ]
}
```

- `d` tag: Absolute path of the file
- `x` tag: SHA-256 hash of the file content

### User Servers Event (Kind 10063)

Specifies which Blossom servers host your files:

```json
{
  "kind": 10063,
  "content": "",
  "pubkey": "your-hex-public-key",
  "tags": [["server", "https://blossom.hzrd149.com"]]
}
```

## Advanced Usage

### Using Existing Nostr Keys

If you already have Nostr keys from another client:

```bash
nostr-deploy-cli auth -k nsec1your-existing-private-key...
```

Your existing npub will become your subdomain, maintaining consistency across Nostr applications.

### Custom Configuration

```bash
# Set custom relays
nostr-deploy-cli config -r wss://relay1.com,wss://relay2.com

# Set custom Blossom server
nostr-deploy-cli config -b https://my-blossom-server.com

# Set custom domain (if you're running your own host server)
nostr-deploy-cli config -d mydomain.com
```

## Troubleshooting

### NPub Too Long for DNS

NPub subdomains are quite long. If you encounter DNS issues:

1. Ensure your DNS provider supports long subdomains
2. Consider using a shorter custom domain if you control the host server
3. The CLI handles this automatically for nostrdeploy.com

### File Not Found (404 Handling)

The NIP specifies fallback behavior:

- `/` → `/index.html`
- `/blog/` → `/blog/index.html`
- Missing files → `/404.html`

Make sure to include a `404.html` file in your build directory for custom error pages.

### Verifying Your Deployment

You can verify your deployment by:

1. Checking the Nostr events on your relays
2. Verifying file hashes match what's on Blossom servers
3. Confirming your npub subdomain resolves correctly

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy to Nostr

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build site
        run: npm run build

      - name: Install Nostr Deploy CLI
        run: npm install -g nostr-deploy-cli

      - name: Configure Nostr Deploy
        run: |
          nostr-deploy-cli auth -k ${{ secrets.NOSTR_PRIVATE_KEY }}
          nostr-deploy-cli config -b ${{ secrets.BLOSSOM_SERVER_URL }} -d ${{ secrets.BASE_DOMAIN }}

      - name: Deploy site
        run: nostr-deploy-cli deploy -n "My Site (Auto-deployed)"
```

### Environment Variables for CI/CD

Set these secrets in your repository settings:

- `NOSTR_PRIVATE_KEY`: Your Nostr private key (nsec format)
- `BLOSSOM_SERVER_URL`: Your preferred Blossom server
- `BASE_DOMAIN`: Your base domain (nostrdeploy.com)

Your site will always deploy to the same npub subdomain, providing consistency across deployments.

---

These examples should get you started with the Nostr Deploy CLI. For more advanced usage, check the full documentation in the README.
