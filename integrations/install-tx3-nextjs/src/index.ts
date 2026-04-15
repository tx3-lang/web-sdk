#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { installCommand } from './commands/install.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('install-tx3')
  .description('CLI tool to add TX3 capabilities to existing Next.js projects or create new ones')
  .version('1.0.0');

program
  .command('init [project-name]')
  .description('Create a new Next.js project with shadcn/ui and TX3 capabilities')
  .option('--dry-run', 'Preview changes without applying them')
  .action((projectName, options) => {
    initCommand({ projectName, ...options });
  });

program
  .command('install')
  .description('Install TX3 capabilities to the current Next.js project')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--force', 'Force reinstall even if TX3 is already installed')
  .action(installCommand);

program
  .option('--status', 'Check if TX3 is already installed in the current project')
  .option('--remove', 'Remove TX3 from the current project')
  .action((options) => {
    if (options.status) {
      console.log(chalk.blue('🔍 Checking TX3 installation status...'));
      // TODO: Implement status check
      console.log(chalk.yellow('Status check not yet implemented'));
    } else if (options.remove) {
      console.log(chalk.red('🗑️  Removing TX3 from project...'));
      // TODO: Implement removal
      console.log(chalk.yellow('Removal not yet implemented'));
    } else {
      // Default action is install
      installCommand({ dryRun: false, force: false });
    }
  });

program.parse();