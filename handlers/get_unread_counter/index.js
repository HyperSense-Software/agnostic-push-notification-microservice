const PushNotificationRepository = require('../../lambda/push_microservice_layer/models/push_notifications.js');
const ResponseWrapper = require('../../lambda/push_microservice_layer/response_wrapper.js');

exports.handler = async (event, context) => {
    console.log('Received event:', event.body);
    const body = JSON.parse(event.body);

    if (!body) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }
    var userId = body.userId;
    if (!userId) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    let counter = await PushNotificationRepository.findUnreadMessageCounter(userId);

    return ResponseWrapper.createResponse({unreadMessages: counter}, 200);
}