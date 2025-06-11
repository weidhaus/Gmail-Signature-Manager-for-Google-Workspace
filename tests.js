async function checkCredentials() {
  const serviceAccountKey = PropertiesService.getScriptProperties().getProperty(
    "SERVICE_ACCOUNT_KEY"
  );

  if (!serviceAccountKey) {
    throw new Error("Service account key not found in Script Properties");
  }

  try {
    const parsedKey = JSON.parse(serviceAccountKey);
    if (!parsedKey.private_key || !parsedKey.client_email) {
      throw new Error("Invalid service account key format");
    }

    Logger.log("Service account credentials verified");
    return true;
  } catch (error) {
    throw new Error(`Invalid service account key: ${error.message}`);
  }
}

function verifyOAuthSetup() {
  try {
    const config = validateConfig(CONFIG);
    const authService = new AuthService(config);
    const hasAccess = authService.hasAccess();

    Logger.log("\n🔐 OAuth Verification:");
    Logger.log(
      `• Status: ${hasAccess ? "✓ Access Granted" : "❌ Access Denied"}`
    );

    return hasAccess;
  } catch (error) {
    Logger.log("\n❌ OAuth verification failed:", error);
    return false;
  }
}

function testConfiguration() {
  try {
    Logger.log("🔍 Testing Configuration...");
    Logger.log("============================");

    // 1. Validate basic configuration
    const config = validateConfig(CONFIG);
    Logger.log("✓ Configuration structure valid");

    // 2. Check service account credentials
    const serviceAccountKey =
      PropertiesService.getScriptProperties().getProperty(
        "SERVICE_ACCOUNT_KEY"
      );
    if (!serviceAccountKey) {
      throw new Error("SERVICE_ACCOUNT_KEY not found in Script Properties");
    }
    const parsedKey = JSON.parse(serviceAccountKey);

    Logger.log("\n📑 Service Account Details:");
    Logger.log(`• Client Email: ${parsedKey.client_email}`);
    Logger.log(`• Project ID: ${parsedKey.project_id}`);
    Logger.log(
      `• Private Key: ${parsedKey.private_key ? "✓ Present" : "❌ Missing"}`
    );

    // 3. Test OAuth Setup
    const authService = new AuthService(config);
    const hasAccess = authService.hasAccess();
    Logger.log("\n🔐 OAuth Status:");
    Logger.log(`• Admin Email: ${config.CLIENT.adminEmail}`);
    Logger.log(`• OAuth Access: ${hasAccess ? "✓ Granted" : "❌ Missing"}`);

    // 4. Log Configuration Details
    Logger.log("\n⚙️ Active Configuration:");
    Logger.log("• Client Settings:");
    Logger.log(JSON.stringify(config.CLIENT, null, 2));
    Logger.log("• API Settings:");
    Logger.log(JSON.stringify(config.API, null, 2));

    Logger.log("\n✅ Configuration test completed successfully");
    return true;
  } catch (error) {
    Logger.log("\n❌ Configuration test failed:", error);
    return false;
  }
}

function testSignatureUpdate() {
  try {
    Logger.log(`🔄 Testing Signature Update... (${new Date().toISOString()})`);
    Logger.log("==============================");

    const config = validateConfig(CONFIG);
    const signatureService = new SignatureService(config);

    // Test with single user
    const testUser = config.CLIENT.testUserEmail;
    Logger.log(`Testing with user: ${testUser}`);

    const startTime = Date.now();
    return signatureService
      .processUsers([testUser])
      .then((result) => {
        const duration = Date.now() - startTime;

        Logger.log("\n✅ Test Results:");
        Logger.log(`• Duration: ${duration}ms`);
        Logger.log(`• Updated: ${result.processed.length}`);
        Logger.log(`• Skipped: ${result.skipped.length}`);
        Logger.log(`• Failed: ${Object.keys(result.failed).length}`);
        if (Object.keys(result.failed).length > 0) {
          Logger.log("Failed operations:", result.failed);
        }
        return true;
      })
      .catch((error) => {
        throw new Error(`Signature update failed: ${error.message}`);
      });
  } catch (error) {
    Logger.log("\n❌ Signature test failed:", error);
    return false;
  }
}

async function testDryRun() {
  try {
    Logger.log("🔍 Starting Dry Run Test...");
    Logger.log("============================");

    // Enable dry run mode
    const config = validateConfig({
      ...CONFIG,
      EXECUTION: {
        dryRun: true,
        verbose: true,
      },
    });

    const authService = new AuthService(config);
    const userFilter = new UserFilterService(config);
    const signatureService = new SignatureService(config);

    // Get test users
    const allowedUsers = await userFilter.getAllowedUsers();
    Logger.log(`Found ${allowedUsers.length} users to process`);
    Logger.log("----------------------------------------");

    // Process signatures in dry run mode
    const result = await signatureService.processUsers(allowedUsers);

    // Log results
    Logger.log("\n📊 Dry Run Results:");
    Logger.log(`• Users that would be updated: ${result.processed.length}`);
    Logger.log(`• Users that would be skipped: ${result.skipped.length}`);
    Logger.log(`• Users that would fail: ${Object.keys(result.failed).length}`);

    if (result.processed.length > 0) {
      Logger.log("\nUsers that would be updated:");
      result.processed.forEach((email) => Logger.log(`• ${email}`));
    }

    return result;
  } catch (error) {
    Logger.log("\n❌ Dry Run Test Failed:", error);
    return false;
  }
}

function logTestSummary(results) {
  const summary = {
    config: results.configTest,
    oauth: results.oauthTest,
    signature: results.signatureTest,
    duration: results.totalDuration,
    timestamp: new Date().toISOString(),
    dryRun: CONFIG.EXECUTION.dryRun,
  };

  Logger.log("Test Summary", summary);
  return summary;
}
