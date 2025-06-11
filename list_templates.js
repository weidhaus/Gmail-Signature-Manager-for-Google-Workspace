/**
 * Function to list available templates
 * Run this function to see all available templates in the logs
 */
function listAvailableTemplates() {
  const templateManager = new TemplateManager();

  // Force loading templates
  templateManager.loadEmbeddedTemplates();

  // Log available template IDs
  Logger.log("Available template IDs:");
  for (const templateId in templateManager.templates) {
    const template = templateManager.templates[templateId];
    const previewLength = 50; // Show first 50 chars of template
    Logger.log(`- ${templateId}: ${template.substring(0, previewLength)}...`);
  }

  return templateManager.templates;
}
