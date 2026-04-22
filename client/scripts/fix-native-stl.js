#!/usr/bin/env node
/**
 * Fix C++ STL linking for native modules on Windows.
 * Adds c++_shared to target_link_libraries in CMakeLists.txt files.
 * Run after npm install via postinstall script.
 *
 * Skips entirely on non-Windows hosts (EAS Linux workers, CI, macOS) so
 * it can't trip the Install dependencies phase there.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform !== 'win32' || process.env.EAS_BUILD) {
  console.log('fix-native-stl: skipped (not Windows / running on EAS).');
  process.exit(0);
}

const nodeModules = path.join(__dirname, '..', 'node_modules');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('c++_shared')) return false;

  // Insert c++_shared after every target_link_libraries( TARGET_NAME line
  const patched = content.replace(
    /target_link_libraries\(\s*\n?\s*(\$\{[^}]+\}|\S+)/g,
    (match) => `${match}\n    c++_shared`
  );

  if (patched === content) return false;

  fs.writeFileSync(filePath, patched, 'utf8');
  return true;
}

// Find ALL CMakeLists.txt under node_modules/*/android/
function findCMakeFiles() {
  const results = [];

  function walkDir(dir, depth = 0) {
    if (depth > 5) return; // Don't go too deep
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '.cxx' && entry.name !== 'build') {
          walkDir(fullPath, depth + 1);
        } else if (entry.name === 'CMakeLists.txt') {
          results.push(fullPath);
        }
      }
    } catch {}
  }

  // Only search android directories of direct dependencies
  try {
    const entries = fs.readdirSync(nodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const androidDir = path.join(nodeModules, entry.name, 'android');
        if (fs.existsSync(androidDir)) {
          walkDir(androidDir);
        }
        // Also check scoped packages like @react-native-google-signin
        if (entry.name.startsWith('@')) {
          try {
            const scopedEntries = fs.readdirSync(path.join(nodeModules, entry.name), { withFileTypes: true });
            for (const scoped of scopedEntries) {
              const scopedAndroid = path.join(nodeModules, entry.name, scoped.name, 'android');
              if (fs.existsSync(scopedAndroid)) {
                walkDir(scopedAndroid);
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  return results;
}

console.log('Finding CMakeLists.txt files in native modules...');
const files = findCMakeFiles();
let patched = 0;

for (const file of files) {
  // Only patch files that have target_link_libraries
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('target_link_libraries')) continue;

  if (patchFile(file)) {
    const relPath = path.relative(nodeModules, file);
    console.log(`Patched: ${relPath}`);
    patched++;
  }
}

console.log(`Done. Patched ${patched} file(s) out of ${files.length} found.`);
