import { execSync } from 'child_process';
import chalk from 'chalk';

export interface TrixCheckResult {
  isInstalled: boolean;
  version?: string;
  error?: string;
}

/**
 * Check if trix is installed and available
 */
export function checkTrixInstallation(): TrixCheckResult {
  try {
    // Try to run trix --version to check if it's installed
    const output = execSync('trix --version', { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 5000 
    });
    
    const version = output.trim();
    return {
      isInstalled: true,
      version
    };
  } catch (error: any) {
    return {
      isInstalled: false,
      error: error.message
    };
  }
}

/**
 * Display helpful installation instructions for trix
 */
export function displayTrixInstallationInstructions(): void {
  console.log(chalk.red('❌ Trix compiler not found!'));
  console.log(chalk.yellow('\n📦 To install trix, run these commands:'));
  console.log(chalk.cyan('\n# Install tx3up installer'));
  console.log(chalk.white('curl --proto \'=https\' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh'));
  console.log(chalk.cyan('\n# Install trix'));
  console.log(chalk.white('tx3up'));
  console.log(chalk.yellow('\n💡 After installation, restart your development server.'));
}

/**
 * Check trix installation and display instructions if not found
 */
export function ensureTrixInstalled(verbose: boolean = false): boolean {
  const result = checkTrixInstallation();
  
  if (result.isInstalled) {
    if (verbose && result.version) {
      console.log(chalk.green(`✅ Trix compiler found: ${result.version}`));
    }
    return true;
  } else {
    displayTrixInstallationInstructions();
    return false;
  }
}
