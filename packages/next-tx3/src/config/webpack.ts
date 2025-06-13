import { Configuration as WebpackConfig } from 'webpack';
import { WebpackContext, TX3Config } from '../types/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function configureTX3Webpack(
  config: WebpackConfig,
  context: WebpackContext,
  tx3Config: TX3Config
): void {
  // Add TX3 loader for .tx3 files
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];

  // Add TX3 file loader
  config.module.rules.push({
    test: /\.tx3$/,
    use: [
      {
        loader: path.resolve(__dirname, '../loader/tx3-loader.js'),
        options: {
          tx3Path: tx3Config.tx3Path,
          verbose: tx3Config.verbose,
          trixOptions: tx3Config.trixOptions
        }
      }
    ]
  });

  // Add TypeScript path mapping for TX3 bindings
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  
  const bindingsPath = path.resolve(process.cwd(), tx3Config.tx3Path, 'bindings');
  
  // Ensure alias is an object, not an array
  if (Array.isArray(config.resolve.alias)) {
    config.resolve.alias = {};
  }
  
  (config.resolve.alias as Record<string, string>)['@tx3'] = bindingsPath;

  // Ensure TX3 files are watched in development
  if (context.dev && tx3Config.autoWatch) {
    config.watchOptions = config.watchOptions || {};
    config.watchOptions.ignored = config.watchOptions.ignored || [];
    
    // Remove TX3 directory from ignored paths if it exists
    if (Array.isArray(config.watchOptions.ignored)) {
      config.watchOptions.ignored = config.watchOptions.ignored.filter(
        (pattern: any) => !pattern.toString().includes(tx3Config.tx3Path)
      );
    }
  }

  // Add TX3 extensions to resolve
  config.resolve.extensions = config.resolve.extensions || [];
  if (!config.resolve.extensions.includes('.tx3')) {
    config.resolve.extensions.push('.tx3');
  }
}
