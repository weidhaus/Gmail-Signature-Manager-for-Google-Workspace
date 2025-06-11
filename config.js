const CONFIG = {
  CLIENT: {
    // Domain and filtering settings
    searchDomain: "example.com", // Your domain here
    adminEmail: "admin@example.com", // Admin email with proper permissions
    testUserEmail: "user@example.com", // Optional test user for testing
    includedUsers: [], // Specific users to include, overrides other filters
    excludedUsers: [], // Specific users to exclude
    excludedOUs: [
      "Service Accounts",
      "Test",
      "External",
      "Offboarded",
      "Administrators",
      "Archived",
    ],
    includeArchived: false, // Whether to include archived users
    includeSuspended: false, // Whether to include suspended users

    // Template settings
    defaultTemplateId: "card", // Use built-in template by default

    // Company information for templates
    companyName: "Example Company, Inc.",
    companyLogoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg", // Publicly accessible placeholder image
    companyAddress1: "123 Main Street",
    companyAddress2: "San Francisco, CA 94105",
    companyWebsite: "https://example.com",
    companyWebsiteDisplay: "example.com",

    // Company branding settings - centralized for all templates
    branding: {
      // Colors
      primaryColor: "#003264", // Primary brand color (used for name, divider, links)
      secondaryColor: "#FFA445", // Secondary color (used for job title)
      textColor: "#333333", // Main text color

      // Fonts
      primaryFont: '"Segoe UI", Arial, sans-serif', // Primary font family (using double quotes)
      fontSize: {
        name: "18px", // Name font size
        jobTitle: "14px", // Job title font size
        text: "13px", // General text font size
      },

      // Layout
      maxWidth: "460px", // Maximum width of signature
      lineHeight: "1.4", // Line height for better readability

      // Logo settings
      logoWidth: "100px",
      logoRadius: "4px", // Border radius for logo
    },
  },
  API: {
    BATCH_SIZE: 10,
    BATCH_DELAY: 1000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },
  EXECUTION: {
    dryRun: false, // Set to true to simulate changes without applying them
    verbose: false, // Set to true for detailed logs during dry run
  },
};

function validateConfig(config) {
  const required = [
    "CLIENT.searchDomain",
    "CLIENT.adminEmail",
    "CLIENT.defaultTemplateId",
    "API.BATCH_SIZE",
    "API.BATCH_DELAY",
    "API.RETRY_ATTEMPTS",
    "API.RETRY_DELAY",
  ];

  for (const path of required) {
    const value = path.split(".").reduce((obj, key) => obj?.[key], config);
    if (!value) {
      throw new Error(`Missing required config: ${path}`);
    }
  }

  // Validate specific values
  if (config.API.BATCH_SIZE < 1)
    throw new Error("BATCH_SIZE must be at least 1");
  if (config.API.BATCH_DELAY < 0)
    throw new Error("BATCH_DELAY must be non-negative");
  if (config.API.RETRY_ATTEMPTS < 0)
    throw new Error("RETRY_ATTEMPTS must be non-negative");
  if (config.API.RETRY_DELAY < 0)
    throw new Error("RETRY_DELAY must be non-negative");

  // Add EXECUTION settings if not present
  config.EXECUTION = config.EXECUTION || { dryRun: false, verbose: false };

  return config;
}
