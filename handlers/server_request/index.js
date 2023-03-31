const PushNotificationRepository = require('../../opt/push_microservice_layer/models/push_notifications.js');
const PushDevicesRepository = require('../../opt/push_microservice_layer/models/push_devices.js');
const PushNotificationsLogRepository = require('../../opt/push_microservice_layer/models/push_notifications_log.js');
const NotificationManager = require('../../opt/push_microservice_layer/notification_manager.js');
const ResponseWrapper = require('../../opt/push_microservice_layer/response_wrapper.js');

getMessage = async (parameters) =>
{
    let notificationID = parameters.notificationID;

    if (!notificationID)
        throw new ResponseWrapper.ResponseError(ResponseWrapper.ServerErrorMessages.invalid_parameters);
    let item = await PushNotificationRepository.get(notificationID);
    if (item)
    {
        return item;
    }
    else
    {
        throw new ResponseWrapper.ResponseError(ResponseWrapper.ServerErrorMessages.not_found);
    }
}

removeUser = async (parameters) =>
{
    let userId = parameters.userId;
    if (!userId) {
        throw new ResponseWrapper.ResponseError(ResponseWrapper.ServerErrorMessages.invalid_parameters);
    }
    await PushDevicesRepository.removeByUserId(userId);
}

sendMessage = async (notification) =>
{
    let userId = notification.userId;
    if (!notification.userId)
    {
        throw new ResponseWrapper.ResponseError(ResponseWrapper.ServerErrorMessages.invalid_parameters);
    }

    if (!notification.templateId)
    {
        throw new ResponseWrapper.ResponseError(ResponseWrapper.ServerErrorMessages.invalid_parameters);
    }

    if (!notification.type) notification.type = NotificationManager.NotificationType.default;

    //NotificationManager
    let badge = await PushNotificationRepository.findUnreadMessageCounter(userId)
    let payloadiOS = NotificationManager.format("ios", notification.templateId, notification.templateParams, notification.additionalParams, badge);
    let payloadAndroid = NotificationManager.format("android", notification.templateId, notification.templateParams, notification.additionalParams, badge);

    var item = {
        type: notification.type,
        userId: userId,
        id : notification.id,
        notificationPayload: notification,
        texts : {
            ios : {
                title: payloadiOS.notification ? payloadiOS.notification.title : payloadiOS.data.title,
                body: payloadiOS.notification.body ? payloadiOS.notification.body : payloadiOS.data.body,
            },
            android : {
                title: payloadAndroid.notification ? payloadAndroid.notification.title : payloadAndroid.data.title,
                body: payloadAndroid.notification.body ? payloadAndroid.notification.body : payloadAndroid.data.body,
            }
        }
    }

    if (notification.type == NotificationManager.NotificationType.default)
    {
        // send notifications
        item = await PushNotificationRepository.save(item);
        let devices = (await PushDevicesRepository.findByUserId(userId)).items;
        try
        {
            for (var index = 0; index < devices.length; index++)
            {

                let notifResponse = await NotificationManager.sendMessage(devices[index].deviceToken, devices[index].platform == "ios" ? payloadiOS : payloadAndroid);
                var notificationLog = {
                    firebaseId: notifResponse.firebaseID,
                    notificationID: item.id,
                    deviceToken: devices[index].deviceToken
                };
                if (!notifResponse.validToken)
                {
                    notificationLog.status = PushNotificationsLogRepository.Status.error;
                    notificationLog.details = "Firebase rejected the token, "+(notifResponse.details ? notifResponse.details : "");
                    await PushDevicesRepository.remove(devices[index].deviceToken);
                }
                else if (notifResponse.token)
                {
                    //update token
                    await PushDevicesRepository.remove(devices[index].deviceToken);
                    devices[index].deviceToken = notifResponse.token
                    await PushDevicesRepository.save(devices[index]);
                    notificationLog.status = PushNotificationsLogRepository.Status.delivered;
                    notificationLog.details = "Firebase changed the token to "+notifResponse.token +" "+(notifResponse.details ? notifResponse.details : "");
                    if (item.systemStatus != PushNotificationRepository.SystemStatus.delivered)
                    {
                        item.systemStatus = PushNotificationRepository.SystemStatus.delivered
                    }

                }
                else
                {
                    notificationLog.status = PushNotificationsLogRepository.Status.delivered;
                    if (item.systemStatus != PushNotificationRepository.SystemStatus.delivered)
                    {
                        item.systemStatus = PushNotificationRepository.SystemStatus.delivered
                    }
                    if(notifResponse.details)
                    {
                        notificationLog.details = notifResponse.details;
                    }
                }

                await PushNotificationsLogRepository.save(notificationLog)

            }
        }
        catch (e) {
            //invalid payload
            console.log(e);
            item.systemStatus = PushNotificationRepository.SystemStatus.error;
            item.details = "Firebase rejected payload";
        }

    }

    item = await PushNotificationRepository.save(item);
    return item;
}


exports.handler = async (event, context) => {
    console.log('Received event:', event);
    const request = event.Records[0];
    const body = JSON.parse(request.body);

    if (!body) {
        console.log("send_requests", "Missing body");
        return;
    }
    let requestID = body.requestID;
    if (!requestID) {
        console.log("send_requests", "Missing requestID");
        return;
    }


    let requestType = body.requestType;
    if (!requestType) {
        console.log("send_requests", "Missing requestType");
        let response =  ResponseWrapper.createServerResponse(requestID, ResponseWrapper.ServerErrorMessages.invalid_parameters);
        await ResponseWrapper.sendServerResponse(response);
        return response;
    }

    let requestParams = body.requestParams;
    if (!requestParams) {
        console.log("send_requests", "Missing requestParams");
        let response =  ResponseWrapper.createServerResponse(requestID, ResponseWrapper.ServerErrorMessages.invalid_parameters);
        await ResponseWrapper.sendServerResponse(response);
        return response;
    }

    try {
        if (requestType == "get_message")
        {
            let item = await getMessage(requestParams);
            let response = ResponseWrapper.createServerResponse(requestID, undefined, item);
            await ResponseWrapper.sendServerResponse(response);
            return response;
        }
        else if (requestType == "remove_user")
        {
            await removeUser(requestParams);
            let response = ResponseWrapper.createServerResponse(requestID, undefined);
            await ResponseWrapper.sendServerResponse(response);
            return response;
        }
        else if (requestType == "send_message")
        {
            let notification = await sendMessage(requestParams);
            let response = ResponseWrapper.createServerResponse(requestID, undefined, notification);
            await ResponseWrapper.sendServerResponse(response);
            return response;
        }
        else
        {
            console.log("send_requests", "Invalid requestType " + requestType);
            let response =  ResponseWrapper.createServerResponse(requestID, ResponseWrapper.ServerErrorMessages.invalid_parameters);
            await ResponseWrapper.sendServerResponse(response);
            return response;        }
    }
    catch (e) {
        console.log(e);
        if (e instanceof ResponseWrapper.ResponseError)
        {
            let response = ResponseWrapper.createServerResponse(requestID, e.message);
            await ResponseWrapper.sendServerResponse(response);
            return response;
        }
        let response =  ResponseWrapper.createServerResponse(requestID, ResponseWrapper.ServerErrorMessages.invalid_parameters);
        await ResponseWrapper.sendServerResponse(response);
        return response;
    }

}