const fs = require('fs');
const path = require('path');

// Load .env file manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const name = match[1].trim();
      const value = match[2].trim();
      process.env[name] = value;
    }
  });
}

const cli = require('next/dist/cli/next-dev');
cli.nextDev({
  port: process.env.PORT || 3000,
  hostname: process.env.HOSTNAME || 'localhost'
});
