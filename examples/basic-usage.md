# Basic Usage Examples

This document shows common usage patterns for the Nostr Deploy CLI.

## First Time Setup

### 1. Install the CLI

```bash
npm install -g nostr-deploy-cli
```

### 2. Generate New Nostr Keys

```bash
nostr-deploy auth
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
```

### 3. Configure Deployment Settings

```bash
nostr-deploy config
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
  ◯ 🔒 SSL Provider
  ◯ 📡 DNS Provider

? Enter Blossom server URL: https://blossom.hzrd149.com
✅ Updated Blossom server: https://blossom.hzrd149.com

? Enter base domain for subdomains: nostrsite.dev
✅ Updated base domain: nostrsite.dev

🎉 Configuration complete!
You can now deploy sites using: nostr-deploy deploy
```

## Deploying Sites

### React App Deployment

```bash
# Build your React app
cd my-react-app
npm run build

# Deploy to Nostr/Blossom
nostr-deploy deploy
```

Output:

```
🚀 Starting Deployment

📁 Using build directory: ./build
📝 Site name: my-react-app

🚀 Starting deployment process...
📤 Uploading files to Blossom server...
📋 Creating site manifest...
🌐 Requesting subdomain...
🔒 Setting up DNS and SSL certificate...
📡 Publishing deployment metadata to Nostr...
✅ Deployment completed successfully!

🎉 Deployment Complete!

📍 Site URL: https://abc123.nostrsite.dev
🏷️  Subdomain: abc123
🔗 Blossom URL: https://blossom.hzrd149.com/sha256hash...
📡 Nostr Event: event1234567890...
⏰ Deployed at: 12/15/2023, 3:45:22 PM
```

### Vue.js App with Custom Name

```bash
cd my-vue-app
npm run build
nostr-deploy deploy -n "My Portfolio" --subdomain portfolio
```

### Next.js Static Export

```bash
cd my-nextjs-app
npm run build
npm run export
nostr-deploy deploy -d ./out -n "My Blog"
```

### Gatsby Site

```bash
cd my-gatsby-site
gatsby build
nostr-deploy deploy -d ./public
```

## Managing Deployments

### Check All Your Deployments

```bash
nostr-deploy status
```

Output:

```
📊 Deployment Status

📋 Fetching your deployment history...

Found 3 deployment(s):

1. My Portfolio
   📍 URL: https://portfolio.nostrsite.dev
   📅 Deployed: 12/15/2023, 3:45:22 PM
   🔗 Blossom: https://blossom.hzrd149.com/sha256hash1...
   ✅ Status: ACTIVE

2. my-react-app
   📍 URL: https://abc123.nostrsite.dev
   📅 Deployed: 12/14/2023, 2:30:15 PM
   🔗 Blossom: https://blossom.hzrd149.com/sha256hash2...
   ✅ Status: ACTIVE

3. My Blog
   📍 URL: https://def456.nostrsite.dev
   📅 Deployed: 12/13/2023, 1:20:45 PM
   🔗 Blossom: https://blossom.hzrd149.com/sha256hash3...
   ❓ Status: UNKNOWN
```

### Check Specific Site Status

```bash
nostr-deploy status -s abc123
```

Output:

```
📊 Deployment Status

🔍 Checking status for: abc123

Status Details:
  Status: ✅ ACTIVE
  SSL: 🔒 VALID
  Last Checked: 12/15/2023, 4:00:00 PM
  Response Time: 245ms

✅ Site is live at: https://abc123.nostrsite.dev
```

## Advanced Usage

### Using Existing Nostr Keys

If you already have Nostr keys from another client:

```bash
nostr-deploy auth -k nsec1your-existing-private-key...
```

### Custom Configuration

```bash
# Set custom relays
nostr-deploy config -r wss://relay1.com,wss://relay2.com

# Set custom Blossom server
nostr-deploy config -b https://my-blossom-server.com

# Set custom domain
nostr-deploy config -d mydomain.com
```

### Deploy with Specific Subdomain

```bash
nostr-deploy deploy --subdomain my-awesome-site
# Results in: https://my-awesome-site.nostrsite.dev
```

## Troubleshooting

### Configuration Issues

```bash
# Check current configuration
nostr-deploy config

# Reset authentication
rm -rf ~/.nostr-deploy
nostr-deploy auth
```

### Build Directory Not Found

```bash
# Specify build directory manually
nostr-deploy deploy -d ./my-custom-build-folder

# Common build directories by framework:
nostr-deploy deploy -d ./build      # React
nostr-deploy deploy -d ./dist       # Vue, Vite
nostr-deploy deploy -d ./public     # Gatsby
nostr-deploy deploy -d ./out        # Next.js export
nostr-deploy deploy -d ./_site      # Jekyll
```

### Network Issues

If you experience network issues:

1. Check your internet connection
2. Try different Nostr relays: `nostr-deploy config -r wss://relay.damus.io`
3. Verify Blossom server is accessible
4. Check firewall/proxy settings

## Integration with CI/CD

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

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
          nostr-deploy auth -k ${{ secrets.NOSTR_PRIVATE_KEY }}
          nostr-deploy config -b ${{ secrets.BLOSSOM_SERVER_URL }} -d ${{ secrets.BASE_DOMAIN }}

      - name: Deploy site
        run: nostr-deploy deploy -n "My Site (Auto-deployed)"
```

### Netlify Functions Alternative

You can also create a serverless function that uses the CLI internally for automated deployments.

---

These examples should get you started with the Nostr Deploy CLI. For more advanced usage, check the full documentation in the README.
