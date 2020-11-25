const { google } = require("googleapis");

function _getCredentials(action, settings) {
  let keysParam = action.params.CREDENTIALS || settings.CREDENTIALS;
  if (typeof keysParam != "string") {
    return keysParam;
  } else {
    try {
      return JSON.parse(keysParam);
    } catch (err) {
      throw new Error("Invalid credentials JSON");
    }
  }
}

function _authorize(action, settings, scopes) {
  let credentials = _getCredentials(action, settings);
  let superAdminEmail =
    action.params.SUPER_ADMIN_EMAIL || settings.SUPER_ADMIN_EMAIL;

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    scopes || ["https://www.googleapis.com/auth/admin.directory.user"],
    superAdminEmail // The service account needs to impersonate a super admin in your domain
  );

  // Create the admin directory service
  return google.admin({ version: "directory_v1", auth });
}

function _handleParams(param) {
  if (typeof param == "string") {
    try {
      return JSON.parse(param);
    } catch (err) {
      return param;
    }
  } else return param;
}

function createUser(action, settings) {
  return new Promise((resolve, reject) => {
    const user = {
      name: {
        familyName: action.params.FAMILY_NAME,
        givenName: action.params.GIVEN_NAME,
      },
      password: action.params.PASSWORD,
      primaryEmail: action.params.PRIMARY_EMAIL,
      changePasswordAtNextLogin: action.params.CHANGE_PASSWORD_NEXT_LOGIN,
      suspended: action.params.SUSPENDED ? true : false,
    };

    const service = _authorize(action, settings);
    return service.users.insert({ resource: user }, (err, res) => {
      if (err) {
        return reject({
          code: err.code,
          message: err.message,
        });
      }
      const result = {
        user : res.data
      }
      
      if (action.params.GROUPS) {
        let groups = _handleParams(action.params.GROUPS);
        if (!Array.isArray(groups)) groups = [groups];
        return Promise.all(
          groups.map((group) =>
            _addUserToGroup(service, group, { email: user.primaryEmail })
          )
        ).then(groupsResults => {
          result.groups = groupsResults;
          resolve(result);
        });
      }
      return resolve(result);
    });
  });
}

function _addUserToGroup(service, groupKey, user) {
  return new Promise((resolve, reject) => {
    return service.members.insert(
      { groupKey: groupKey, requestBody: user },
      (err, res) => {
        if (err) {
          return reject({ code: err.code, message: err.message });
        }
        resolve(res.data);
      }
    );
  });
}

async function addUserToGroup(action, settings) {
  const scopes = [
    "https://www.googleapis.com/auth/admin.directory.user",
    "https://www.googleapis.com/auth/admin.directory.group",
    "https://www.googleapis.com/auth/admin.directory.group.member",
  ];
  const service = _authorize(action,settings,scopes)
  
  return _addUserToGroup(service, action.params.GROUP_KEY, {
    email: action.params.PRIMARY_EMAIL,
  });
}

module.exports = {
  createUser: createUser,
  addUserToGroup: addUserToGroup,
};
