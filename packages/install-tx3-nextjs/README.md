# TX3 Installer CLI

A CLI tool that creates new Next.js projects with TX3 capabilities or adds TX3 to existing Next.js projects. Features shadcn/ui integration, optional trix installation, devnet setup for local testing, and automated TX3 setup via the next-tx3 plugin.

## Installation

```bash
# Install globally
npm install -g install-tx3-nextjs

# Or use directly with npx
npx install-tx3-nextjs
```

## Usage

### Create New Project (Recommended)

Create a new Next.js project with TX3, shadcn/ui, and a working demo:

```bash
# Create new project with TX3 setup
npx install-tx3-nextjs init my-tx3-app

# Preview what will be created
npx install-tx3-nextjs init my-tx3-app --dry-run
```

### Add TX3 to Existing Project

Navigate to your existing Next.js project directory and run:

```bash
# Add TX3 to existing project
npx install-tx3-nextjs install

# Preview changes without applying them
npx install-tx3-nextjs install --dry-run

# Force reinstall
npx install-tx3-nextjs install --force
```

### Additional Commands

```bash
# Check installation status (coming soon)
npx install-tx3-nextjs --status

# Remove TX3 from project (coming soon)
npx install-tx3-nextjs --remove
```

## What it does

### For New Projects (`init` command)

Creates a complete TX3-enabled Next.js project:

1. **Optionally installs** trix via tx3up (recommended)
2. **Creates** Next.js project with optimal configuration
3. **Initializes** shadcn/ui with essential components
4. **Installs** TX3 packages: `tx3-sdk`, `next-tx3`
5. **Configures** `next.config.js` with the next-tx3 plugin
6. **Replaces** `app/page.tsx` with TX3 demo page
7. **Creates** `.env.local` with TX3 environment variables
8. **Optionally sets up** devnet configuration (if trix is available)

**The next-tx3 plugin automatically handles:**
- TX3 folder and file creation
- TypeScript path mappings (`@tx3/*`, `@tx3`)
- File watching and compilation
- Development workflow integration

### For Existing Projects (`install` command)

Adds TX3 capabilities to existing Next.js projects:

1. **Validates** your Next.js project
2. **Optionally installs** trix via tx3up (recommended)
3. **Installs** TX3 packages: `tx3-sdk`,`next-tx3`
4. **Updates/creates** `next.config.js` with the next-tx3 plugin
5. **Optionally sets up** devnet configuration (if trix is available)
6. **Preserves** all existing functionality

**The next-tx3 plugin automatically handles:**
- TX3 folder and file creation
- TypeScript path mappings (`@tx3/*`, `@tx3`)
- File watching and compilation
- Development workflow integration

## Next.js Configuration

The installer configures your `next.config.js` with the next-tx3 plugin:

```javascript
import { withTX3 } from 'next-tx3';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js config here
};

export default withTX3({
  ...nextConfig,
  tx3: {
    tx3Path: './tx3',        // Path to TX3 files (default: './tx3')
    autoWatch: true,         // Enable file watching (default: true)
    autoSetup: true,         // Auto-create TX3 structure (default: true)
    verbose: true            // Enable detailed logging (default: false)
  }
});
```

The plugin automatically handles TypeScript configuration and path mappings.

## Trix Installation

The installer can optionally install the trix (TX3 package manager) via tx3up:

- **Automatic detection**: Checks if trix is already installed
- **Interactive prompt**: Asks if you want to install trix (defaults to yes)
- **Non-blocking**: Continues with setup even if trix installation fails
- **Manual fallback**: Provides manual installation instructions if needed

**Manual installation commands:**
```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh
tx3up
```

## Devnet Configuration

When trix is available, the installer can optionally set up a local devnet for testing:

- **Automatic setup**: Copies devnet configuration files to your project
- **Dolos integration**: Pre-configured for local Cardano devnet
- **Easy start**: Adds `devnet:start` script to package.json

**Devnet files included:**
- `devnet/dolos.toml` - Main dolos configuration
- `devnet/alonzo.json` - Alonzo era configuration
- `devnet/byron.json` - Byron era configuration
- `devnet/conway.json` - Conway era configuration
- `devnet/shelley.json` - Shelley era configuration
- `devnet/cshell.toml` - Additional configuration

**Usage:**
```bash
# Start the local devnet
npm run devnet:start

# In another terminal, explore the devnet from tx3 folder
cd tx3
trix explore
```

## Environment Configuration

For new projects, a `.env.local` file is created:

```bash
# TX3 Protocol Configuration
NEXT_PUBLIC_TRP_ENDPOINT="http://localhost:8164"
NEXT_PUBLIC_TRP_API_KEY=""
```

## Package.json Scripts

