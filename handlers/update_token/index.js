const PushDevicesRepository = require('../../lambda/push_microservice_layer/models/push_devices.js');
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

    var deviceToken = body.deviceToken;
    if (!deviceToken) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    var platform = body.platform;
    if (!platform) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    let existingItem = await PushDevicesRepository.get(deviceToken);
    if (existingItem && (existingItem.userId == userId)){
        return ResponseWrapper.createResponse(existingItem, 200);
    }

    var oldDeviceToken = body.oldDeviceToken;

    if (oldDeviceToken)
    {
        //remove old entry
        await PushDevicesRepository.remove(oldDeviceToken);
    }

    let savedObject = await PushDevicesRepository.save({userId: userId, deviceToken: deviceToken, platform: platform});

    return ResponseWrapper.createResponse(savedObject, 200);
}