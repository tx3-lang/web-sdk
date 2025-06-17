import { LoaderContext } from 'webpack';
import { TX3LoaderOptions, TX3CompilerResult } from '../types/index.js';
import { compileTX3 } from '../utils/tx3-compiler.js';
import path from 'path';
import fs from 'fs';

export default function tx3Loader(this: LoaderContext<TX3LoaderOptions>, source: string): void {
  const options = this.getOptions();
  const callback = this.callback;
  
  // Mark this loader as async
  this.async();
  
  const resourcePath = this.resourcePath;
  const tx3Path = options.tx3Path;
  
  if (options.verbose) {
    console.log(`🔄 Compiling TX3 file: ${resourcePath}`);
  }
  
  // Compile TX3 file
  compileTX3(tx3Path, options.trixOptions)
    .then((result: TX3CompilerResult) => {
      if (!result.success) {
        const error = new Error(`TX3 compilation failed: ${result.error}`);
        callback(error);
        return;
      }
      
      if (options.verbose && result.output) {
        console.log(`✅ TX3 compilation successful: ${result.output}`);
      }
      
      // Generate TypeScript import for the compiled bindings
      const bindingsPath = path.join(tx3Path, 'bindings');
      const protocolPath = path.join(bindingsPath, 'protocol.ts');
      
      let generatedCode = '';
      
      if (fs.existsSync(protocolPath)) {
        // Generate import statement for the protocol bindings
        const relativePath = path.relative(path.dirname(resourcePath), protocolPath);
        const importPath = relativePath.replace(/\\/g, '/').replace(/\.ts$/, '');
        
        generatedCode = `
// Auto-generated from TX3 file: ${path.basename(resourcePath)}
// This file is automatically updated when the TX3 source changes

export * from '${importPath}';

// Re-export for convenience
import * as Protocol from '${importPath}';
export { Protocol };
export default Protocol;
`;
      } else {
        // Fallback if bindings don't exist yet
        generatedCode = `
// TX3 bindings not yet generated for: ${path.basename(resourcePath)}
// Run 'trix bindgen' to generate TypeScript bindings

console.warn('TX3 bindings not found. Please run trix bindgen to generate TypeScript bindings.');

export const Protocol = {};
export default Protocol;
`;
      }
      
      callback(null, generatedCode);
    })
    .catch((error: any) => {
      callback(new Error(`TX3 loader error: ${error.message}`));
    });
}
