import fs from 'fs';
import path from 'path';

const pathsToClean = [
  'dist',
  'src-tauri/target',
  'src-tauri/gen/schemas',
  'node_modules/.cache'
];

const rootDir = process.cwd();

console.log('Starting cleanup of temporary and build directories...');

pathsToClean.forEach((targetPath) => {
  const absolutePath = path.join(rootDir, targetPath);
  if (fs.existsSync(absolutePath)) {
    try {
      console.log(`Cleaning: ${targetPath}...`);
      fs.rmSync(absolutePath, { recursive: true, force: true });
      console.log(`Successfully cleaned: ${targetPath}`);
    } catch (error) {
      console.error(`Failed to clean ${targetPath}:`, error.message);
    }
  } else {
    console.log(`Directory does not exist, skipping: ${targetPath}`);
  }
});

console.log('Cleanup completed!');
