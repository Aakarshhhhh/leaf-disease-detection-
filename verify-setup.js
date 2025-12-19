#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Leaf Disease Detection System Setup...\n');

// Check if required files exist
const requiredFiles = [
  'package.json',
  'packages/frontend/package.json',
  'packages/backend/package.json',
  'packages/ml-service/requirements.txt',
  'packages/e2e/package.json',
  'docker-compose.yml',
  '.gitignore',
  'README.md'
];

const requiredDirectories = [
  'packages/frontend/src',
  'packages/backend/src',
  'packages/ml-service/tests',
  'packages/e2e/cypress',
  'uploads',
  'models'
];

let allGood = true;

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allGood = false;
  }
});

console.log('\n📂 Checking required directories...');
requiredDirectories.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - MISSING`);
    allGood = false;
  }
});

console.log('\n🔧 Checking configuration files...');
const configFiles = [
  'packages/frontend/tsconfig.json',
  'packages/frontend/vite.config.ts',
  'packages/frontend/jest.config.js',
  'packages/backend/tsconfig.json',
  'packages/backend/jest.config.js',
  'packages/backend/prisma/schema.prisma',
  'packages/ml-service/pyproject.toml'
];

configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allGood = false;
  }
});

console.log('\n🧪 Checking test setup...');
const testFiles = [
  'packages/frontend/src/setupTests.ts',
  'packages/frontend/src/App.test.tsx',
  'packages/backend/src/server.test.ts',
  'packages/ml-service/tests/test_main.py',
  'packages/e2e/cypress/e2e/basic.cy.ts'
];

testFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allGood = false;
  }
});

console.log('\n🏗️ Checking property-based test examples...');
const pbtFiles = [
  'packages/frontend/src/utils/validation.test.ts',
  'packages/backend/src/utils/validation.test.ts',
  'packages/ml-service/tests/test_properties.py'
];

pbtFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allGood = false;
  }
});

console.log('\n📋 Summary:');
if (allGood) {
  console.log('🎉 All required files and directories are present!');
  console.log('\n📖 Next steps:');
  console.log('1. Read setup.md for installation instructions');
  console.log('2. Install dependencies: npm install');
  console.log('3. Set up environment variables');
  console.log('4. Start development: npm run dev');
} else {
  console.log('⚠️  Some files or directories are missing.');
  console.log('Please ensure all required components are created.');
}

console.log('\n🔗 Project Structure:');
console.log('├── packages/');
console.log('│   ├── frontend/     # React + TypeScript + Material-UI');
console.log('│   ├── backend/      # Node.js + Express + PostgreSQL');
console.log('│   ├── ml-service/   # Python + FastAPI + TensorFlow');
console.log('│   └── e2e/          # Cypress end-to-end tests');
console.log('├── uploads/          # File upload directory');
console.log('├── models/           # ML model storage');
console.log('└── docker-compose.yml # Docker services');