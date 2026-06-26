class SignatureService {
  constructor(config) {
    this.config = config;
    this.authService = new AuthService(config);
    this.templateManager = new TemplateManager();
    this.resetMetrics();
  }

  resetMetrics() {
    this.metrics = {
      startTime: Date.now(),
      comparisons: 0,
      updates: 0,
      skipped: 0,
      errors: 0
    };
  }

  async processUsers(users) {
    this.resetMetrics();
    const results = {
      processed: [],
      skipped: [],
      failed: {}
    };

    const template = await this._loadTemplate();

    for (let i = 0; i < users.length; i++) {
      try {
        const email = users[i];
        const userData = await this._fetchUserData(email);
        Logger.log(`🔍 Checking signature for ${userData.name.givenName} ${userData.name.familyName} (${email})`);

        const status = await this._setSignature(email, template);
        if (status === 'skipped') {
          results.skipped.push(email);
          this.metrics.skipped++;
        } else if (status === 'updated') {
          results.processed.push(email);
          this.metrics.updates++;
        }

        if (i < users.length - 1) {
          Utilities.sleep(this.config.API.BATCH_DELAY || 1000);
        }
      } catch (error) {
        results.failed[users[i]] = error.message;
        this.metrics.errors++;
      }
    }

    // Log final metrics
    const duration = Date.now() - this.metrics.startTime;
    Logger.log("\n📈 Performance Metrics:");
    Logger.log(`• Total Time: ${duration}ms`);
    Logger.log(`• Comparisons: ${this.metrics.comparisons}`);
    Logger.log(`• Updates: ${this.metrics.updates}`);
    Logger.log(`• Skipped: ${this.metrics.skipped}`);
    Logger.log(`• Errors: ${this.metrics.errors}`);

    return results;
  }

  async _loadTemplate() {
    return await this.templateManager.loadTemplate(this.config.CLIENT.defaultTemplateId);
  }

  _createBatches(items) {
    return Array.from(
      { length: Math.ceil(items.length / this.config.API.BATCH_SIZE) },
      (_, i) =>
        items.slice(
          i * this.config.API.BATCH_SIZE,
          (i + 1) * this.config.API.BATCH_SIZE
        )
    );
  }

  async _processBatches(batches, template) {
    const results = { processed: [], failed: {} };

    for (const batch of batches) {
      const batchResults = await this._processBatch(batch, template);
      results.processed.push(...batchResults.processed);
      Object.assign(results.failed, batchResults.failed);
      Utilities.sleep(this.config.API.DELAY_BETWEEN_CALLS);
    }

    return results;
  }

  async _processBatch(userEmails, template) {
    const results = { processed: [], failed: {} };

    for (const email of userEmails) {
      try {
        await this._setSignature(email, template);
        results.processed.push(email);
        // Add delay between individual requests
        Utilities.sleep(1000);
      } catch (error) {
        if (error.message.includes('Rate Limit Exceeded')) {
          // Wait longer if rate limited
          Utilities.sleep(5000);
          // Retry once
          try {
            await this._setSignature(email, template);
            results.processed.push(email);
          } catch (retryError) {
            results.failed[email] = retryError.message;
          }
        } else {
          results.failed[email] = error.message;
        }
      }
    }
    return results;
  }

  async _setSignature(email, template) {
    try {
      if (!template) {
        throw new Error("No signature template provided");
      }

      const userData = await this._fetchUserData(email);
      const name = `${userData.name?.givenName || ""} ${userData.name?.familyName || ""}`.trim();

      const sendAsSettings = await this._getSendAsSettings(email);
      const primaryAlias = sendAsSettings.find((alias) => alias.isPrimary);

      if (!primaryAlias) {
        Logger.log(`❌ No primary alias found for ${email}`);
        throw new Error("No primary alias found");
      }

      const processedUserData = this._getUserData(userData);
      const newSignature = this.templateManager.applyTemplate(template, processedUserData);

      // Normalize signatures before comparison
      const normalizedNew = this._normalizeSignature(newSignature);
      const normalizedCurrent = this._normalizeSignature(primaryAlias.signature || "");

      this.metrics.comparisons++;

      const signaturesMatch = normalizedNew === normalizedCurrent;
      Logger.log(`🔍 Signatures match: ${signaturesMatch}`);

      if (!signaturesMatch) {
        Logger.log("🔍 Signature differences found:");
        for (let i = 0; i < Math.max(normalizedNew.length, normalizedCurrent.length); i++) {
          if (normalizedNew[i] !== normalizedCurrent[i]) {
            Logger.log(
              `Position ${i}: New="${normalizedNew.substr(i, 20)}" vs Current="${normalizedCurrent.substr(i, 20)}"`
            );
            break;
          }
        }

        if (this.config.EXECUTION.dryRun) {
          Logger.log(`🔄 DRY RUN: Would update signature for ${name} (${email})`);
          if (this.config.EXECUTION.verbose) {
            Logger.log("New signature would be:");
            Logger.log(newSignature);
          }
          return 'updated'; // Simulate success in dry run
        }

        // Real update if not in dry run mode
        const success = await this._updateSignature(email, newSignature);
        if (success) {
          Logger.log(`✓ Updated signature for ${name} (${email})`);
          return 'updated';
        }
        throw new Error("Signature update failed");
      }

      Logger.log(`⏭️ Skipping ${name} (${email}) - signature already up to date`);
      return 'skipped';
    } catch (error) {
      Logger.log(`❌ Error setting signature for ${email}: ${error.message}`);
      throw error;
    }
  }

  async _getSendAsSettings(email) {
    try {
      const service = this.authService.getGmailService(email);
      const url = `https://gmail.googleapis.com/gmail/v1/users/${email}/settings/sendAs`;

      const response = await UrlFetchApp.fetch(url, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + service.getAccessToken(),
        },
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() !== 200) {
        throw new Error(
          `Failed to fetch sendAs settings: ${response.getContentText()}`
        );
      }

      const data = JSON.parse(response.getContentText());
      return data.sendAs || [];
    } catch (error) {
      Logger.log(
        `Warning: Could not fetch sendAs settings for ${email}: ${error.message}`
      );
      return [];
    }
  }

  async _updateSignature(email, signature) {
    try {
      const service = this.authService.getGmailService(email);
      const url = `https://gmail.googleapis.com/gmail/v1/users/${email}/settings/sendAs/${email}`;

      const response = await UrlFetchApp.fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + service.getAccessToken(),
          "Content-Type": "application/json",
        },
        payload: JSON.stringify({
          signature: signature,
        }),
        muteHttpExceptions: true,
      });

      return response.getResponseCode() === 200;
    } catch (error) {
      Logger.log(`Error updating signature: ${error.message}`);
      return false;
    }
  }

  async _fetchUserData(email) {
    const url = `https://admin.googleapis.com/admin/directory/v1/users/${email}`;
    const service = this.authService.getAdminService();
    const options = {
      headers: {
        Authorization: "Bearer " + service.getAccessToken(),
      },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      throw new Error(
        `Failed to fetch user data: ${response.getContentText()}`
      );
    }

    return JSON.parse(response.getContentText());
  }

  _getGmailService(email) {
    return OAuth2.createService(`Gmail_${email}`)
      .setSubject(email)
      .setTokenUrl(serviceAccount.token_uri)
      .setPrivateKey(serviceAccount.private_key)
      .setIssuer(serviceAccount.client_email)
      .setScope("https://www.googleapis.com/auth/gmail.settings.basic")
      .setCache(CacheService.getScriptCache())
      .setPropertyStore(PropertiesService.getScriptProperties());
  }

  _getCurrentSignature(email) {
    throw new Error("Method not used anymore");
  }

  _getUserData(schema) {
    const userData = {
      "{FirstName}": schema.name?.givenName || "",
      "{LastName}": schema.name?.familyName || "",
      "{JobTitle}": schema.organizations?.[0]?.title || "",
      "{Team}": schema.organizations?.[0]?.department || "",
      "{EmailAddress}": schema.primaryEmail || "",
      "{ImageUrl}":
        schema.thumbnailPhotoUrl || this.config.CLIENT.companyLogoUrl || "",
      "{Phone}": schema.phones?.find((p) => p.type === "mobile")?.value || "",
      "{Location}":
        schema.addresses?.find((a) => a.type === "work")?.locality || "Berlin",
    };
    return userData;
  }

  _normalizeSignature(signature) {
    if (!signature) return "";

    return (
      signature
        // Remove all whitespace between style attributes
        .replace(/;\s+/g, ";")
        .replace(/:\s+/g, ":")
        // Remove all spaces after commas in style values
        .replace(/,\s+/g, ",")
        // Remove whitespace between HTML tags
        .replace(/>\s+</g, "><")
        // Remove target="_blank" attributes
        .replace(/\s*target="_blank"/g, "")
        // Normalize quotes to double quotes
        .replace(/'/g, '"')
        // Remove optional semicolons at the end of style attributes
        .replace(/;"/g, '"')
        // Normalize self-closing tags
        .replace(/\s*\/>/g, ">")
        // Remove multiple spaces
        .replace(/\s+/g, " ")
        // Remove spaces before/after = in attributes
        .replace(/\s*=\s*/g, "=")
        // Remove line breaks and trim
        .replace(/\n/g, "")
        .trim()
    );
  }

  async _compareSignatures(currentSignature, newSignature) {
    // Add version metadata
    const version = new Date().toISOString();
    const versionedSignature = newSignature.replace(
      '</body>',
      `<!-- Version: ${version} --></body>`
    );

    // Compare ignoring version
    const stripVersion = (sig) => sig.replace(/<!-- Version: .+ -->/g, '');
    return stripVersion(currentSignature) === stripVersion(newSignature);
  }
}
