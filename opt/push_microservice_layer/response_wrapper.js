var ResponseWrapper = {}
const region = "eu-west-1";
const {
    SendMessageCommand,
    SQSClient
} = require("@aws-sdk/client-sqs");

ResponseWrapper.createResponse = function (body, statusCode) {
    let response = {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Credentials": true,
            "Content-Type":"application/json; charset=utf-8"
        }
    };
    if (body)
    {
        if (typeof body == "object") body = JSON.stringify(body);
        response.body = body;
    }
    return response;
}

ResponseWrapper.ServerErrorMessages = {
    not_found: "not_found",
    invalid_parameters : "invalid_parameters"
}

class ResponseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ResponseError";
    }
}

ResponseWrapper.ResponseError = ResponseError;

ResponseWrapper.createServerResponse = function(requestID, errorMessage, data)
{
    var response = {
        requestID : requestID
    }
    if (errorMessage)
    {
        response.errorMessage = errorMessage;
    }
    if (data) response.response = data;
    return response;
}

ResponseWrapper.sendServerResponse = async function(body)
{
    let sqsQueue = process.env.SERVER_RESPONSE_QUEUE_ID;
    let messageQueue = {
        MessageBody : JSON.stringify(body),
        QueueUrl:sqsQueue
    };
    if (!ResponseWrapper.SQS)
    {
        ResponseWrapper.SQS = new SQSClient({
            region: region
        });
    }
    let sendMessageCommand = new SendMessageCommand(messageQueue);
    await ResponseWrapper.SQS.send(sendMessageCommand);


}
module.exports = ResponseWrapper;