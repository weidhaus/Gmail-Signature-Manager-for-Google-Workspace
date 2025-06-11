/**
 * TemplateManager class handles loading and applying HTML templates
 */
class TemplateManager {
  constructor() {
    // Initialize templates property
    this.templates = {};
    this.loadEmbeddedTemplates();
  }

  /**
   * Loads all embedded HTML templates from the project
   */
  loadEmbeddedTemplates() {
    try {
      // Load all available templates
      try {
        this.templates["template_modern"] = HtmlService.createTemplateFromFile(
          "template_modern"
        )
          .evaluate()
          .getContent();
        Logger.log("Loaded modern template successfully");
      } catch (e) {
        Logger.log("Could not load modern template: " + e.message);
      }

      // Load built-in templates directly
      try {
        // Load card.html
        this.templates["card"] = HtmlService.createTemplateFromFile("card")
          .evaluate()
          .getContent();

        // Load minimalist.html
        this.templates["minimalist"] = HtmlService.createTemplateFromFile(
          "minimalist"
        )
          .evaluate()
          .getContent();

        // Load modern.html
        this.templates["modern"] = HtmlService.createTemplateFromFile("modern")
          .evaluate()
          .getContent();

        Logger.log("Loaded all built-in templates successfully");
      } catch (e) {
        Logger.log("Error loading built-in templates: " + e.message);
      }

      Logger.log("Embedded templates loaded successfully");
    } catch (e) {
      Logger.log("Error loading embedded templates: " + e.message);
    }
  }

  /**
   * Load a template by its identifier
   * @param {string} templateIdentifier - Either a built-in template ID or a Drive file ID
   * @returns {string} The template content
   */
  async loadTemplate(templateIdentifier) {
    // Option 1: Check if it's a built-in template
    if (this.templates[templateIdentifier]) {
      return this.templates[templateIdentifier];
    }

    // Option 2: Try to load from embedded HTML file
    try {
      return HtmlService.createTemplateFromFile(templateIdentifier)
        .evaluate()
        .getContent();
    } catch (e) {
      // Not an embedded file, continue to option 3
    }

    // Option 3: Load from Google Drive if the identifier is a file ID
    const cache = CacheService.getScriptCache();
    const cacheKey = `template_${templateIdentifier}`;

    let template = cache.get(cacheKey);
    if (template) {
      return template;
    }

    try {
      // Assume it's a file ID
      const file = DriveApp.getFileById(templateIdentifier);
      template = file.getBlob().getDataAsString();
      cache.put(cacheKey, template, 21600); // Cache for 6 hours
      return template;
    } catch (error) {
      // Be more specific if the error is due to an invalid file ID for Drive
      if (
        error.message.includes("does not exist") ||
        error.message.includes("Invalid argument")
      ) {
        throw new Error(
          `Failed to load template from Drive: Invalid file ID or file not found for '${templateIdentifier}'. Error: ${error.message}`
        );
      }
      throw new Error(`Failed to load template: ${error.message}`);
    }
  }

  /**
   * Apply template by replacing placeholders with values
   * @param {string} template - The HTML template
   * @param {Object} values - Key-value pairs for placeholders and their values
   * @returns {string} Processed template with placeholders replaced
   */
  applyTemplate(template, values) {
    let processedTemplate = template;
    Object.entries(values).forEach(([placeholder, value]) => {
      // Specially handle font family to ensure consistent quotes
      if (placeholder === "{PrimaryFont}" && value) {
        // Ensure font names with spaces use double quotes
        value = value.replace(/\'([^\']+)\'/g, '"$1"');
      }

      const regex = new RegExp(
        placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      );
      processedTemplate = processedTemplate.replace(regex, value || "");
    });
    return processedTemplate;
  }
}
