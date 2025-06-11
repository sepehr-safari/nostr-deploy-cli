#!/bin/bash

echo "🚀 Setting up Nostr Deploy CLI development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Make CLI executable
echo "🔧 Setting up CLI..."
chmod +x dist/cli.js

# Create global symlink for development
echo "🔗 Creating global symlink..."
npm link

echo "✅ Development setup complete!"
echo ""
echo "🎉 You can now test the CLI:"
echo "   nostr-deploy-cli help"
echo "   nostr-deploy-cli auth"
echo "   nostr-deploy-cli config"
echo ""
echo "📝 To make changes:"
echo "   1. Edit files in src/"
echo "   2. Run: npm run build"
echo "   3. Test: nostr-deploy-cli <command>"
echo ""
echo "🧪 To run tests:"
echo "   npm test"
echo ""
echo "📚 For more info, see README.md" 