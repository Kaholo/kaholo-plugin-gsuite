const { google } = require("googleapis");

function _authorize(action, settings) {
  let client_id = settings.CLIENT_ID || action.params.CLIENT_ID;
  let client_secret = settings.CLIENT_SECRET || action.params.CLIENT_SECRET;
  let redirect_uris = ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"];

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  oauth2Client.credentials = {
    access_token: settings.ACCESS_TOKEN || action.params.ACCESS_TOKEN,
    scope: action.params.SCOPES,
    refresh_token: settings.REFRESH_TOKEN || action.params.REFRESH_TOKEN
  };

  return google.admin({
    version: "directory_v1",
    auth: oauth2Client
  });
}

function _handleParams(param) {
  if (typeof param == "string") {
      try {
          return JSON.parse(param);
      } catch (err){
          return param;
      }
  }
  else return param;
}

function createUser(action, settings) {
  return new Promise((resolve, reject) => {
    const user = {
      name: {
        familyName: action.params.FAMILY_NAME,
        givenName: action.params.GIVEN_NAME
      },
      password: action.params.PASSWORD,
      primaryEmail: action.params.PRIMARY_EMAIL,
      changePasswordAtNextLogin: action.params.CHANGE_PASSWORD_NEXT_LOGIN,
      suspended : action.params.SUSPENDED ? true : false
    };

    const service = _authorize(action, settings);
    return service.users.insert({ resource: user }, (err, res) => {
      if (err) {
        return reject({
            code : err.code,
            message : err.message
        });
      }
      if (action.params.GROUPS) {
        let groups = _handleParams(action.params.GROUPS);
        if (!Array.isArray(groups)) groups = [groups];
        return Promise.all(
          groups.map(group =>
            _addUserToGroup(service, group, { email: user.primaryEmail })
          )
        ).then(() => {
            resolve(res.data)
        });
      }
      return resolve(res.data);
    });
  });
}

function _addUserToGroup(service, groupKey, user) {
  return new Promise((resolve, reject) => {
    return service.members.insert(
      { groupKey: groupKey, resource: user },
      (err, res) => {
        if (err) {
          return reject({code : err.code, message : err.message });
        }
        resolve(res.data);
      }
    );
  });
}

function addUserToGroup(action, settings) {
  const service = _authorize(action, settings);
  return _addUserToGroup(service, action.params.GROUP_KEY, {
    email: action.params.PRIMARY_EMAIL
  });
}

module.exports = {
  createUser: createUser,
  addUserToGroup: addUserToGroup
};