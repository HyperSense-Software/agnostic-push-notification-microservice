const PushNotificationRepository = require('../../opt/push_microservice_layer/models/push_notifications.js');
const ResponseWrapper = require('../../opt/push_microservice_layer/response_wrapper.js');

exports.handler = async (event, context) => {
    console.log('Received event:', event.body);
    if (event.type == "KeepAlive")
    {
        return "heartbeat";
    }
    const body = JSON.parse(event.body);

    if (!body) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }
    let userId = event.requestContext.authorizer.claims.sub;

    let counter = await PushNotificationRepository.findUnreadMessageCounter(userId);

    return ResponseWrapper.createResponse({unreadMessages: counter}, 200);
}