import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ProjectValidator } from '../utils/validation.js';
import { PackageUtils } from '../utils/package-utils.js';
import { FileUtils, BackupEntry } from '../utils/file-utils.js';
import { TrixInstaller } from '../utils/trix-installer.js';
import { DevnetInstaller } from '../utils/devnet-installer.js';
import { withTX3Template } from '../templates/next-config.js';

interface InstallOptions {
  dryRun?: boolean;
  force?: boolean;
  fresh?: boolean; // For fresh projects created by init command
  verbose?: boolean; // Show more detailed output
}

export async function installCommand(options: InstallOptions = {}): Promise<void> {
  if (!options.verbose) {
    console.log(chalk.blue('🔍 Checking Next.js project...'));
  }

  // Validate project - use different validation for fresh projects
  const validation = options.fresh 
    ? ProjectValidator.validateFreshProject()
    : ProjectValidator.validateNextJsProject();
  
  if (!validation.isValid) {
    console.error(chalk.red('❌ Project validation failed:'));
    validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
    throw new Error('Project validation failed');
  }

  // Show warnings
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('⚠️  Warnings:'));
    validation.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
    
    if (!options.force && validation.warnings.some(w => w.includes('TX3 files already exist'))) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'TX3 appears to already be installed. Continue anyway?',
        default: false
      }]);
      
      if (!proceed) {
        console.log(chalk.yellow('Installation cancelled.'));
        return;
      }
    }
  }

  if (options.fresh) {
    console.log(chalk.green('✅ Fresh project ready for TX3 installation!'));
  } else {
    console.log(chalk.green('✅ Next.js project detected!'));
  }

  // Detect package manager
  const packageManager = PackageUtils.detectPackageManager();
  console.log(chalk.blue(`📦 Using package manager: ${packageManager}`));

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN - No changes will be made'));
    await showDryRunPreview();
    return;
  }

  // Check if trix is already installed (only for non-verbose mode)
  let installTrix = false;
  if (!options.verbose) {
    const trixInstalled = TrixInstaller.checkTrixInstalled();
    
    if (!trixInstalled) {
      const { shouldInstallTrix } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldInstallTrix',
        message: 'Install trix (TX3 compiler) via tx3up? (Recommended for local development)',
        default: true
      }]);
      installTrix = shouldInstallTrix;
    } else {
      console.log(chalk.green('✅ trix is already installed'));
    }
  }

  // Ask about devnet setup if trix is available (only for non-verbose mode)
  let includeDevnet = false;
  if (!options.verbose) {
    const currentTrixInstalled = TrixInstaller.checkTrixInstalled();
    const hasTrix = currentTrixInstalled || installTrix;
    if (hasTrix) {
      const { shouldIncludeDevnet } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldIncludeDevnet',
        message: 'Include devnet setup for local testing? (Adds dolos configuration)',
        default: true
      }]);
      includeDevnet = shouldIncludeDevnet;
    }
  }

  // Confirm installation
  const { confirmInstall } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmInstall',
    message: 'Install TX3 capabilities to this Next.js project?',
    default: true
  }]);

  if (!confirmInstall) {
    console.log(chalk.yellow('Installation cancelled.'));
    return;
  }

  const backups: BackupEntry[] = [];
  let spinner = options.verbose ? null : ora();

  try {
    // Install trix if requested
    if (installTrix) {
      if (spinner) {
        spinner.start('🔧 Installing trix via tx3up...');
      } else {
        console.log(chalk.blue('🔧 Installing trix via tx3up...'));
      }
      
      try {
        await TrixInstaller.installTrix(!spinner);
        if (spinner) {
          spinner.succeed('🔧 trix installed successfully');
        } else {
          console.log(chalk.green('🔧 trix installed successfully'));
        }
      } catch (error) {
        if (spinner) {
          spinner.warn('⚠️ trix installation failed, but continuing with TX3 setup');
        } else {
          console.log(chalk.yellow('⚠️ trix installation failed, but continuing with TX3 setup'));
        }
        console.log(chalk.yellow(`You can install trix manually later with: curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh && tx3up`));
      }
    }

    // Create backup
    if (spinner) {
      spinner.start('📝 Creating backup...');
    } else {
      console.log(chalk.blue('📝 Creating backup...'));
    }
    FileUtils.ensureBackupDir();
    
    // Backup files that will be modified
    const filesToBackup = [
      'package.json',
      'next.config.js',
      'next.config.mjs', 
      'next.config.ts'
    ].filter(file => FileUtils.fileExists(file));

    for (const file of filesToBackup) {
      backups.push(FileUtils.backupFile(file));
    }
    if (spinner) {
      spinner.succeed('📝 Backup created');
    } else {
      console.log(chalk.green('📝 Backup created'));
    }

    // Install packages
    if (spinner) {
      spinner.start('🔧 Installing TX3 packages...');
    } else {
      console.log(chalk.blue('🔧 Installing TX3 packages...'));
    }
    const requiredPackages = ['tx3-sdk', 'next-tx3'];
    
    const missingPackages = PackageUtils.getMissingPackages(requiredPackages);
    
    if (missingPackages.length > 0) {
      PackageUtils.installPackages(missingPackages);
    }
    if (spinner) {
      spinner.succeed('🔧 TX3 packages installed');
    } else {
      console.log(chalk.green('🔧 TX3 packages installed'));
    }


    // Update Next.js configuration
    if (spinner) {
      spinner.start('⚙️ Updating Next.js configuration...');
    } else {
      console.log(chalk.blue('⚙️ Updating Next.js configuration...'));
    }
    await updateNextConfig();
    if (spinner) {
      spinner.succeed('⚙️ Next.js configuration updated');
    } else {
      console.log(chalk.green('⚙️ Next.js configuration updated'));
    }


    // Set up devnet if requested
    if (includeDevnet) {
      if (spinner) {
        spinner.start('🌐 Setting up devnet configuration...');
      } else {
        console.log(chalk.blue('🌐 Setting up devnet configuration...'));
      }
      
      try {
        setupDevnet();
        if (spinner) {
          spinner.succeed('🌐 Devnet configuration created');
        } else {
          console.log(chalk.green('🌐 Devnet configuration created'));
        }
      } catch (error) {
        if (spinner) {
          spinner.warn('⚠️ Devnet setup failed, but continuing with installation');
        } else {
          console.log(chalk.yellow('⚠️ Devnet setup failed, but continuing with installation'));
        }
      }
    }

    console.log(chalk.green('🎉 TX3 installation completed successfully!'));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.white('1. Run "npm run dev" to start development'));
    console.log(chalk.white('2. The next-tx3 plugin will automatically create the tx3/ folder and setup'));
    console.log(chalk.white('3. Add your TX3 code to tx3/ files and start building!'));

  } catch (error) {
    if (spinner) {
      spinner.fail('❌ Installation failed');
    } else {
      console.log(chalk.red('❌ Installation failed'));
    }
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    
    // Rollback changes
    console.log(chalk.yellow('🔄 Rolling back changes...'));
    for (const backup of backups) {
      try {
        FileUtils.restoreFromBackup(backup);
      } catch (rollbackError) {
        console.error(chalk.red(`Failed to restore ${backup.originalPath}: ${rollbackError}`));
      }
    }
    console.log(chalk.yellow('🔄 Rollback completed'));
    process.exit(1);
  }
}

