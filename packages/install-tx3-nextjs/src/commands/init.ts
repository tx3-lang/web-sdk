import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { FileUtils } from '../utils/file-utils.js';
import { installCommand } from './install.js';
import { examplePageTemplate } from '../templates/example-page.js';
import { envLocalTemplate } from '../templates/env-local.js';
import { TrixInstaller } from '../utils/trix-installer.js';
import { DevnetInstaller } from '../utils/devnet-installer.js';

interface InitOptions {
  projectName?: string;
  dryRun?: boolean;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  console.log(chalk.blue('🚀 Initializing new Next.js project with TX3...'));

  let projectName = options.projectName;
  
  // If no project name provided, ask for it
  if (!projectName) {
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'What is your project name?',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    }]);
    projectName = name;
  }

  // Check if directory already exists
  if (FileUtils.directoryExists(projectName!)) {
    console.error(chalk.red(`❌ Directory '${projectName}' already exists`));
    process.exit(1);
  }

  // Check if trix is already installed
  const trixInstalled = TrixInstaller.checkTrixInstalled();
  
  // Ask about trix installation if not already installed (unless dry run)
  let installTrix = false;
  if (!trixInstalled && !options.dryRun) {
    const { shouldInstallTrix } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldInstallTrix',
      message: 'Install trix (TX3 compiler) via tx3up? (Recommended for local development)',
      default: true
    }]);
    installTrix = shouldInstallTrix;
  } else if (trixInstalled && !options.dryRun) {
    console.log(chalk.green('✅ trix is already installed'));
  }

  // Ask about devnet setup if trix is available (installed or being installed)
  let includeDevnet = false;
  const hasTrix = trixInstalled || installTrix;
  if (hasTrix && !options.dryRun) {
    const { shouldIncludeDevnet } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldIncludeDevnet',
      message: 'Include devnet setup for local testing? (Adds dolos configuration)',
      default: true
    }]);
    includeDevnet = shouldIncludeDevnet;
  }

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN - No changes will be made'));
    await showInitDryRunPreview(projectName!, trixInstalled, trixInstalled || true);
    return;
  }

  // Confirm initialization
  const { confirmInit } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmInit',
    message: `Create new Next.js project '${projectName}' with shadcn/ui and TX3?`,
    default: true
  }]);

  if (!confirmInit) {
    console.log(chalk.yellow('Initialization cancelled.'));
    return;
  }

  let spinner = ora();

  try {
    // Step 1: Install trix if requested
    if (installTrix) {
      spinner.start('🔧 Installing trix via tx3up...');
      try {
        await TrixInstaller.installTrix();
        spinner.succeed('🔧 trix installed successfully');
      } catch (error) {
        spinner.warn('⚠️ trix installation failed, but continuing with project setup');
        console.log(chalk.yellow(`You can install trix manually later with: curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh && tx3up`));
      }
    }

    // Step 2: Initialize Next.js project with shadcn
    spinner.start('🏗️  Creating Next.js project with shadcn/ui...');
    await initializeShadcnProject(projectName!);
    spinner.succeed('🏗️  Next.js project with shadcn/ui created');

    // Step 3: Change to the project directory
    console.log(chalk.blue(`📁 Project created in: ${projectName}`));
    process.chdir(projectName!);

    // Step 4: Install TX3
    spinner.stop();
    console.log(chalk.blue('🔧 Installing TX3 capabilities...'));
    await installCommand({ force: true, fresh: true, verbose: true });
    console.log(chalk.green('🔧 TX3 capabilities installed'));

    // Step 5: Replace default page.tsx with TX3 example
    console.log(chalk.blue('📄 Creating TX3 example page...'));
    replaceDefaultPage();
    console.log(chalk.green('📄 TX3 example page created'));

    // Step 6: Create .env.local file with TX3 configuration
    console.log(chalk.blue('⚙️ Creating environment configuration...'));
    createEnvFile();
    console.log(chalk.green('⚙️ Environment configuration created'));

    // Step 7: Set up devnet if requested
    if (includeDevnet) {
      console.log(chalk.blue('🌐 Setting up devnet configuration...'));
      setupDevnet();
      console.log(chalk.green('🌐 Devnet configuration created'));
    }

    console.log(chalk.green(`🎉 Project created successfully in '${projectName}'!`));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.white(`1. cd ${projectName}`));
    console.log(chalk.white('2. Update .env.local with your TX3 endpoint and API key'));
    console.log(chalk.white('3. Run "npm run dev" to start development with TX3 demo'));
    console.log(chalk.white('4. The next-tx3 plugin will automatically create the tx3/ folder and setup'));
    console.log(chalk.white('5. Add your TX3 code to tx3/ files and start building!'));
    console.log();
    console.log(chalk.blue('Environment Configuration:'));
    console.log(chalk.white('• NEXT_PUBLIC_TRP_ENDPOINT: TX3 TRP endpoint (default: http://localhost:8164)'));
    console.log(chalk.white('• NEXT_PUBLIC_TRP_API_KEY: Optional API key for TX3 authentication'));

  } catch (error) {
    spinner.fail('❌ Project initialization failed');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    
    // Cleanup: remove the project directory if it was created
    try {
      if (projectName && FileUtils.directoryExists(projectName)) {
        console.log(chalk.yellow(`🧹 Cleaning up ${projectName}...`));
        FileUtils.removeDirectory(projectName);
      }
    } catch (cleanupError) {
      console.error(chalk.red(`Failed to cleanup: ${cleanupError}`));
    }
    process.exit(1);
  }
}

