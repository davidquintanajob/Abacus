const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env values needed before Next.js starts.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const name = match[1].trim();
      const value = match[2].trim();
      // Keep values explicitly provided by the shell/environment.
      if (!process.env[name]) {
        process.env[name] = value;
      }
    }
  });
}

const port = process.env.NEXT_PUBLIC_WEB_PORT || process.env.PORT || 3000;
const hostname = 'localhost';

console.log(`Starting Next.js production server on ${hostname}:${port}`);

const nextStart = spawn('npx', ['next', 'start', '-p', port, '-H', hostname], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

nextStart.on('error', (err) => {
  console.error('Failed to start Next.js production server:', err);
  process.exit(1);
});

nextStart.on('exit', (code) => {
  process.exit(code);
});
