const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function getSecret() {
  try {
    admin.initializeApp();
    const client = new SecretManagerServiceClient();
    const projectId = admin.app().options.projectId || 'marriage-ai-289c6';
    
    const name = `projects/${projectId}/secrets/GITHUB_PACKAGES_DATABASE_TYPES/versions/latest`;
    
    const [version] = await client.accessSecretVersion({ name });
    
    if (!version || !version.payload || !version.payload.data) {
      throw new Error(`Secret GITHUB_PACKAGES_DATABASE_TYPES not found in Secret Manager`);
    }
    
    const token = version.payload.data.toString();
    console.log("Successfully retrieved GitHub token");
    
    // Update package.json to include the token in the dependency URL
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = require(packageJsonPath);
    
    if (packageJson.dependencies && packageJson.dependencies['@livve-1/database-types']) {
      const originalUrl = packageJson.dependencies['@livve-1/database-types'];
      // Check if the URL already contains a token
      if (!originalUrl.includes('@github.com')) {
        // Get the repo URL without any existing token
        const repoUrl = originalUrl.replace(/^git\+https:\/\/[^@]*@github\.com/, 'git+https://github.com');
        // Add the token to the URL
        packageJson.dependencies['@livve-1/database-types'] = repoUrl.replace('git+https://github.com', `git+https://${token}@github.com`);
        
        // Write the updated package.json
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log("Updated package.json with GitHub token for database-types package");
      }
    } else {
      console.log("Warning: @livve-1/database-types not found in package.json dependencies");
    }
    
    // Create .npmrc file as backup
    fs.writeFileSync('.npmrc', `@livve-1:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=${token}`);
    console.log("Created .npmrc file as backup authentication method");
    
    return token;
  } catch (error) {
    console.error('Error accessing secret from Secret Manager:', error);
    throw error;
  }
}

getSecret()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
