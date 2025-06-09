import { NextConfig } from 'next';
import { TX3PluginOptions, TX3Config, WebpackContext } from '../types/index.js';
import { configureTX3Webpack } from './webpack.js';
import { resolveTX3Config, ensureTX3Project, validateTX3Config, isPluginInitialized, markAsInitialized } from '../utils/config.js';
import { compileTX3 } from '../utils/tx3-compiler.js';
import { ensureTrixInstalled } from '../utils/trix-installer.js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import { Configuration as WebpackConfig } from 'webpack';

// Global watcher to prevent multiple instances
let globalWatcher: ReturnType<typeof chokidar.watch> | null = null;

async function initializeTX3Compilation(config: TX3Config): Promise<void> {
  try {
    // Check if TX3 files exist
    const tx3Files = fs.readdirSync(config.tx3Path)
      .filter((file: string) => file.endsWith('.tx3'));
    
    if (tx3Files.length > 0) {
      if (config.verbose) {
        console.log(chalk.blue('🔄 Compiling TX3 files...'));
      }
      
      try {
        const result = await compileTX3(config.tx3Path, config.trixOptions);
        if (result.success && config.verbose) {
          console.log(chalk.green(`✅ Compiled TX3 project`));
          if (result.bindings && result.bindings.length > 0) {
            console.log(chalk.gray(`   Generated bindings: ${result.bindings.join(', ')}`));
          }
        } else if (!result.success) {
          console.error(chalk.red(`❌ Failed to compile TX3 project:`), result.error);
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error compiling TX3 project:`), error);
      }
    }
    
    // Set up file watching if enabled (only once globally)
    if (config.autoWatch && process.env.NODE_ENV === 'development' && !globalWatcher) {
      globalWatcher = chokidar.watch(path.join(config.tx3Path, '*.tx3'));
      
      globalWatcher.on('change', async (filePath: string) => {
        if (config.verbose) {
          console.log(chalk.blue(`🔄 TX3 file changed: ${path.basename(filePath)}`));
        }
        
        try {
          const result = await compileTX3(config.tx3Path, config.trixOptions);
          if (result.success && config.verbose) {
            console.log(chalk.green(`✅ Recompiled: ${path.basename(filePath)}`));
          } else if (!result.success) {
            console.error(chalk.red(`❌ Failed to recompile ${path.basename(filePath)}:`), result.error);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error recompiling ${path.basename(filePath)}:`), error);
        }
      });
      
      if (config.verbose) {
        console.log(chalk.gray('👀 Watching TX3 files for changes...'));
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize TX3 compilation:'), error);
  }
}

export function withTX3(
  nextConfig: TX3PluginOptions = {}
): NextConfig {
  const resolvedTX3Config = resolveTX3Config(nextConfig.tx3, process.cwd());
  
  // Initialize TX3 project structure if needed (only once)
  if (!isPluginInitialized()) {
    try {
      // Check if trix is installed before proceeding
      const trixInstalled = ensureTrixInstalled(resolvedTX3Config.verbose);
      if (!trixInstalled) {
        console.log(chalk.yellow('\n⚠️  TX3 plugin will continue without compilation until trix is installed.'));
        markAsInitialized();
        return {
          ...nextConfig,
          webpack: (config: WebpackConfig, options: WebpackContext) => {
            configureTX3Webpack(config, options, resolvedTX3Config);
            if (typeof nextConfig.webpack === 'function') {
              return nextConfig.webpack(config, options);
            }
            return config;
          }
        };
      }
      
      ensureTX3Project(resolvedTX3Config, process.cwd());
      
      // Validate configuration and warn about issues
      const validationErrors = validateTX3Config(resolvedTX3Config);
      if (validationErrors.length > 0 && resolvedTX3Config.verbose) {
        console.log(chalk.yellow('⚠️  TX3 Configuration warnings:'));
        validationErrors.forEach(error => {
          console.log(chalk.yellow(`   - ${error}`));
        });
      }
      
      // Initialize compilation and file watching asynchronously
      initializeTX3Compilation(resolvedTX3Config);
      
      if (resolvedTX3Config.verbose) {
        console.log(chalk.blue('🎯 TX3 plugin initialized successfully'));
        console.log(chalk.gray(`   - TX3 path: ${resolvedTX3Config.tx3Path}`));
        console.log(chalk.gray(`   - Auto-watch: ${resolvedTX3Config.autoWatch}`));
      }
      
      // Mark as initialized to prevent duplicate initialization
      markAsInitialized();
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to initialize TX3 project:'), error);
    }
  }
  
  return {
    ...nextConfig,
    
    webpack: (config: WebpackConfig, options: WebpackContext) => {
      // Apply TX3 webpack configuration
      configureTX3Webpack(config, options, resolvedTX3Config);
      
      // Call user's webpack config if it exists
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      
      return config;
    },
    
    // Add development server middleware in development
    async rewrites() {
      const rewrites = await nextConfig.rewrites?.() || [];
      return rewrites;
    },
    
    // Ensure TX3 paths are configured in tsconfig
    typescript: {
      tsconfigPath: './tsconfig.json',
      ...nextConfig.typescript
    }
  };
}
