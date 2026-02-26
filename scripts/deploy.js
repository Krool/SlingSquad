#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dist = path.resolve(__dirname, '..', 'dist');
const tmp = path.join(os.tmpdir(), 'slingsquad-deploy-' + Date.now());

try {
  // Get remote URL from main repo
  const remote = execSync('git remote get-url origin', { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim();

  fs.mkdirSync(tmp, { recursive: true });
  const run = (cmd) => execSync(cmd, { cwd: tmp, stdio: 'inherit' });

  run('git init');
  run('git checkout --orphan gh-pages');

  // Copy dist contents (including dotfiles like .nojekyll and .gitignore)
  execSync(`cp -r "${dist}/." "${tmp}/"`);

  run('git add -A');
  run('git commit -m "Deploy"');
  run(`git remote add origin ${remote}`);
  run('git push origin gh-pages --force');

  console.log('\nDeployed successfully!');
} finally {
  // Clean up temp dir
  fs.rmSync(tmp, { recursive: true, force: true });
}
