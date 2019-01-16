
const { google } = require('googleapis');


function _authorize(action) {
    let client_id = action.params.CLIENT_ID;
    let client_secret = action.params.CLIENT_SECRET;
    let redirect_uris = ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"];

    const oauth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
    let access_token = action.params.ACCESS_TOKEN;
    let scope = action.params.SCOPES;
    oauth2Client.credentials = {
        access_token: access_token,
        scope: scope,
        refresh_token: action.params.REFRESH_TOKEN
    }

    return google.admin({ 
        version: 'directory_v1', 
        auth : oauth2Client
    });
}

function _handleParams(param) {
    if (typeof param == 'string')
        return JSON.parse(param);
    else
        return param;
}

function createUser(action) {
    return new Promise((resolve,reject) => {
        const user = {
            name: {
                familyName: action.params.FAMILY_NAME,
                givenName: action.params.GIVEN_NAME
            },
            password: action.params.PASSWORD,
            primaryEmail: action.params.PRIMARY_EMAIL,
            changePasswordAtNextLogin: action.params.CHANGE_PASSWORD_NEXT_LOGIN
        }
    
        const service = _authorize(action);
        return service.users.insert({ resource: user },(err,res) => {
            if(err){
                return reject(err)
            }
            if (action.params.GROUPS) {
                let groups = _handleParams(action.params.GROUPS);
                return Promise.all(groups.map(group => _addUserToGroup(service, group, { email: user.primaryEmail }))).then(()=>res);
            }
            return resolve(res);
        });
    })
}

function _addUserToGroup(service, groupKey, user) {
    return new Promise((resolve,reject) => {
        return service.members.insert({ groupKey: groupKey, resource: user },(err,res) => {
            if(err){
                return reject(err)
            }
            resolve(res)
        });
    })
}

function addUserToGroup(action) {
    const service =_authorize(action);
    return _addUserToGroup(service, action.params.GROUP_KEY, {
        email: action.params.PRIMARY_EMAIL
    });
}

module.exports = {
    createUser:createUser,
    addUserToGroup:addUserToGroup
}