async function initializeShadcnProject(projectName: string): Promise<void> {
  try {
    // Step 1: Create Next.js project
    const createCommand = `npx create-next-app@latest ${projectName} --app --tailwind --eslint --typescript --no-src-dir --no-import-alias --turbopack `;
    console.log(chalk.dim(`Running: ${createCommand}`));
    
    execSync(createCommand, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Step 2: Initialize shadcn/ui in the new project
    const initCommand = `npx shadcn@latest init -y button card badge alert separator label textarea `;
    console.log(chalk.dim(`Running: ${initCommand} (in ${projectName})`));
    
    execSync(initCommand, { 
      stdio: 'inherit',
      cwd: projectName // Run inside the newly created project directory
    });
  } catch (error) {
    throw new Error(`Failed to create Next.js project with shadcn: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function replaceDefaultPage(): void {
  try {
    // Replace app/page.tsx with our TX3 example page
    const pagePath = 'app/page.tsx';
    if (FileUtils.fileExists(pagePath)) {
      FileUtils.writeFile(pagePath, examplePageTemplate);
    } else {
      console.log(chalk.yellow(`⚠️ Could not find ${pagePath} to replace`));
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Failed to replace default page: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

function createEnvFile(): void {
  try {
    // Create .env.local file with TX3 configuration
    const envPath = '.env.local';
    if (!FileUtils.fileExists(envPath)) {
      FileUtils.writeFile(envPath, envLocalTemplate);
    } else {
      console.log(chalk.yellow(`⚠️ ${envPath} already exists, skipping creation`));
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Failed to create environment file: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

function setupDevnet(): void {
  try {
    // Copy devnet folder to project
    DevnetInstaller.copyDevnetFolder('devnet');
    
    // Add devnet:start script to package.json
    const packageJson = JSON.parse(FileUtils.readFile('package.json'));
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['devnet:start'] = 'cd devnet && dolos daemon';
    FileUtils.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Failed to setup devnet: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

async function showInitDryRunPreview(projectName: string, trixInstalled: boolean, hasTrix: boolean): Promise<void> {
  console.log(chalk.blue('Actions that would be taken:'));
  console.log();
  
  // Show trix installation status
  if (!trixInstalled) {
    console.log(chalk.yellow('🔧 trix installation (will be prompted):'));
    console.log('  • Install tx3up installer');
    console.log('  • Run tx3up to install trix');
    console.log();
  } else {
    console.log(chalk.green('🔧 trix installation:'));
    console.log('  • trix is already installed');
    console.log();
  }

  // Show devnet setup status
  if (hasTrix) {
    console.log(chalk.yellow('🌐 devnet setup (will be prompted if trix available):'));
    console.log('  • Copy devnet configuration files');
    console.log('  • Add devnet:start script to package.json');
    console.log();
  }
  
  console.log(chalk.yellow('📁 Project creation:'));
  console.log(`  • Run: npx create-next-app@latest ${projectName} --app --tailwind --eslint --typescript --no-src-dir --no-import-alias --turbopack `);
  console.log(`  • Run: npx shadcn@latest init -y button card badge alert separator label textarea  (in ${projectName})`);
  console.log(`  • This will create a Next.js project and add shadcn/ui`);
  console.log(`  • Change to directory: ${projectName}`);
  
  console.log();
  console.log(chalk.yellow('🔧 TX3 installation:'));
  console.log('  • Install TX3 packages (tx3-sdk, tx3-trp, next-tx3)');
  console.log('  • Update/create next.config.js with next-tx3 plugin');
  console.log('  • next-tx3 plugin will automatically handle TX3 setup (tsconfig paths, tx3 folder creation)');
  console.log('  • Replace app/page.tsx with TX3 example page');
  console.log('  • Create .env.local with TX3 environment variables');
  if (hasTrix) {
    console.log('  • Copy devnet folder (if selected)');
  }
}