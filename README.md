# Gmail Signature Manager for Google Workspace

This Google Apps Script project allows Google Workspace administrators to manage and update email signatures across their organization in a consistent manner.

## Features

- **Centralized Signature Management**: Update email signatures across your organization from a single place
- **Template-based System**: Create and manage HTML signature templates
- **Centralized Branding Configuration**: Define company colors, fonts, and styling in one place
- **User Filtering**: Include/exclude users based on organizational units, specific users, or status
- **Customization**: Replace placeholders with actual user data from Google Workspace directory
- **Dry Run Mode**: Test changes without actually updating signatures
- **Batch Processing**: Process users in batches to avoid API limits

## Setup Instructions

### 1. Create a New Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/)
2. Create a new project
3. Copy and paste the files from this repository into your project

### 2. Set Up Google Cloud Platform Project

To use this script, you'll need a Google Cloud Platform project with the necessary APIs and permissions:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project number (you'll need it in step 4)
4. Enable the required APIs:
   - Admin SDK API
   - Gmail API
5. Set up OAuth consent screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "Internal" if this is for a Google Workspace organization (recommended)
   - Fill in the required information (App name, User support email, Developer contact email)
   - No need to add scopes as we'll be using a service account with domain-wide delegation
   - Save and continue
6. Create a service account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name your service account and set the role to "Basic > Editor"
   - Create a JSON key and download it
7. In your Google Workspace Admin Console:

   - Go to Security > API Controls > Domain-wide Delegation
   - Add a new API client with the client ID from your service account
   - Add the following OAuth scopes:

   ```text
   https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/script.external_request
   ```

### 3. Configure the Script

1. In your Google Apps Script project, go to "Project Settings"
2. In the "Google Cloud Platform (GCP) Project" section:
   - Click "Change project"
   - Enter the GCP project number you noted earlier
   - Click "Set project"
3. Go to the "Script Properties" section
4. Add a new script property named `SERVICE_ACCOUNT_KEY` with the entire content of your downloaded JSON key file

### 4. Update Configuration

Modify the `config.js` file with your organization's details:

```javascript
const CONFIG = {
  CLIENT: {
    searchDomain: "yourdomain.com", // Your Google Workspace domain
    adminEmail: "admin@yourdomain.com", // An admin user in your domain
    excludedOUs: ["Service Accounts"], // OUs to exclude
    defaultTemplateId: "minimalist", // Default template ID - options: card, minimalist, modern, template_modern

    // Company information for templates
    companyName: "Your Company Name",
    companyLogoUrl: "https://yourdomain.com/logo.png",
    companyAddress1: "123 Main Street",
    companyAddress2: "San Francisco, CA 94105",
    companyWebsite: "https://yourdomain.com",
    companyWebsiteDisplay: "yourdomain.com",

    // Company branding settings - centralized for all templates
    branding: {
      // Colors
      primaryColor: "#0066cc", // Primary brand color (used for name, divider, links)
      secondaryColor: "#666666", // Secondary color (used for job title)
      textColor: "#333333", // Main text color

      // Fonts
      primaryFont: '"Segoe UI", Arial, sans-serif', // Primary font family
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
    BATCH_SIZE: 10, // Number of users to process in one batch
    BATCH_DELAY: 1000, // Delay between batches in milliseconds
    RETRY_ATTEMPTS: 3, // Number of retry attempts
    RETRY_DELAY: 1000, // Delay between retries in milliseconds
  },
  EXECUTION: {
    dryRun: false, // Set to true to test without applying changes
    verbose: false, // Set to true for detailed logs
  },
};
```

## Using the Script

### Running the Script

1. Deploy the script as a web app or run it from the Apps Script editor
2. Use the `runScript()` function to update all signatures
3. Use the `runAllTests()` function to test your configuration

### Templates

This script comes with built-in templates:

1. `card`: Modern business card-style template with a bordered design and professional layout
2. `minimalist`: Clean, streamlined template with the logo at the top for a simple appearance
3. `modern`: Professional layout with logo alongside contact information in a two-column design

#### Template Features

- All templates use the centralized branding configuration
- Templates automatically adapt to available user data (showing/hiding optional fields)
- Each template is optimized for compatibility across email clients
- Responsive design works well on both desktop and mobile devices

You can specify which template to use by updating the `defaultTemplateId` in the configuration or by placing your template in Google Drive and using its file ID.

### Template Placeholders

Use these placeholders in your HTML templates:

#### User Information Placeholders

