import { TX3CompilerResult, TX3Config } from '../types/index.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function compileTX3(
  tx3Path: string,
  trixOptions?: TX3Config['trixOptions']
): Promise<TX3CompilerResult> {
  return new Promise((resolve) => {
    const trixTomlPath = path.join(tx3Path, 'trix.toml');
    
    // Check if trix.toml exists
    if (!fs.existsSync(trixTomlPath)) {
      resolve({
        success: false,
        error: `trix.toml not found at ${trixTomlPath}`
      });
      return;
    }
    
    // Determine trix binary path
    const trixBinary = trixOptions?.binaryPath || 'trix';
    const args = ['bindgen'];
    
    // Add custom flags if provided
    if (trixOptions?.flags) {
      args.push(...trixOptions.flags);
    }
    
    // Run trix bindgen
    const trixProcess = spawn(trixBinary, args, {
      cwd: tx3Path,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    trixProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    trixProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    trixProcess.on('close', (code) => {
      if (code === 0) {
        // Check if bindings were generated
        const bindingsPath = path.join(tx3Path, 'bindings');
        const protocolPath = path.join(bindingsPath, 'protocol.ts');
        
        const bindings: string[] = [];
        if (fs.existsSync(bindingsPath)) {
          const files = fs.readdirSync(bindingsPath);
          bindings.push(...files.filter(f => f.endsWith('.ts')));
        }
        
        resolve({
          success: true,
          output: stdout,
          bindings
        });
      } else {
        resolve({
          success: false,
          error: stderr || `trix process exited with code ${code}`,
          output: stdout
        });
      }
    });
    
    trixProcess.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to spawn trix process: ${error.message}`
      });
    });
  });
}

export function checkTrixInstallation(): boolean {
  try {
    const { execSync } = require('child_process');
    execSync('trix --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
