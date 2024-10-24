const PushDevicesRepository = require('../../opt/push_microservice_layer/models/push_devices.js');
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
    let deviceToken = body.deviceToken;
    if (!deviceToken) {
        return ResponseWrapper.createResponse("Missing parameters", 400);
    }

    let device = await PushDevicesRepository.get(deviceToken);
    if (!device || device.userId != userId)
    {
        console.log(`device.userId ${device.userId} userId ${userId}`);
        return ResponseWrapper.createResponse("Invalid parameters", 400);
    }
    await PushDevicesRepository.remove(deviceToken);
    return ResponseWrapper.createResponse(null, 200);
}