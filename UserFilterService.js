class UserFilterService {
  constructor(config = CONFIG) {
    this.config = config;
    this.authService = new AuthService(config);
  }

  async getAllowedUsers() {
    const service = this.authService.getAdminService();
    if (!service.hasAccess()) {
      throw new Error("Admin service access denied: " + service.getLastError());
    }

    try {
      const users = await this._fetchUsers(service);
      return this._filterUsers(users);
    } finally {
      service.reset();
    }
  }

  async _fetchUsers(service) {
    const url = `https://admin.googleapis.com/admin/directory/v1/users?domain=${this.config.CLIENT.searchDomain}&maxResults=500&projection=full`;
    const options = {
      headers: { Authorization: "Bearer " + service.getAccessToken() },
      muteHttpExceptions: true,
    };

    Logger.log(
      `Fetching users from domain: ${this.config.CLIENT.searchDomain}`
    );

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      Logger.log(`API error fetching users: ${response.getResponseCode()}`);
      throw new Error(`Failed to fetch users: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const users = data.users || [];
    Logger.log(
      `Retrieved ${users.length} users from domain ${this.config.CLIENT.searchDomain}`
    );
    return users;
  }

  _filterUsers(users) {
    Logger.log(`Filtering ${users.length} users based on configuration rules`);
    const filteredUsers = users
      .filter((user) => this._shouldIncludeUser(user))
      .map((user) => user.primaryEmail);

    Logger.log(
      `Filtered to ${filteredUsers.length} users after applying inclusion/exclusion rules`
    );
    return filteredUsers;
  }

  _shouldIncludeUser(user) {
    const config = this.config.CLIENT; // Use CLIENT instead of USERS

    if (!config.includeArchived && user.archived) return false;
    if (!config.includeSuspended && user.suspended) return false;

    // Check if user's email domain matches searchDomain
    if (user.primaryEmail.split("@")[1] !== config.searchDomain) return false;

    // If includedUsers is not empty, only include specified users
    if (config.includedUsers && config.includedUsers.length > 0) {
      return config.includedUsers.includes(user.primaryEmail);
    }

    // Exclude specific users if configured
    if (config.excludedUsers && config.excludedUsers.length > 0) {
      if (config.excludedUsers.includes(user.primaryEmail)) return false;
    }

    // Exclude specific OUs if configured
    if (config.excludedOUs && config.excludedOUs.length > 0) {
      if (config.excludedOUs.some((ou) => user.orgUnitPath.startsWith(ou)))
        return false;
    }

    return true;
  }
}
