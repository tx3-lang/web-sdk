import path from 'path';
import { fileURLToPath } from 'url';
import { FileUtils } from './file-utils.js';

export class DevnetInstaller {
  static copyDevnetFolder(targetDir: string = 'devnet'): void {
    try {
      // Get the current file's directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // Path to the devnet folder in the package
      const sourceDevnetPath = path.resolve(__dirname, '../../devnet');
      
      // Create target devnet directory
      FileUtils.createDirectory(targetDir);
      
      // Copy all files from source devnet to target
      const devnetFiles = [
        'alonzo.json',
        'byron.json', 
        'conway.json',
        'cshell.toml',
        'dolos.toml',
        'shelley.json'
      ];
      
      for (const file of devnetFiles) {
        const sourcePath = path.join(sourceDevnetPath, file);
        const targetPath = path.join(targetDir, file);
        
        if (FileUtils.fileExists(sourcePath)) {
          const content = FileUtils.readFile(sourcePath);
          FileUtils.writeFile(targetPath, content);
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to copy devnet folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  static hasDevnetFolder(targetDir: string = 'devnet'): boolean {
    return FileUtils.directoryExists(targetDir) && FileUtils.fileExists(path.join(targetDir, 'dolos.toml'));
  }
}