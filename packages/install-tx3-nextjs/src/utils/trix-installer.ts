import { execSync } from 'child_process';
import chalk from 'chalk';

export class TrixInstaller {
  static async installTrix(verbose: boolean = false): Promise<void> {
    try {
      // Step 1: Install tx3up
      if (verbose) {
        console.log(chalk.blue('📥 Installing tx3up...'));
      }
      
      const tx3upCommand = `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh`;
      
      execSync(tx3upCommand, { 
        stdio: verbose ? 'inherit' : 'pipe'
      });
      
      if (verbose) {
        console.log(chalk.green('✅ tx3up installed successfully'));
      }

      // Step 2: Install trix using tx3up
      if (verbose) {
        console.log(chalk.blue('📥 Installing trix via tx3up...'));
      }
      
      execSync('tx3up', { 
        stdio: verbose ? 'inherit' : 'pipe'
      });
      
      if (verbose) {
        console.log(chalk.green('✅ trix installed successfully'));
      }
      
    } catch (error) {
      throw new Error(`Failed to install trix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static checkTrixInstalled(): boolean {
    try {
      execSync('trix --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}