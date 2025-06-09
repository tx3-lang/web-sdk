import fs from 'fs';
import path from 'path';
import { PackageUtils } from './package-utils.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ProjectValidator {
  static validateNextJsProject(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      result.errors.push('package.json not found in current directory');
      result.isValid = false;
      return result;
    }

    try {
      const packageJson = PackageUtils.readPackageJson();

      // Check if Next.js is a dependency
      const hasNext = !!(
        packageJson.dependencies?.next ||
        packageJson.devDependencies?.next
      );

      if (!hasNext) {
        result.errors.push('Next.js not found in dependencies. This tool only works with Next.js projects.');
        result.isValid = false;
      }

      // Check if this is likely a Next.js project structure
      const nextJsIndicators = [
        'pages',
        'app',
        'next.config.js',
        'next.config.ts'
      ];

      const hasNextJsStructure = nextJsIndicators.some(indicator =>
        fs.existsSync(path.join(process.cwd(), indicator))
      );

      if (!hasNextJsStructure && hasNext) {
        result.warnings.push('Next.js dependency found but typical Next.js project structure not detected');
      }

      // Check for existing TX3 installation
      const tx3Indicators = [
        'tx3',
        'scripts/generate-tx3.mjs',
        '.tx3'
      ];

      const hasTx3 = tx3Indicators.some(indicator =>
        fs.existsSync(path.join(process.cwd(), indicator))
      );

      if (hasTx3) {
        result.warnings.push('TX3 files already exist in this project. Use --force to reinstall.');
      }

      // Check for existing webpack config in next.config
      const nextConfigPaths = ['next.config.js', 'next.config.ts'];
      const existingNextConfig = nextConfigPaths.find(configPath =>
        fs.existsSync(configPath)
      );

      if (existingNextConfig) {
        const configContent = fs.readFileSync(existingNextConfig, 'utf8');
        if (configContent.includes('webpack')) {
          result.warnings.push(`Existing webpack configuration found in ${existingNextConfig}. Manual review may be needed.`);
        }
      }

    } catch (error) {
      result.errors.push(`Error reading package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  static validateFreshProject(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      result.errors.push('package.json not found in current directory');
      result.isValid = false;
      return result;
    }

    // For fresh projects, we just need package.json to exist
    // Next.js dependency will be added by shadcn init
    return result;
  }

  static validateTx3Installation(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const requiredFiles = [
      'tx3/trix.toml',
      'tx3/main.tx3',
      'scripts/generate-tx3.mjs'
    ];

    const requiredPackages = [
      'tx3-sdk',
      'tx3-trp',
      'nodemon',
      'concurrently'
    ];

    // Check required files
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        result.errors.push(`Required file missing: ${file}`);
        result.isValid = false;
      }
    }

    // Check required packages
    const missingPackages = PackageUtils.getMissingPackages(requiredPackages);
    if (missingPackages.length > 0) {
      result.errors.push(`Missing packages: ${missingPackages.join(', ')}`);
      result.isValid = false;
    }

    // Check scripts
    try {
      const packageJson = PackageUtils.readPackageJson();
      const requiredScripts = ['tx3:generate', 'watch:tx3'];
      
      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          result.errors.push(`Required script missing: ${script}`);
          result.isValid = false;
        }
      }
    } catch (error) {
      result.errors.push('Error reading package.json');
      result.isValid = false;
    }

    return result;
  }
}