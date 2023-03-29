const PushNotificationRepository = require('../../lambda/push_microservice_layer/models/push_notifications.js');
const ResponseWrapper = require('../../lambda/push_microservice_layer/response_wrapper.js');

exports.handler = async (event, context) => {
    console.log('Received event:', event.body);
    const body = JSON.parse(event.body);

    if (!body) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }
    var debtorNumber = body.debtorNumber;
    if (!debtorNumber) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    let counter = await PushNotificationRepository.findUnreadMessageCounter(debtorNumber);

    return ResponseWrapper.createResponse({unreadMessages: counter}, 200);
}