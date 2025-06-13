import fs from 'fs';
import path from 'path';

export interface BackupEntry {
  originalPath: string;
  backupPath: string;
  content: string;
}

export class FileUtils {
  private static backupDir = '.tx3-backup';

  static ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  static backupFile(filePath: string): BackupEntry {
    this.ensureBackupDir();
    
    const originalContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const backupFileName = `${path.basename(filePath)}.${Date.now()}.backup`;
    const backupPath = path.join(this.backupDir, backupFileName);
    
    if (originalContent) {
      fs.writeFileSync(backupPath, originalContent);
    }
    
    return {
      originalPath: filePath,
      backupPath,
      content: originalContent
    };
  }

  static restoreFromBackup(backup: BackupEntry): void {
    if (backup.content) {
      fs.writeFileSync(backup.originalPath, backup.content);
    } else if (fs.existsSync(backup.originalPath)) {
      fs.unlinkSync(backup.originalPath);
    }
  }

  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  static readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  static writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  }

  static isDirectory(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch {
      return false;
    }
  }

  static createDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static directoryExists(dirPath: string): boolean {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  }

  static removeDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
}
