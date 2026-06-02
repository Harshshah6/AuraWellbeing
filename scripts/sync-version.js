import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

// 1. Read version from version.json
const versionFilePath = path.join(rootDir, 'version.json');
if (!fs.existsSync(versionFilePath)) {
  console.error('version.json not found!');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
console.log(`Syncing version: ${version}...`);

// 2. Sync to package.json
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('Updated package.json');
}

// 3. Sync to src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
  console.log('Updated src-tauri/tauri.conf.json');
}

// 4. Sync to src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargo = fs.readFileSync(cargoTomlPath, 'utf8');
  cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
  fs.writeFileSync(cargoTomlPath, cargo, 'utf8');
  console.log('Updated src-tauri/Cargo.toml');
}

console.log('Version synchronization complete!');
