/**
 * Gmail Signature Manager for Google Workspace
 *
 * This script allows Google Workspace administrators to manage and update
 * email signatures across their organization in a consistent manner.
 *
 * @author Originally by cweidhaus, cleaned up for public use
 * @version 1.0.0
 * @license MIT
 */

/**
 * Runs all tests to verify configuration and setup
 * @returns {Object} Test results
 */
async function runAllTests() {
  const startTime = Date.now();
  let results = {};

  try {
    // Run tests sequentially
    results.configTest = await testConfiguration();

    if (results.configTest) {
      results.oauthTest = await verifyOAuthSetup();
    }

    if (results.oauthTest) {
      results.signatureTest = await testSignatureUpdate();
    }

    results.totalDuration = Date.now() - startTime;

    return logTestSummary(results);
  } catch (error) {
    Logger.log("❌ Test Suite Failed:", error);
    return {
      configTest: results.configTest || false,
      oauthTest: results.oauthTest || false,
      signatureTest: results.signatureTest || false,
      totalDuration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Performs detailed authentication diagnostics
 * This function helps troubleshoot permission and setup issues
 * @returns {Object} Diagnostic results
 */
function runAuthDiagnostics() {
  Logger.log("=== GMAIL SIGNATURE MANAGER AUTHENTICATION DIAGNOSTICS ===");
  Logger.log(
    "Starting comprehensive authentication diagnostics at " +
      new Date().toISOString()
  );

  try {
    // Check script properties
    const scriptProps = PropertiesService.getScriptProperties();
    const serviceAccountKeyProp = scriptProps.getProperty(
      "SERVICE_ACCOUNT_KEY"
    );

    if (!serviceAccountKeyProp) {
      Logger.log("SERVICE_ACCOUNT_KEY not found in script properties");
      return {
        status: "ERROR",
        message: "SERVICE_ACCOUNT_KEY not found in script properties",
        action: "Add the service account credentials JSON to script properties",
      };
    }
    // Parse the service account key
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyProp);
      Logger.log("✅ SERVICE_ACCOUNT_KEY successfully parsed as JSON");
    } catch (e) {
      Logger.log("SERVICE_ACCOUNT_KEY is not valid JSON: " + e.message);
      return {
        status: "ERROR",
        message: "SERVICE_ACCOUNT_KEY is not valid JSON: " + e.message,
        action:
          "Make sure you've pasted the entire JSON file without modifications",
      };
    }

    // Validate the service account key contents
    const requiredFields = ["client_email", "private_key", "project_id"];
    const missingFields = requiredFields.filter(
      (field) => !serviceAccountKey[field]
    );

    if (missingFields.length > 0) {
      Logger.log(
        "SERVICE_ACCOUNT_KEY is missing required fields: " +
          missingFields.join(", ")
      );
      return {
        status: "ERROR",
        message:
          "SERVICE_ACCOUNT_KEY is missing required fields: " +
          missingFields.join(", "),
        action:
          "Use a complete service account JSON file from Google Cloud Console",
      };
    }

    Logger.log("✅ Service account key contains all required fields");
    Logger.log("- Project ID: " + serviceAccountKey.project_id);
    Logger.log("- Client Email: " + serviceAccountKey.client_email);

    // Check configuration
    try {
      const config = validateConfig(CONFIG);
      Logger.log("✅ Configuration validated successfully");
      Logger.log("- Search Domain: " + config.CLIENT.searchDomain);
      Logger.log("- Admin Email: " + config.CLIENT.adminEmail);
    } catch (e) {
      Logger.log("Configuration validation failed: " + e.message);
      return {
        status: "ERROR",
        message: "Configuration validation failed: " + e.message,
        action: "Check and update your CONFIG object in config.js",
      };
    }

    // Check manifest for required OAuth scopes
    Logger.log("\n4. Checking OAuth scope configuration...");
    try {
      const manifest = getOAuthManifest();
      if (manifest && manifest.oauthScopes) {
        Logger.log(
          "Found OAuth scopes in manifest: " + manifest.oauthScopes.length
        );

        const requiredScopes = [
          "https://www.googleapis.com/auth/script.container.ui",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/gmail.settings.basic",
          "https://www.googleapis.com/auth/admin.directory.user.readonly",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/script.external_request",
        ];

        const missingScopes = [];
        for (const scope of requiredScopes) {
          if (!manifest.oauthScopes.includes(scope)) {
            missingScopes.push(scope);
          }
        }

        if (missingScopes.length > 0) {
          Logger.log(
            "Missing required OAuth scopes: " + missingScopes.join(", ")
          );
        } else {
          Logger.log("✅ All required OAuth scopes found in manifest");
        }
      } else {
        Logger.log("Could not verify OAuth scopes in manifest");
      }
    } catch (e) {
      Logger.log("Error checking OAuth manifest: " + e.message);
    }

    // Test OAuth permissions
    Logger.log("\n5. Testing OAuth permissions...");
    const authService = new AuthService(CONFIG);
    const permissionTests = authService.testAllPermissions();

    if (permissionTests.errors.length > 0) {
      Logger.log("Some permission tests failed");
      permissionTests.errors.forEach((error) => {
        Logger.log("- " + error.test + ": " + error.message);
      });
    } else {
      Logger.log("✅ All permission tests passed");
    }

    // Generate summary
    Logger.log("\n=== DIAGNOSTIC SUMMARY ===");
    const allPassed =
      permissionTests.serviceAccountValid &&
      permissionTests.adminDirectoryAccess &&
      permissionTests.gmailSettingsAccess &&
      permissionTests.externalRequestAccess;

    if (allPassed) {
      Logger.log("✅ All authentication checks PASSED");
      return {
        status: "SUCCESS",
        message: "All authentication checks passed",
        details: permissionTests,
      };
    } else {
      Logger.log("⚠️ Some authentication checks FAILED");
      return {
        status: "WARNING",
        message: "Some authentication checks failed",
        details: permissionTests,
        action:
          "Check the logs for specific errors and follow the troubleshooting guide in README.md",
      };
    }
  } catch (error) {
    Logger.log("FATAL ERROR during diagnostics:", error);
    return {
      status: "ERROR",
      message: "Fatal error during diagnostics: " + error.message,
      error: error,
    };
  }
}

async function runSignatureManager() {
  try {
    Logger.log("🚀 Starting Email Signature Manager...");
    Logger.log("====================================");

    // 1. Configuration Check
    Logger.log("⚙️ Checking Configuration...");
    const config = validateConfig(CONFIG);

    // Display execution mode prominently
    Logger.log(
      "🔄 Execution Mode: mode=%s, verbose=%s",
      config.EXECUTION.dryRun ? "🔍 DRY RUN" : "🔄 LIVE",
      config.EXECUTION.verbose ? "✓" : "❌"
    );

    if (config.EXECUTION.dryRun) {
      Logger.log("Running in DRY RUN mode - No signatures will be modified");
    }

    // ... rest of configuration validation
    Logger.log("Configuration structure valid");

    // 2. Check service account credentials
    const serviceAccountKey =
      PropertiesService.getScriptProperties().getProperty(
        "SERVICE_ACCOUNT_KEY"
      );
    if (!serviceAccountKey) {
      throw new Error("SERVICE_ACCOUNT_KEY not found in Script Properties");
    }
    const parsedKey = JSON.parse(serviceAccountKey);

    Logger.log(
      "Service Account Details: email=%s, projectId=%s, hasPrivateKey=%s",
      parsedKey.client_email,
      parsedKey.project_id,
      !!parsedKey.private_key ? "Yes" : "No"
    );

    // 3. Test OAuth Setup
    const authService = new AuthService(config);
    const hasAccess = authService.hasAccess();
    Logger.log(
      "OAuth Status: adminEmail=%s, oauthAccess=%s",
      config.CLIENT.adminEmail,
      hasAccess ? "✓ Granted" : "❌ Missing"
    );

    // 4. Log Configuration Details
    Logger.log(
      "Active Configuration: domain=%s, adminEmail=%s, batchSize=%s, dryRun=%s",
      config.CLIENT.searchDomain,
      config.CLIENT.adminEmail,
      config.API.BATCH_SIZE,
      config.EXECUTION.dryRun ? "Yes" : "No"
    );

    if (!authService.hasAccess()) {
      Logger.log("Authentication Required");
      Logger.log("Please complete OAuth setup first");
      return { status: "AUTH_NEEDED" };
    }

    // 3. Initialize Services
    const userFilter = new UserFilterService(config);
    const signatureService = new SignatureService(config);

    // 4. Process Users
    Logger.log("Processing Users...");
    const allowedUsers = await userFilter.getAllowedUsers();
    Logger.log(`Found ${allowedUsers.length} users to process`);

    // 5. Update Signatures
    const startTime = Date.now();
    const result = await signatureService.processUsers(allowedUsers);
    const duration = Date.now() - startTime;

    // 6. Summary
    Logger.log(
      "Execution Summary: mode=%s, duration=%sms, totalUsers=%s, updated=%s, skipped=%s, failed=%s",
      config.EXECUTION.dryRun ? "Dry Run" : "Live",
      duration,
      allowedUsers.length,
      result.processed.length,
      result.skipped.length,
      Object.keys(result.failed).length
    );

    if (Object.keys(result.failed).length > 0) {
      Logger.log("Failed Operations: %s", JSON.stringify(result.failed));
    }

    Logger.log("Script Execution Complete");

    return {
      status: "SUCCESS",
      dryRun: config.EXECUTION.dryRun,
      duration,
      timestamp: new Date().toISOString(),
      ...result,
    };
  } catch (error) {
    Logger.log("Script Execution Failed: %s", error.message);
    if (error.stack) {
      Logger.log("Stack trace: %s", error.stack);
    }
    return {
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}
