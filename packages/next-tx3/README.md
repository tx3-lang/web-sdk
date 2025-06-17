# next-tx3

A Next.js plugin for seamless TX3 integration that automatically compiles TX3 files and generates TypeScript bindings during development.

## Features

- 🔄 **Automatic TX3 compilation** on dev server start and file changes
- 👀 **File watching** with hot reload for TX3 files during development
- 📦 **Webpack loader** for seamless TX3 file integration
- 🔗 **TypeScript path aliases** automatically configured (`@tx3/*`)
- 🚀 **Project auto-setup** with optional TX3 directory creation
- ⚡ **Zero configuration** - works out of the box

## Installation

```bash
npm install next-tx3
# or
yarn add next-tx3
# or
pnpm add next-tx3
```

## Prerequisites

Make sure you have the `trix` compiler installed:

```bash
# Install tx3up installer
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh

# Install trix
tx3up
```

## Quick Start

1. **Configure your Next.js project:**

```typescript
// next.config.ts
import type { NextConfig } from "next";
import { withTX3 } from "next-tx3";

const nextConfig: NextConfig = {
  /* your existing config */
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

2. **Start your development server:**

```bash
npm run dev
```

The plugin will automatically:
- Create the `./tx3` directory structure if it doesn't exist
- Generate a sample `main.tx3` file and `trix.toml` configuration
- Compile TX3 files and generate TypeScript bindings
- Set up file watching for automatic recompilation

## Configuration Options

### `tx3Path` (string)
- **Default:** `'./tx3'`
- **Description:** Path to the directory containing your TX3 files

### `autoWatch` (boolean)
- **Default:** `true`
- **Description:** Enable automatic file watching and recompilation during development

### `autoSetup` (boolean)
- **Default:** `true`
- **Description:** Automatically create TX3 project structure if it doesn't exist

### `verbose` (boolean)
- **Default:** `false`
- **Description:** Enable detailed logging for compilation and file watching

### `trixOptions` (object)
- **Optional:** Custom trix compiler options
- **Properties:**
  - `binaryPath`: Custom path to trix binary
  - `flags`: Additional compiler flags

## Project Structure

When `autoSetup` is enabled, the plugin creates this structure:

```
your-project/
├── tx3/
│   ├── main.tx3           # Your TX3 transaction definitions
│   ├── trix.toml          # Trix compiler configuration
│   └── bindings/          # Generated TypeScript bindings
│       ├── protocol.ts    # Auto-generated protocol bindings
│       └── package.json   # Bindings package configuration
├── next.config.ts         # Next.js config with TX3 plugin
└── tsconfig.json          # Auto-updated with @tx3/* path aliases
```

## Example TX3 File

The plugin generates a sample `main.tx3` file:

```tx3
party Sender;
party Receiver;

tx transfer(
    quantity: Int
) {
    input source {
        from: Sender,
        min_amount: Ada(quantity),
    }
    
    output {
        to: Receiver,
        amount: Ada(quantity),
    }

    output {
        to: Sender,
        amount: source - Ada(quantity) - fees,
    }
}
```

## TypeScript Integration

The plugin automatically:

1. **Configures TypeScript path aliases** in your `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@tx3/*": ["./tx3/bindings/*"]
       }
     }
   }
   ```

2. **Generates TypeScript bindings** from your TX3 files in `./tx3/bindings/`

3. **Provides type-safe imports** for your TX3 protocols:
   ```typescript
   import Protocol from '@tx3/protocol';
   import { transfer } from '@tx3/protocol';
   ```

## Development Workflow

1. **Write TX3 files** in the `./tx3/` directory
2. **Save changes** - the plugin automatically recompiles
3. **Import bindings** in your React components using `@tx3/*` aliases
4. **Build and deploy** - bindings are included in your production build

## Troubleshooting

### Trix Compiler Not Found
```
❌ Failed to compile TX3 project: trix process exited with code 127
```
**Solution:** Install the trix tool:
```bash
# Install tx3up installer
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh

# Install trix
tx3up
```

### TX3 Directory Not Found
```
⚠️ TX3 Configuration warnings:
   - TX3 directory does not exist: /path/to/tx3
```
**Solution:** Either:
- Set `autoSetup: true` to auto-create the directory
- Manually create the `./tx3` directory
- Update `tx3Path` to point to your existing TX3 directory

### TypeScript Path Aliases Not Working
**Solution:** Restart your TypeScript language server:
- In VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
- Or restart your development server

## Advanced Configuration

### Custom Trix Binary Path
```typescript
export default withTX3({
  tx3: {
    trixOptions: {
      binaryPath: '/custom/path/to/trix'
    }
  }
});
```

### Disable Auto-Setup
```typescript
export default withTX3({
  tx3: {
    autoSetup: false,  // Don't auto-create TX3 structure
    tx3Path: './custom-tx3-path'
  }
});
```

### Production Environment
```typescript
export default withTX3({
  tx3: {
    autoWatch: process.env.NODE_ENV === 'development',
    verbose: process.env.NODE_ENV === 'development'
  }
});
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
