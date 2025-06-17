import { NextConfig } from 'next';
import { Configuration as WebpackConfig } from 'webpack';

export interface TX3Config {
  /** Path to TX3 files directory (default: './tx3') */
  tx3Path: string;
  
  /** Enable automatic file watching for TX3 changes (default: true) */
  autoWatch: boolean;
  
  /** Automatically create TX3 project structure if it doesn't exist (default: true) */
  autoSetup: boolean;
  
  /** Enable verbose logging (default: false) */
  verbose: boolean;
  
  /** Custom trix compiler options */
  trixOptions?: {
    /** Custom trix binary path */
    binaryPath?: string;
    /** Additional compiler flags */
    flags?: string[];
  };
}

export interface TX3PluginOptions {
  /** TX3-specific configuration */
  tx3?: Partial<TX3Config>;
  /** Allow any other Next.js config properties */
  [key: string]: any;
}

export interface WebpackContext {
  buildId: string;
  dev: boolean;
  isServer: boolean;
  defaultLoaders: {
    babel: any;
  };
  nextRuntime?: 'nodejs' | 'edge';
  webpack: typeof import('webpack');
}

export interface TX3LoaderOptions {
  tx3Path: string;
  verbose: boolean;
  trixOptions?: TX3Config['trixOptions'];
}

export interface TX3CompilerResult {
  success: boolean;
  output?: string;
  error?: string;
  bindings?: string[];
}

export interface ProjectSetupOptions {
  projectPath: string;
  tx3Config: TX3Config;
  force?: boolean;
}