The installer only adds devnet-related scripts if devnet setup is selected:

```json
{
  "scripts": {
    "devnet:start": "cd devnet && dolos daemon"
  }
}
```

**Note:** TX3 compilation and watching is now handled automatically by the next-tx3 plugin during `npm run dev`. No additional scripts are needed!

## Safety Features

- **Backup Creation**: All modified files are backed up to `.tx3-backup/`
- **Project Validation**: Ensures you're in a valid Next.js project
- **Conflict Detection**: Warns about potential conflicts
- **Rollback Support**: Automatic rollback on installation failure
- **Non-destructive**: Preserves all existing functionality

## Development Workflow

### For New Projects

After running `init`:

1. `cd your-project-name`
2. Update `.env.local` with your TX3 endpoint and API key
3. Run `npm run dev` to start development
4. The next-tx3 plugin will automatically create the `tx3/` folder and setup
5. Add your TX3 code to `tx3/` files and start building!
6. **Optional**: Start local devnet with `npm run devnet:start`

### For Existing Projects

After running `install`:

1. Create `.env.local` with TX3 environment variables (if needed)
2. Run `npm run dev` to start development
3. The next-tx3 plugin will automatically create the `tx3/` folder and setup
4. Add your TX3 code to `tx3/` files and start building!
5. **Optional**: Start local devnet with `npm run devnet:start` (if devnet was set up)

### Development with Devnet

If you included devnet setup:

1. **Start devnet**: `npm run devnet:start` (runs dolos daemon)
2. **Explore devnet**: In another terminal, run `cd tx3 && trix explore`
3. **Develop**: Run `npm run dev` for your Next.js app

The next-tx3 plugin automatically:
- Watches for changes in TX3 files
- Compiles TX3 files and generates TypeScript bindings
- Updates TypeScript path mappings
- Integrates seamlessly with Next.js development workflow

## Package Manager Support

The installer automatically detects and uses your project's package manager:
- **npm** (default)
- **yarn** (detected by `yarn.lock`)
- **pnpm** (detected by `pnpm-lock.yaml`)

## Requirements

- Node.js 18+ (recommended for latest features)
- Supported package managers: npm, yarn, pnpm
- For `install` command: Existing Next.js project

## Examples

### Create New Project
```bash
npx install-tx3-nextjs init my-tx3-app

# Output:
# 🚀 Initializing new Next.js project with TX3...
# 🏗️ Creating Next.js project with shadcn/ui...
# 📁 Project created in: my-tx3-app
# 🔧 Installing TX3 capabilities...
# ⚙️ Updating Next.js configuration...
# 📄 Creating TX3 example page...
# ⚙️ Creating environment configuration...
# 🎉 Project created successfully in 'my-tx3-app'!
```

### Add to Existing Project
```bash
cd my-existing-nextjs-app
npx install-tx3-nextjs install

# Output:
# 🔍 Checking Next.js project...
# ✅ Next.js project detected!
# 📦 Using package manager: npm
# 📝 Creating backup...
# 🔧 Installing TX3 packages...
# ⚙️ Updating Next.js configuration...
# 🎉 TX3 installation completed successfully!
```

### Preview Changes
```bash
npx install-tx3-nextjs init my-app --dry-run
npx install-tx3-nextjs install --dry-run

# Shows preview of all actions without applying them
```

## Troubleshooting

### "Not a Next.js project" Error (install command only)
Ensure you're in a directory with:
- A `package.json` file
- Next.js as a dependency
- Typical Next.js project structure (`pages/`, `app/`, or `next.config.*`)

### Node.js Version Compatibility
If you encounter package version conflicts:
- Ensure you're using Node.js 18+
- Some dependencies require newer Node.js versions

### Package Installation Failures
Ensure you have:
- A stable internet connection
- Proper npm/yarn/pnpm configuration
- Sufficient disk space
- Correct permissions for global package installation

### TX3 Demo Page Not Working
If the demo page shows errors:
- Check `.env.local` configuration
- Ensure `NEXT_PUBLIC_TRP_ENDPOINT` points to a valid TX3 endpoint
- Verify TX3 packages are properly installed

### Trix Installation Issues
If trix installation fails:
- Check internet connection for downloading tx3up
- Ensure you have curl installed
- Try manual installation using the commands in the Trix Installation section
- Installation will continue even if trix fails - you can install it manually later

### Devnet Issues
If devnet setup fails or doesn't work:
- Ensure trix is properly installed (`trix --version`)
- Check that dolos is installed and available in PATH
- Verify devnet configuration files exist in `devnet/` folder
- Try running `npm run devnet:start` manually to see error messages
- Use `cd tx3 && trix explore` to interact with the devnet once it's running

## License

MIT

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/txpipe/install-tx3-nextjs).