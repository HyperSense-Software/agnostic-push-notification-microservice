const PushDevicesRepository = require('../../opt/push_microservice_layer/models/push_devices.js');
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

    var deviceToken = body.deviceToken;
    if (!deviceToken) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    await PushDevicesRepository.remove(deviceToken);
    return ResponseWrapper.createResponse(null, 200);
}