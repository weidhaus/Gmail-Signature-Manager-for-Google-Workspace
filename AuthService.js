/**
 * Authentication Service for Gmail Signature Manager
 * Handles OAuth2 authentication and authorization for various Google APIs
 */

let serviceAccountKey;

try {
  const serviceAccountKeyStr =
    PropertiesService.getScriptProperties().getProperty("SERVICE_ACCOUNT_KEY");
  Logger.log(
    "Initializing AuthService with service account key (length: " +
      (serviceAccountKeyStr ? serviceAccountKeyStr.length : 0) +
      ")"
  );
  serviceAccountKey = serviceAccountKeyStr
    ? JSON.parse(serviceAccountKeyStr)
    : null;

  if (!serviceAccountKey) {
    Logger.log("SERVICE_ACCOUNT_KEY not found in script properties");
  }
} catch (error) {
  Logger.log("ERROR parsing SERVICE_ACCOUNT_KEY: " + error.message, error);
}

class AuthService {
  constructor(config) {
    this.config = config;
    try {
      const keyStr = PropertiesService.getScriptProperties().getProperty(
        "SERVICE_ACCOUNT_KEY"
      );
      this.serviceAccountKey = keyStr ? JSON.parse(keyStr) : null;
      Logger.log(
        "AuthService initialized with admin email: " +
          this.config.CLIENT.adminEmail
      );

      if (this.serviceAccountKey) {
        Logger.log(
          "Service account details: " + this.serviceAccountKey.client_email
        );
      } else {
        Logger.log("No service account key available in constructor");
      }
    } catch (error) {
      Logger.log("AuthService constructor error: " + error.message, error);
    }
  }

  /**
   * Gets a service for Gmail API access
   * @returns {Object} OAuth2 service object
   */
  getService() {
    try {
      Logger.log(
        "Creating Gmail service with admin email: " +
          this.config.CLIENT.adminEmail
      );

      if (!this.serviceAccountKey) {
        throw new Error("Service account key is not available");
      }

      if (!this.serviceAccountKey.private_key) {
        throw new Error("Service account private key is missing");
      }

      if (!this.serviceAccountKey.client_email) {
        throw new Error("Service account client email is missing");
      }

      const service = OAuth2.createService("GmailService")
        .setTokenUrl("https://oauth2.googleapis.com/token")
        .setPrivateKey(this.serviceAccountKey.private_key)
        .setIssuer(this.serviceAccountKey.client_email)
        .setSubject(this.config.CLIENT.adminEmail)
        .setPropertyStore(PropertiesService.getUserProperties())
        .setCache(CacheService.getUserCache())
        .setScope([
          "https://www.googleapis.com/auth/gmail.settings.basic",
          "https://www.googleapis.com/auth/admin.directory.user.readonly",
          "https://www.googleapis.com/auth/script.external_request", // Add external request scope
        ]);

      Logger.log(
        "Gmail service created successfully with issuer: " +
          this.serviceAccountKey.client_email
      );
      return service;
    } catch (error) {
      Logger.log("Failed to create Gmail service: " + error.message, error);
      throw error;
    }
  }

  /**
   * Checks if the service has access to Admin Directory API
   * @returns {boolean} Whether access is granted
   */
  hasAccess() {
    try {
      Logger.log("Checking Admin SDK API access...");
      const service = this.getAdminService();
      const hasAccess = service.hasAccess();

      if (hasAccess) {
        Logger.log("✅ Admin SDK API access: GRANTED");
      } else {
        const lastError = service.getLastError();
        Logger.log("❌ Admin SDK API access: DENIED");
        Logger.log(
          "Error details: " + (lastError || "No specific error returned")
        );

        // Check for common errors
        if (lastError && lastError.includes("invalid_grant")) {
          Logger.log(
            "HINT: This might be due to incorrect admin email or missing domain-wide delegation"
          );
        }
        if (lastError && lastError.includes("access_denied")) {
          Logger.log(
            "HINT: This might be due to insufficient OAuth scopes. Check domain-wide delegation setup."
          );
        }
      }

      return hasAccess;
    } catch (error) {
      Logger.log("Error checking API access:", error);
      return false;
    }
  }

