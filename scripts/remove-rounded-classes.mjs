#!/usr/bin/env node

/**
 * Remove all rounded- Tailwind classes from source files
 * Part of terminal aesthetic enforcement
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Pattern to match rounded- classes
const roundedClassPattern = /\brounded-[a-z0-9-]+\b/g;

function removeRoundedClasses(content) {
  // Remove rounded- classes from the content
  let modified = content.replace(roundedClassPattern, '');

  // Clean up extra spaces left behind (only within className strings)
  modified = modified.replace(/className="([^"]*)"/g, (match, classes) => {
    const cleaned = classes.replace(/\s{2,}/g, ' ').trim();
    return cleaned ? `className="${cleaned}"` : '';
  });
  modified = modified.replace(/className='([^']*)'/g, (match, classes) => {
    const cleaned = classes.replace(/\s{2,}/g, ' ').trim();
    return cleaned ? `className='${cleaned}'` : '';
  });

  // Remove empty className attributes
  modified = modified.replace(/\s*className=""\s*/g, ' ');
  modified = modified.replace(/\s*className=''\s*/g, ' ');

  return modified;
}

function walkDirectory(dir, callback) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (!['node_modules', '.next', 'dist', 'build', '.git'].includes(file)) {
        walkDirectory(filePath, callback);
      }
    } else if (/\.(tsx?|jsx?)$/.test(file)) {
      callback(filePath);
    }
  }
}

function main() {
  let totalFiles = 0;
  let totalReplacements = 0;

  const processFile = (file) => {
    const content = readFileSync(file, 'utf-8');
    const matches = content.match(roundedClassPattern);

    if (matches) {
      const modified = removeRoundedClasses(content);
      writeFileSync(file, modified, 'utf-8');

      totalFiles++;
      totalReplacements += matches.length;

      console.log(`✓ ${file}: Removed ${matches.length} rounded- classes`);
    }
  };

  // Process components directory
  walkDirectory('./components', processFile);

  // Process app directory
  walkDirectory('./app', processFile);

  console.log(`\n📊 Summary:`);
  console.log(`   Files modified: ${totalFiles}`);
  console.log(`   Total rounded- classes removed: ${totalReplacements}`);
  console.log(`\n✅ Terminal aesthetic: All components now have square corners`);
}

main();
