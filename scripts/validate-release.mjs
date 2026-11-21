import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const envFilePath = join(projectRoot, '.env.local');

function fail(message) {
  console.error(`Release validation failed: ${message}`);
  process.exitCode = 1;
}

function getConfiguredValue(name) {
  const runtimeValue = process.env[name]?.trim();
  if (runtimeValue) return runtimeValue;
  if (!existsSync(envFilePath)) return '';

  const line = readFileSync(envFilePath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.hostname.includes('example.com')
      && !url.hostname.includes('your-project');
  } catch {
    return false;
  }
}

function validateConfiguration() {
  const appConfig = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8')).expo;
  const easConfig = JSON.parse(readFileSync(join(projectRoot, 'eas.json'), 'utf8'));
  const packageConfig = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL']) {
    if (!isValidHttpUrl(getConfiguredValue(key))) {
      throw new Error(`${key} must be configured with a valid application URL in the environment or .env.local.`);
    }
  }
  const anonKey = getConfiguredValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!anonKey || /your-public-anon-key|placeholder/i.test(anonKey)) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY must be configured in the environment or .env.local.');
  }

  if (!appConfig.android?.package || !appConfig.ios?.bundleIdentifier) {
    throw new Error('Android package and iOS bundle identifiers must be configured in app.json.');
  }
  if (!appConfig.extra?.eas?.projectId) {
    throw new Error('The EAS project ID must be configured in app.json.');
  }
  if (appConfig.version !== packageConfig.version) {
    throw new Error('The app.json and package.json versions must match.');
  }

  const profiles = easConfig.build || {};
  for (const [profile, environment] of [['development', 'development'], ['preview', 'preview'], ['production', 'production']]) {
    if (profiles[profile]?.environment !== environment) {
      throw new Error(`The EAS ${profile} build must select the ${environment} environment.`);
    }
  }
  if (profiles.preview?.distribution !== 'internal' || profiles.preview?.android?.buildType !== 'apk') {
    throw new Error('The preview profile must produce an internally distributed Android APK.');
  }
  if (profiles.production?.distribution !== 'store' || profiles.production?.autoIncrement !== true) {
    throw new Error('The production profile must target the store and auto-increment its build number.');
  }

  console.log('Release configuration and required public app settings are valid.');
}

function runNpm(args) {
  const result = spawnSync(npmCommand, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: npm ${args.join(' ')}`);
}

function hasAndroidBundle(outputDirectory) {
  const androidBundleDirectory = join(outputDirectory, '_expo', 'static', 'js', 'android');
  return existsSync(androidBundleDirectory)
    && readdirSync(androidBundleDirectory).some((file) => file.endsWith('.hbc') || file.endsWith('.js'));
}

let exportDirectory;
try {
  validateConfiguration();
  runNpm(['run', 'typecheck']);
  runNpm(['run', 'lint']);

  exportDirectory = mkdtempSync(join(tmpdir(), 'inventory-mobile-release-'));
  runNpm(['run', 'export:android', '--', '--output-dir', exportDirectory]);
  if (!hasAndroidBundle(exportDirectory)) {
    throw new Error('Expo export completed without producing an Android JavaScript bundle.');
  }
  console.log('Android release bundle validated.');
} catch (error) {
  fail(error instanceof Error ? error.message : 'An unexpected validation error occurred.');
} finally {
  if (exportDirectory && existsSync(exportDirectory)) {
    rmSync(exportDirectory, { recursive: true, force: true });
  }
}
