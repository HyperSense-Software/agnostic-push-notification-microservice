let ResponseWrapper = {}
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
module.exports = ResponseWrapper;