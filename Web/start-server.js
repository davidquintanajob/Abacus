const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file manually for PORT and HOSTNAME only
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const name = match[1].trim();
      const value = match[2].trim();
      // Only load non-NEXT_PUBLIC variables to avoid conflicts
      if (!name.startsWith('NEXT_PUBLIC_')) {
        process.env[name] = value;
      }
    }
  });
}

const port = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME || 'localhost';

console.log(`Starting Next.js dev server on ${hostname}:${port}`);

const nextDev = spawn('npx', ['next', 'dev', '-p', port, '-H', hostname], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

nextDev.on('error', (err) => {
  console.error('Failed to start Next.js dev server:', err);
  process.exit(1);
});

nextDev.on('exit', (code) => {
  process.exit(code);
});