async function showDryRunPreview(): Promise<void> {
  console.log(chalk.blue('Changes that would be made:'));
  console.log();
  
  // Check trix installation status
  const trixInstalled = TrixInstaller.checkTrixInstalled();
  if (!trixInstalled) {
    console.log(chalk.yellow('🔧 trix installation:'));
    console.log('  • Install tx3up installer');
    console.log('  • Run tx3up to install trix');
    console.log();
  }

  // Show devnet setup status
  if (trixInstalled || !trixInstalled) { // Will be prompted if trix available
    console.log(chalk.yellow('🌐 devnet setup (will be prompted if trix available):'));
    console.log('  • Copy devnet configuration files');
    console.log('  • Add devnet:start script to package.json');
    console.log();
  }
  
  console.log(chalk.yellow('📦 Packages to install:'));
  const requiredPackages = ['tx3-sdk', 'next-tx3'];
  const missingPackages = PackageUtils.getMissingPackages(requiredPackages);
  
  if (missingPackages.length === 0) {
    console.log(chalk.green('  • All required packages already installed'));
  } else {
    missingPackages.forEach(pkg => console.log(`  • ${pkg}`));
  }

  console.log();
  console.log(chalk.yellow('⚙️ Configuration changes:'));
  console.log('  • Update/create next.config.js with next-tx3 plugin');
  console.log('  • next-tx3 plugin will automatically handle TX3 setup (tsconfig paths, tx3 folder creation)');
}


async function updateNextConfig(): Promise<void> {
  const nextConfigFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
  let configFile = nextConfigFiles.find(file => FileUtils.fileExists(file));
  
  if (!configFile) {
    // Create new next.config.js
    configFile = 'next.config.js';
    FileUtils.writeFile(configFile, withTX3Template);
  } else {
    // Read existing config and update it
    const existingContent = FileUtils.readFile(configFile);
    
    // Simple approach: if it doesn't contain withTX3, wrap the entire export
    if (!existingContent.includes('withTX3')) {
      // Add import at the top
      let updatedContent = existingContent;
      
      // Add import if not present
      if (!updatedContent.includes("import { withTX3 }")) {
        updatedContent = `import { withTX3 } from 'next-tx3';\n${updatedContent}`;
      }
      
      // Find the export default and wrap it
      const exportDefaultRegex = /export default ([^;]+);?/;
      const match = updatedContent.match(exportDefaultRegex);
      
      if (match) {
        const configVariable = match[1].trim();
        const wrappedExport = `export default withTX3({
  ...${configVariable},
  tx3: {
    tx3Path: './tx3',        // Path to TX3 files (default: './tx3')
    autoWatch: true,         // Enable file watching (default: true)
    autoSetup: true,         // Auto-create TX3 structure (default: true)
    verbose: true            // Enable detailed logging (default: false)
  }
});`;
        
        updatedContent = updatedContent.replace(exportDefaultRegex, wrappedExport);
        FileUtils.writeFile(configFile, updatedContent);
      } else {
        throw new Error('Could not find export default in Next.js config. Please manually add withTX3 wrapper.');
      }
    }
  }
}

function setupDevnet(): void {
  try {
    // Copy devnet folder to project
    DevnetInstaller.copyDevnetFolder('devnet');
    
    // Add devnet:start script to package.json
    const packageJson = PackageUtils.readPackageJson();
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['devnet:start'] = 'cd devnet && dolos daemon';
    PackageUtils.writePackageJson(packageJson);
    
  } catch (error) {
    throw new Error(`Failed to setup devnet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}