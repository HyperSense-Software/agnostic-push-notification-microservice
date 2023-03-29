const PushNotificationRepository = require('../../lambda/push_microservice_layer/models/push_notifications.js');
const ResponseWrapper = require('../../lambda/push_microservice_layer/response_wrapper.js');

exports.handler = async (event, context) => {
    const body = JSON.parse(event.body);

    if (!body) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }
    var id = body.id;
    if (!id) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    let existingItem = await PushNotificationRepository.get(id);
    if (!existingItem)
    {
        return ResponseWrapper.createResponse("Missing item", 404);
    }

    existingItem.status = PushNotificationRepository.Status.read;
    await PushNotificationRepository.save(existingItem);

    return ResponseWrapper.createResponse(existingItem, 200);

}