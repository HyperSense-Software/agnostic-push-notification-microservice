let sendMessage = require("../handlers/server_request/index.js");

let message = {
    "requestId":"test",
    "requestType":"send_message",
    "requestParams": {
        "userId":"4368d4ff-e8f5-4788-8e66-30418eafa5af",
        "expiresAt":1730729843,
        "templateId":"hello_world",
        "templateParams" : {"USER_NAME":"test"} }
};

sendMessage.handler({body: JSON.stringify(message)})
    .then(function (done){})
    .catch(function (e){console.log(e)});
