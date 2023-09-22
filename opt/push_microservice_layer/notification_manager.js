const admin = require("firebase-admin");
const SecretManager = require("./secrets_manager.js");
const notificationTemplates = require("./resources/notificationTemplates.json");

let NotificationManager = {};

NotificationManager.firebaseAdmin = admin;

NotificationManager.NotificationType = {
    default: "default",
    silent: "silent"
};

let initialisedAdmin = false;
NotificationManager.initialiseAdmin = async function ()
{
    if(initialisedAdmin) return;
    // load settings from secrets manager
    let settings = await SecretManager.getSecrets('FIREBASE_KEY');
    if(initialisedAdmin) return;
    try {
        settings = JSON.parse(settings);
        let credentials = {
            projectId: settings.project_id,
            clientEmail: settings.client_email,
            privateKey: settings.private_key
        };
        admin.initializeApp({
            credential: admin.credential.cert(credentials)
        });
    }
    catch(e)
    {
        console.error("NotificationManager.initialiseAdmin", e);
    }

    initialisedAdmin = true;
}


//sendToDevice This API is now obsolete. https://firebase.google.com/docs/reference/admin/node/firebase-admin.messaging.messaging.md#messagingsendtodevice
NotificationManager.sendMessage = async function (token, pushMessage)
{
    await NotificationManager.initialiseAdmin();
    let message = Object.assign({}, pushMessage);
    message.token = token;
    try {
        let response = await admin.messaging().send(message);
        if (!response) return  {validToken: false};
        // projects/{project_id}/messages/{message_id}
        let responseParts = response.split("/");
        let result = responseParts[responseParts.length - 1];
        return  {firebaseID : result, validToken: true};
    }
    catch (error)
    {
        let errorInfo = error.errorInfo;
        console.log("NotificationManager.sendMessage:errorInfo", errorInfo);
        if (!errorInfo) return  {validToken: true, details: error.code ? error.code : error.message};
        let errorCode = errorInfo.code;
        if (!errorCode) return {validToken: true, details: errorInfo};

        if ((errorCode == "messaging/invalid-recipient") ||
            (errorCode == "messaging/registration-token-not-registered") ||
            (errorCode == "messaging/invalid-registration-token") ||
            (errorCode == "messaging/invalid-argument"))// remove token
        {
            return  {validToken: false, details: error.code};
        }
        else if ((errorCode == "messaging/message-rate-exceeded")
            || (errorCode == "messaging/device-message-rate-exceeded")) // can retry
        {
            return  {validToken: true, details: error.code};
        }
        return  {validToken: false, details: errorCode};
    }
}

NotificationManager.format = function (platform, templateId, templateParams, additionalParams, badge)
{
    let notification = {
        data : {
            template : JSON.stringify(notificationTemplates[templateId]),
            templateId: templateId
        },
        notification : {
            // title : "",
            // body : "",
        }
    }

    let iOSTitle = notificationTemplates[templateId].iOS_title;
    let iOSSubtitle = notificationTemplates[templateId].iOS_subtitle
    let androidTitle = notificationTemplates[templateId].Android_title;
    let androidSubtitle = notificationTemplates[templateId].Android_subtitle;

    if (templateParams)
    {
        notification.data.templateParams = JSON.stringify(templateParams)

        let keys = Object.keys(templateParams);
        for (let index = 0; index < keys.length; index++)
        {
            let regex = RegExp("{" + keys[index] + "}", 'gmi');
            if (iOSTitle) iOSTitle = iOSTitle.replace(regex, templateParams[keys[index]]);
            if (iOSSubtitle) iOSSubtitle = iOSSubtitle.replace(regex, templateParams[keys[index]]);
            if (androidTitle) androidTitle = androidTitle.replace(regex, templateParams[keys[index]]);
            if (androidSubtitle) androidSubtitle = androidSubtitle.replace(regex, templateParams[keys[index]]);
        }
    }
    if (platform == "ios")
    {
        if (iOSTitle) notification.notification.title = iOSTitle;
        if (iOSSubtitle) notification.notification.body = iOSSubtitle;
        if (badge)
        {
            notification.apns = {
                payload: {
                    aps: {
                        badge: badge,
                    }
                }
            }
        }
    }
    else
    {
        if (androidTitle) notification.notification.title = androidTitle;
        if (androidSubtitle) notification.notification.body = androidSubtitle;
        notification.android = {
            notification: {
                clickAction: "FLUTTER_NOTIFICATION_CLICK"
            }
        }
        if (badge)
        {
            notification.android.notification.notificationCount = badge;
        }
    }

    if (additionalParams)
    {
        let keys = Object.keys(additionalParams);
        for (let index = 0; index < keys.length; index++)
        {
            notification.data[keys[index]] = additionalParams[keys[index]];
        }

    }

    return notification;
}

module.exports = NotificationManager;