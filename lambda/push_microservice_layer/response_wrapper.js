var ResponseWrapper = {}
const AWS = require('aws-sdk');

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
    //TODO: set this SERVER_RESPONSE_QUEUE_ID
    let sqsQueue = process.env.SERVER_RESPONSE_QUEUE_ID;
    var messageQueue = {
        MessageBody : JSON.stringify(body),
        QueueUrl:sqsQueue
    };
    if (!ResponseWrapper.SQS)
    {
        ResponseWrapper.SQS = new AWS.SQS({
            region: process.env.AWS_REGION
        });
    }
    await ResponseWrapper.SQS.sendMessage(messageQueue).promise();

}
module.exports = ResponseWrapper;