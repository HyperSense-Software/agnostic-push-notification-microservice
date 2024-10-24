const PushNotificationRepository = require('../../opt/push_microservice_layer/models/push_notifications.js');
const ResponseWrapper = require('../../opt/push_microservice_layer/response_wrapper.js');

exports.handler = async (event, context) => {

    if (event.type == "KeepAlive")
    {
        return "heartbeat";
    }
    const body = JSON.parse(event.body);

    if (!body) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }
    let userId = event.requestContext.authorizer.claims.sub;

    let id = body.id;
    if (!id) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    let existingItem = await PushNotificationRepository.get(id);
    if (!existingItem || existingItem.userId != userId)
    {
        return ResponseWrapper.createResponse("Missing item", 404);
    }

    existingItem.status = PushNotificationRepository.Status.read;
    await PushNotificationRepository.save(existingItem);

    return ResponseWrapper.createResponse(existingItem, 200);

}