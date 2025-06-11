# Creating Email Signature Templates

This document provides guidance on creating effective HTML email signatures for your organization using the Gmail Signature Manager.

## Template Basics

Email signatures should be created using HTML. While modern HTML and CSS are supported, it's best to stick to basic elements for maximum compatibility across email clients.

### Structure Guidelines

1. Keep your signature under 600px wide
2. Use inline CSS styles instead of stylesheets
3. Use table-based layouts for consistent rendering
4. Use web-safe fonts or include fallbacks
5. Keep file size small (under 10KB)

### Included Templates

The system comes with three built-in templates that you can use as-is or as a starting point for your own designs:

1. **Card Template (`card.html`)**
   - Business card-style with a border
   - Logo on the left with contact information on the right
   - Modern, professional appearance

2. **Minimalist Template (`minimalist.html`)**
   - Streamlined design with the logo at the top
   - Clean, uncluttered layout
   - Vertical arrangement of information

3. **Modern Template (`modern.html`)**
   - Two-column layout with logo on the left
   - Contact information organized in sections
   - Professional spacing and typography

### Available Placeholders

Your template can include these placeholders that will be automatically replaced with actual user data:

| Placeholder               | Description                                  |
| ------------------------- | -------------------------------------------- |
| `{FirstName}`             | User's first name                            |
| `{LastName}`              | User's last name                             |
| `{FullName}`              | User's full name                             |
| `{EmailAddress}`          | User's email address                         |
| `{JobTitle}`              | User's job title                             |
| `{Department}`            | User's department                            |
| `{PhoneNumber}`           | User's phone number                          |
| `{CompanyName}`           | Company name (from config)                   |
| `{CompanyLogo}`           | Company logo URL (from config)               |
| `{CompanyAddress1}`       | First line of company address (from config)  |
| `{CompanyAddress2}`       | Second line of company address (from config) |
| `{CompanyWebsite}`        | Company website URL (from config)            |
| `{CompanyWebsiteDisplay}` | Display text for website (from config)       |

### Branding Variables

The following placeholders allow for centralized branding across all templates:

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

## Centralized Branding Configuration

The signature system now uses a centralized branding configuration in `config.js`. This allows you to:

1. Define your brand colors, fonts, and styling in one place
2. Update the look of all signatures by changing just the config
3. Maintain visual consistency across all templates

To customize your branding:

1. Edit the `branding` section in `config.js`
2. Use branding placeholders in your templates (listed above)
3. All templates will automatically reflect your brand settings

### Example Configuration

```javascript
branding: {
  // Colors
  primaryColor: "#0066cc",      // Primary brand color
  secondaryColor: "#666666",    // Secondary color
  textColor: "#333333",         // Main text color

  // Fonts
  primaryFont: "'Segoe UI', Arial, sans-serif",  // Primary font family
  fontSize: {
    name: "18px",        // Name font size
    jobTitle: "14px",    // Job title font size
    text: "13px"         // General text font size
  },

  // Layout
  maxWidth: "460px",     // Maximum width of signature
  lineHeight: "1.4",     // Line height for better readability

  // Logo settings
  logoWidth: "100px",
  logoRadius: "4px"      // Border radius for logo
}
```

## Example Templates

### Basic Template

```html
<div style="font-family: Arial, sans-serif; color: #333333; max-width: 400px;">
  <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
    {FirstName} {LastName}
  </div>
  <div style="font-size: 14px; margin-bottom: 10px; color: #666666;">
    {JobTitle}
  </div>
  <div style="margin-bottom: 10px;">
    <img
      src="{CompanyLogo}"
      alt="{CompanyName}"
      style="max-width: 120px; height: auto;" />
  </div>
  <div style="font-size: 12px; line-height: 1.4;">
    <div>{CompanyName}</div>
    <div>{CompanyAddress1}</div>
    <div>{CompanyAddress2}</div>
    <div style="margin-top: 5px;">
      <a
        href="mailto:{EmailAddress}"
        style="color: #4285f4; text-decoration: none;"
        >{EmailAddress}</a
      >
    </div>
    <div>
      <a href="{CompanyWebsite}" style="color: #4285f4; text-decoration: none;"
        >{CompanyWebsiteDisplay}</a
      >
    </div>
  </div>
</div>
```

### Professional Template with Branding Variables

```html
<table
  cellpadding="0"
  cellspacing="0"
  style="font-family: {PrimaryFont}; color: {TextColor}; max-width: {MaxWidth};">
  <tr>
    <td style="vertical-align: top; padding-right: 15px;">
      <img
        src="{CompanyLogo}"
        alt="{CompanyName}"
        style="width: {LogoWidth}; height: auto; border-radius: {LogoRadius};" />
    </td>
    <td
      style="vertical-align: top; padding-left: 15px; border-left: 2px solid {PrimaryColor};">
      <div
        style="font-size: {NameFontSize}; font-weight: bold; margin-bottom: 5px; color: {PrimaryColor};">
        {FirstName} {LastName}
      </div>
      <div
        style="font-size: {JobTitleFontSize}; margin-bottom: 10px; color: {SecondaryColor};">
        {JobTitle} | {Department}
      </div>
      <div style="font-size: {TextFontSize}; line-height: {LineHeight};">
        <div style="margin-bottom: 5px;">{CompanyName}</div>
        <div style="margin-bottom: 5px;">{CompanyAddress1}</div>
        <div style="margin-bottom: 5px;">{CompanyAddress2}</div>
        <div style="margin-bottom: 5px;">
          <a
            href="mailto:{EmailAddress}"
            style="color: #4285f4; text-decoration: none;"
            >{EmailAddress}</a
          >
          {PhoneNumber ? ' | ' + PhoneNumber : ''}
        </div>
        <div>
          <a
            href="{CompanyWebsite}"
            style="color: #4285f4; text-decoration: none;"
            >{CompanyWebsiteDisplay}</a
          >
        </div>
      </div>
    </td>
  </tr>
</table>
```

## Best Practices

1. **Keep it simple**: Avoid complex designs that might break in some email clients
2. **Be consistent**: Maintain consistent branding with your company's style guide
3. **Optimize images**: Use small, compressed images that load quickly
4. **Mobile-friendly**: Ensure your signature looks good on mobile devices
5. **Legal requirements**: Include any legally required disclaimers for your region/industry
6. **Test thoroughly**: Test your signature in different email clients before deployment

## Testing Your Template

Before deploying your signature template to your entire organization:

1. Test in the template preview window
2. Create a test signature with a small group of users
3. Check appearance in different email clients (Gmail, Outlook, mobile apps)
4. Verify all placeholders are correctly replaced with actual data

## Adding Your Template

1. Go to the Template Manager UI
2. Click "Create New Template"
3. Enter a name for your template
4. Paste your HTML code into the editor
5. Click "Save Template"
6. To make it your default template, click "Use as Default" on the template item
