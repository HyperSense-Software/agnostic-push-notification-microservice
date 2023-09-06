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
        console.log("NotificationManager.initialiseAdmin", e);
    }

    initialisedAdmin = true;
}


NotificationManager.sendMessage = async function (token, pushMessage)
{
    await NotificationManager.initialiseAdmin();
    let response = await admin.messaging().sendToDevice(token, pushMessage)
    let results = response.results;
    if (!results.length) return  {validToken: false};
    let result = results[0];
    if (result.error)
    {
        if ((result.error.code == "messaging/invalid-recipient") ||
            (result.error.code == "messaging/registration-token-not-registered") ||
            (result.error.code == "messaging/invalid-registration-token"))// remove token
        {
            return  {validToken: false, details: result.error.code};
        }
        else if ((result.error.code == "messaging/message-rate-exceeded")
            || (result.error.code == "messaging/device-message-rate-exceeded")) // can retry
        {
            return  {validToken: true, details: result.error.code};
        }

    }

    if (result.canonicalRegistrationToken && result.canonicalRegistrationToken != token)
    {
        //token has changed - update dynamo tokens
        return  {firebaseID : result.messageId, validToken: true, token: result.canonicalRegistrationToken};
    }

    return  {firebaseID : result.messageId, validToken: true};
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
            badge : String(badge)
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
    }
    else
    {
        if (androidTitle) notification.notification.title = androidTitle;
        if (androidSubtitle) notification.notification.body = androidSubtitle;
        notification.notification.clickAction = "FLUTTER_NOTIFICATION_CLICK";
    }

    if (additionalParams)
    {
        keys = Object.keys(additionalParams);
        for (let index = 0; index < keys.length; index++)
        {
            notification.data[keys[index]] = additionalParams[keys[index]];
        }

    }

    return notification;
}

module.exports = NotificationManager;