| Placeholder      | Description          |
| ---------------- | -------------------- |
| `{FirstName}`    | User's first name    |
| `{LastName}`     | User's last name     |
| `{FullName}`     | User's full name     |
| `{EmailAddress}` | User's email address |
| `{JobTitle}`     | User's job title     |
| `{Department}`   | User's department    |
| `{PhoneNumber}`  | User's phone number  |

#### Company Information Placeholders

| Placeholder               | Description                                  |
| ------------------------- | -------------------------------------------- |
| `{CompanyName}`           | Company name (from config)                   |
| `{CompanyLogo}`           | Company logo URL (from config)               |
| `{CompanyAddress1}`       | First line of company address (from config)  |
| `{CompanyAddress2}`       | Second line of company address (from config) |
| `{CompanyWebsite}`        | Company website URL (from config)            |
| `{CompanyWebsiteDisplay}` | Display text for website (from config)       |

#### Branding Placeholders

| Placeholder          | Description                                |
| -------------------- | ------------------------------------------ |
| `{PrimaryColor}`     | Primary brand color for names, links, etc. |
| `{SecondaryColor}`   | Secondary color for job titles, etc.       |
| `{TextColor}`        | Main text color                            |
| `{PrimaryFont}`      | Primary font family with fallbacks         |
| `{NameFontSize}`     | Font size for names                        |
| `{JobTitleFontSize}` | Font size for job titles                   |
| `{TextFontSize}`     | Font size for general text                 |
| `{MaxWidth}`         | Maximum width of signature                 |
| `{LineHeight}`       | Line height for better readability         |
| `{LogoWidth}`        | Width of company logo                      |
| `{LogoRadius}`       | Border radius for logo                     |

### Centralized Branding

The signature system uses a centralized branding configuration in `config.js`. This allows you to:

1. Define your brand colors, fonts, and styling in one place
2. Update the look of all signatures by changing just the config
3. Maintain visual consistency across all templates

To customize your branding:

1. Edit the `branding` section in `config.js`
2. Use branding placeholders in your templates (listed above)
3. All templates will automatically reflect your brand settings

Example template using branding variables:

```html
<div
  style="font-family: {PrimaryFont}; color: {TextColor}; max-width: {MaxWidth}; line-height: {LineHeight};">
  <div
    style="font-size: {NameFontSize}; font-weight: bold; color: {PrimaryColor};">
    {FirstName} {LastName}
  </div>
  <div style="font-size: {JobTitleFontSize}; color: {SecondaryColor};">
    {JobTitle}
  </div>
  <!-- Additional signature content -->
</div>
```

## Advanced Usage

### Filtering Users

You can include or exclude specific users or organizational units:

```javascript
const CONFIG = {
  CLIENT: {
    // ...other settings...
    includedUsers: ["user1@example.com", "user2@example.com"], // Only include these users
    excludedUsers: ["user3@example.com"], // Exclude these users
    excludedOUs: ["Service Accounts", "External"], // Exclude these OUs
  },
};
```

### Dry Run Mode

To test your configuration without making actual changes:

```javascript
const CONFIG = {
  // ...other settings...
  EXECUTION: {
    dryRun: true, // Will simulate changes without applying them
    verbose: true, // Show detailed logs
  },
};
```

## Troubleshooting

### Authentication Diagnostics

This script includes a built-in authentication diagnostics tool to help you identify and fix permission issues:

1. In your Google Workspace app, go to the "Email Signature" menu
2. Click "Authentication Diagnostics"
3. Review the results and follow the suggested steps to fix any issues

The diagnostics tool checks:

- Whether the service account key is valid and properly formatted
- If the script has access to the Admin Directory API
- If the script has access to Gmail Settings API
- If the script has access to make external requests
- If the GCP project is correctly connected to the Apps Script project
- Common configuration issues that might prevent the script from working

### Common Issues

1. **Authentication errors**:

   - Check your service account permissions and OAuth scopes
   - Verify domain-wide delegation is properly set up
   - Make sure the admin email has super admin privileges
   - Verify that the Apps Script project is connected to the correct GCP project
   - Ensure your OAuth consent screen is properly configured

2. **Rate limiting**:

   - Adjust batch sizes and delays in the CONFIG
   - Process users in smaller batches
   - Add more wait time between API calls

3. **Template errors**:

   - Verify HTML syntax in your templates
   - Check for missing placeholders or invalid HTML
   - Ensure all template files are properly referenced in your project
   - Make sure font family declarations use consistent quote styles

4. **Signature comparison issues**:
   - Check for quote handling in font names
   - Use the debug logging to identify signature differences
   - Ensure HTML entities are properly normalized

### Logs

Check the Apps Script execution logs for detailed information about any errors or issues. The enhanced logging in this script provides helpful debug information when things go wrong.

## License

This project is MIT licensed.
