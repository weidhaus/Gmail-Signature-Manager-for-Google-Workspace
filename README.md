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

### Option A — Deploy script (recommended)

A `deploy.sh` script handles the GCP setup and code push automatically, then walks you through the remaining manual steps.

**Prerequisites:** `gcloud` CLI, `node` + `npm`, `python3`

```bash
git clone https://github.com/weidhaus/Gmail-Signature-Manager-for-Google-Workspace
cd Gmail-Signature-Manager-for-Google-Workspace
./deploy.sh
```

The script will:

1. Let you choose a GCP project or create a new one
2. Enable the required APIs (Admin SDK, Gmail, Drive, Apps Script)
3. Create a service account and download its key
4. Prompt for your domain, admin email, and a test user — and write them into `config.js`
5. Create the Apps Script project and push all files
6. Walk you through the four manual steps that cannot be automated

---

### Option B — Manual setup

#### 1. Clone and push to Apps Script

Prerequisites: `node` + `npm`

```bash
npm install -g @google/clasp   # Google's Apps Script CLI
clasp login
clasp create --title "Gmail Signature Manager" --type standalone
clasp push --force
```

#### 2. Set up a GCP project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project
2. Note the **project number** (shown on the project dashboard — not the project ID)
3. Enable the required APIs:
   - [Admin SDK API](https://console.cloud.google.com/apis/library/admin.googleapis.com)
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
4. Configure the OAuth consent screen:
   - APIs & Services → OAuth consent screen → Get started
   - User type: **Internal** → Create
   - Fill in App name and support email → Save
5. Create an OAuth client ID:
   - APIs & Services → [Credentials](https://console.cloud.google.com/apis/credentials) → + Create Credentials → OAuth client ID
   - Application type: **Web application** → Create
6. Create a service account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name it (e.g. `gmail-sig-manager`) → Create and continue → Done
   - Open the service account → Keys → Add Key → Create new key → JSON → download

#### 3. Finish configuration in Apps Script

1. Open the script editor at [script.google.com](https://script.google.com)
2. **Link GCP project:** ⚙ Project Settings → Change project → enter the project number → Set project
3. **Add service account key:** ⚙ Project Settings → Script Properties → + Add property
   - Name: `SERVICE_ACCOUNT_KEY`
   - Value: paste the entire contents of the downloaded JSON key file

#### 4. Configure domain-wide delegation

In the [Google Workspace Admin Console](https://admin.google.com/ac/owl/domainwidedelegation):

- Add new → enter the **numeric client ID** from the service account key file
- OAuth scopes:

  ```text
  https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/script.external_request
  ```

- Authorize

#### 5. Update configuration

Modify `config.js` with your organisation's details and push again (`clasp push --force`):

```javascript
const CONFIG = {
  CLIENT: {
    searchDomain: "yourdomain.com", // Your Google Workspace domain
    adminEmail: "admin@yourdomain.com", // An admin user in your domain
    excludedOUs: ["Service Accounts"], // OUs to exclude
    defaultTemplateId: "card", // Default template ID - options: card, minimalist, modern, template_modern

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
2. Use the `runSignatureManager()` function to update all signatures
3. Use the `runAllTests()` function to test your configuration
4. Use the `runAuthDiagnostics()` function to check authentication and permissions

### Utility Functions

#### List Available Templates

The script provides a utility function to help you see all available templates:

```javascript
function listAvailableTemplates() {
  // This will show all templates in the Apps Script logger
}
```

Run this function to see all available template IDs and a preview of their content in the Apps Script logs. This is helpful when you want to confirm which templates are available in your project.

### Templates

This script comes with built-in templates:

1. `card`: Modern business card-style template with a bordered design and professional layout
2. `minimalist`: Clean, streamlined template with the logo at the top for a simple appearance
3. `modern`: Professional layout with logo alongside contact information in a two-column design
4. `template_modern`: Classic layout with horizontal divider between sections

#### Template Features

- All templates use the centralized branding configuration
- Templates automatically adapt to available user data (showing/hiding optional fields)
- Each template is optimized for compatibility across email clients
- Responsive design works well on both desktop and mobile devices

You can specify which template to use by updating the `defaultTemplateId` in the configuration or by placing your template in Google Drive and using its file ID.

For more detailed information about creating and customizing templates, please refer to the [TEMPLATES.md](TEMPLATES.md) file.

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

## Contributing

Contributions to the Gmail Signature Manager are welcome! Here's how you can contribute:

1. **Submit Issues**: Report bugs or suggest features by opening an issue
2. **Create Pull Requests**: Submit PRs to fix issues or add new features
3. **Improve Documentation**: Help clarify setup instructions or add examples
4. **Add Templates**: Contribute new email signature templates

When contributing code, please:

- Follow the existing code style
- Add appropriate comments
- Test your changes thoroughly
- Update documentation as needed

## License

This project is MIT licensed.
