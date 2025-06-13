export const withTX3Template = `import { withTX3 } from 'next-tx3';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js config here
};

export default withTX3({
  ...nextConfig,
  tx3: {
    tx3Path: './tx3',        // Path to TX3 files (default: './tx3')
    autoWatch: true,         // Enable file watching (default: true)
    autoSetup: true,         // Auto-create TX3 structure (default: true)
    verbose: true            // Enable detailed logging (default: false)
  }
});
`;