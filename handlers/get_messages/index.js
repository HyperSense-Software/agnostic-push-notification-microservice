const PushNotificationRepository = require('../../opt/push_microservice_layer/models/push_notifications.js');
const ResponseWrapper = require('../../opt/push_microservice_layer/response_wrapper.js');

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

    let items = await PushNotificationRepository.findByUserId(userId,
        body.limit,
        body.minCreatedAt,
        body.maxCreatedAt,
        body.lastKey);


    return ResponseWrapper.createResponse(items, 200);
}