  /**
   * Validates the service account key
   * @returns {boolean} Whether the key is valid
   */
  checkServiceAccountKey() {
    try {
      Logger.log("Validating service account key...");

      if (!this.serviceAccountKey) {
        Logger.log("Service account key not found in script properties");
        throw new Error("Service account key not found in script properties");
      }

      // Check required fields
      const requiredFields = [
        "private_key",
        "client_email",
        "project_id",
        "client_id",
      ];
      const missingFields = requiredFields.filter(
        (field) => !this.serviceAccountKey[field]
      );

      if (missingFields.length > 0) {
        Logger.log(
          `Invalid service account key format. Missing fields: ${missingFields.join(
            ", "
          )}`
        );
        throw new Error(
          `Invalid service account key format. Missing fields: ${missingFields.join(
            ", "
          )}`
        );
      }

      // Log key details for debugging
      Logger.log("✅ Service account key validation passed");
      Logger.log("- Client email: " + this.serviceAccountKey.client_email);
      Logger.log("- Project ID: " + this.serviceAccountKey.project_id);
      Logger.log(
        "- Private key exists: " +
          (!!this.serviceAccountKey.private_key ? "Yes" : "No")
      );

      return true;
    } catch (error) {
      Logger.log("Service account key validation failed:", error);
      throw error;
    }
  }

  /**
   * Gets a service for Admin Directory API access
   * @returns {Object} OAuth2 service object
   */
  getAdminService() {
    try {
      Logger.log(
        "Creating Admin SDK service for: " + this.config.CLIENT.adminEmail
      );

      if (!this.serviceAccountKey) {
        throw new Error("Service account key is not available");
      }

      const service = OAuth2.createService("AdminSDK-Directory")
        .setTokenUrl("https://oauth2.googleapis.com/token")
        .setPrivateKey(this.serviceAccountKey.private_key)
        .setIssuer(this.serviceAccountKey.client_email)
        .setSubject(this.config.CLIENT.adminEmail)
        .setScope(
          "https://www.googleapis.com/auth/admin.directory.user.readonly"
        );

      Logger.log(
        "Admin SDK service created successfully with scope: https://www.googleapis.com/auth/admin.directory.user.readonly"
      );
      return service;
    } catch (error) {
      Logger.log("Failed to create Admin SDK service:", error);
      throw error;
    }
  }

