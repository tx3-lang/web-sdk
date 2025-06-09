import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: any;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export class PackageUtils {
  static detectPackageManager(): PackageManager {
    if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
    if (fs.existsSync('yarn.lock')) return 'yarn';
    return 'npm';
  }

  static readPackageJson(): PackageJson {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in current directory');
    }
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  static writePackageJson(packageJson: PackageJson): void {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  static addScripts(scripts: Record<string, string>): PackageJson {
    const packageJson = this.readPackageJson();
    packageJson.scripts = { ...packageJson.scripts, ...scripts };
    return packageJson;
  }

  static installPackages(packages: string[], isDev = false): void {
    const packageManager = this.detectPackageManager();
    
    let command: string;
    switch (packageManager) {
      case 'yarn':
        command = `yarn add ${isDev ? '--dev' : ''} ${packages.join(' ')}`;
        break;
      case 'pnpm':
        command = `pnpm add ${isDev ? '--save-dev' : ''} ${packages.join(' ')}`;
        break;
      default:
        command = `npm install ${isDev ? '--save-dev' : ''} ${packages.join(' ')}`;
    }

    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  }

  static hasPackage(packageName: string): boolean {
    const packageJson = this.readPackageJson();
    return !!(
      packageJson.dependencies?.[packageName] ||
      packageJson.devDependencies?.[packageName]
    );
  }

  static getMissingPackages(requiredPackages: string[]): string[] {
    return requiredPackages.filter(pkg => !this.hasPackage(pkg));
  }
}