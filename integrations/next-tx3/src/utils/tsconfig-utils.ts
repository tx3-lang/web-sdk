import fs from 'fs';
import path from 'path';
import { TX3Config } from '../types/index.js';

export interface TSConfig {
  compilerOptions?: {
    paths?: Record<string, string[]>;
    [key: string]: any;
  };
  [key: string]: any;
}

export function updateTSConfigPaths(projectPath: string, config: TX3Config): void {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  
  if (!fs.existsSync(tsconfigPath)) {
    console.warn('⚠️  tsconfig.json not found, skipping path alias configuration');
    return;
  }

  try {
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
    const tsconfig: TSConfig = JSON.parse(tsconfigContent);
    
    // Ensure compilerOptions exists
    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {};
    }
    
    // Ensure paths exists
    if (!tsconfig.compilerOptions.paths) {
      tsconfig.compilerOptions.paths = {};
    }
    
    // Calculate relative path from project root to TX3 bindings
    const relativeTX3Path = path.relative(projectPath, path.join(config.tx3Path, 'bindings'));
    const tx3PathAlias = `./${relativeTX3Path}/*`.replace(/\\/g, '/');
    
    // Add TX3 path aliases
    tsconfig.compilerOptions.paths['@tx3/*'] = [tx3PathAlias];
    
    // Write back the updated tsconfig
    const updatedContent = JSON.stringify(tsconfig, null, 2);
    fs.writeFileSync(tsconfigPath, updatedContent);
    
    if (config.verbose) {
      console.log(`✅ Updated tsconfig.json with TX3 path aliases: @tx3/* -> ${tx3PathAlias}`);
    }
  } catch (error) {
    console.error('❌ Failed to update tsconfig.json:', error);
  }
}

export function removeTSConfigPaths(projectPath: string): void {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  
  if (!fs.existsSync(tsconfigPath)) {
    return;
  }

  try {
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
    const tsconfig: TSConfig = JSON.parse(tsconfigContent);
    
    if (tsconfig.compilerOptions?.paths?.['@tx3/*']) {
      delete tsconfig.compilerOptions.paths['@tx3/*'];
      
      // Clean up empty paths object
      if (Object.keys(tsconfig.compilerOptions.paths).length === 0) {
        delete tsconfig.compilerOptions.paths;
      }
      
      const updatedContent = JSON.stringify(tsconfig, null, 2);
      fs.writeFileSync(tsconfigPath, updatedContent);
      
      console.log('✅ Removed TX3 path aliases from tsconfig.json');
    }
  } catch (error) {
    console.error('❌ Failed to remove TX3 paths from tsconfig.json:', error);
  }
}