  /**
   * Gets a service for Gmail API access for a specific user
   * @param {string} email - The email address of the user
   * @returns {Object} OAuth2 service object
   */
  getGmailService(email) {
    try {
      Logger.log("Creating Gmail service for user: " + email);

      if (!this.serviceAccountKey) {
        throw new Error("Service account key is not available");
      }

      if (!email) {
        throw new Error("Email address is required for Gmail service");
      }

      // Sanitize the email for use in service name (remove special chars)
      const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");

      const service = OAuth2.createService(`Gmail_${safeEmail}`)
        .setTokenUrl("https://oauth2.googleapis.com/token")
        .setPrivateKey(this.serviceAccountKey.private_key)
        .setIssuer(this.serviceAccountKey.client_email)
        .setSubject(email)
        .setScope("https://www.googleapis.com/auth/gmail.settings.basic");

      Logger.log("Gmail service created successfully for: " + email);
      return service;
    } catch (error) {
      Logger.log(`Failed to create Gmail service for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Tests all required service account permissions
   * @returns {Object} Test results with details about each permission test
   */
  testAllPermissions() {
    try {
      Logger.log("Testing all required permissions...");
      const results = {
        serviceAccountValid: false,
        adminDirectoryAccess: false,
        gmailSettingsAccess: false,
        externalRequestAccess: false, // Add external request check
        errors: [],
      };

      // Test service account key
      try {
        this.checkServiceAccountKey();
        results.serviceAccountValid = true;
      } catch (error) {
        results.errors.push({
          test: "serviceAccountKey",
          message: error.message,
        });
      }

      // Test Admin Directory API access
      try {
        const adminService = this.getAdminService();
        results.adminDirectoryAccess = adminService.hasAccess();

        if (!results.adminDirectoryAccess) {
          results.errors.push({
            test: "adminDirectoryAccess",
            message:
              adminService.getLastError() ||
              "Access denied to Admin Directory API",
          });
        }
      } catch (error) {
        results.errors.push({
          test: "adminDirectoryAccess",
          message: error.message,
        });
      }

      // Test Gmail Settings API access with admin account
      try {
        const gmailService = this.getGmailService(
          this.config.CLIENT.adminEmail
        );
        results.gmailSettingsAccess = gmailService.hasAccess();

        if (!results.gmailSettingsAccess) {
          results.errors.push({
            test: "gmailSettingsAccess",
            message:
              gmailService.getLastError() ||
              "Access denied to Gmail Settings API",
          });
        }
      } catch (error) {
        results.errors.push({
          test: "gmailSettingsAccess",
          message: error.message,
        });
      }

      // Test External Request permissions
      try {
        // Make a simple fetch request to test external request permissions
        const response = UrlFetchApp.fetch("https://www.google.com", {
          muteHttpExceptions: true,
        });
        results.externalRequestAccess = response.getResponseCode() < 400;

        if (!results.externalRequestAccess) {
          results.errors.push({
            test: "externalRequestAccess",
            message:
              "Unable to make external HTTP requests. Check script.external_request scope.",
          });
        }
      } catch (error) {
        results.errors.push({
          test: "externalRequestAccess",
          message: "External request permission denied: " + error.message,
        });
      }

      // Log results
      Logger.log("Permission test results:");
      Logger.log(
        "- Service account valid: " +
          (results.serviceAccountValid ? "✅" : "❌")
      );
      Logger.log(
        "- Admin Directory access: " +
          (results.adminDirectoryAccess ? "✅" : "❌")
      );
      Logger.log(
        "- Gmail Settings access: " +
          (results.gmailSettingsAccess ? "✅" : "❌")
      );
      Logger.log(
        "- External Request access: " +
          (results.externalRequestAccess ? "✅" : "❌")
      );

      if (results.errors.length > 0) {
        Logger.log("Permission test errors:");
        results.errors.forEach((error) => {
          Logger.log(`- ${error.test}: ${error.message}`);
        });
      }

      return results;
    } catch (error) {
      Logger.log("❌ Error testing permissions: " + error.message);
      console.error("Error in testAllPermissions:", error);
      return {
        serviceAccountValid: false,
        adminDirectoryAccess: false,
        gmailSettingsAccess: false,
        externalRequestAccess: false,
        errors: [{ test: "general", message: error.message }],
      };
    }
  }
}
/**
 * Helper function to get OAuth manifest data
 * @returns {Object|null} The manifest data or null if not available
 */
function getOAuthManifest() {
  try {
    // This is a workaround as we can't directly read the manifest file
    // We'll create a test function to try an external request
    const testScope = UrlFetchApp.fetch("https://www.google.com", {
      muteHttpExceptions: true,
    });
    const hasExternalScope = testScope.getResponseCode() < 400;

    // Create a basic manifest structure with detected scopes
    const manifest = {
      oauthScopes: [
        "https://www.googleapis.com/auth/script.container.ui",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/gmail.settings.basic",
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    };

    if (hasExternalScope) {
      manifest.oauthScopes.push(
        "https://www.googleapis.com/auth/script.external_request"
      );
    }

    return manifest;
  } catch (e) {
    Logger.log("Error getting OAuth manifest: ", e);
    return null;
  }
}
