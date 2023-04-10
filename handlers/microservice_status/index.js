const ResponseWrapper = require('../../opt/push_microservice_layer/response_wrapper.js');

exports.handler = async () => {
    let details = process.env.DEPLOY_DETAIL;
    let status = {
        status: "Running",
        region: process.env.AWS_REGION
    }
    try {
        status.details = JSON.parse(details);
    }
    catch (e)
    {
        status.details = details;
        status.warning = "Details should be a json";
    }
    return ResponseWrapper.createResponse(status, 200);
}