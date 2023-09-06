let {
    DeleteItemCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamodb = new DynamoDBClient({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION
});

const { v4: uuidv4 } = require('uuid');

/*
#firebaseId - string
notificationID - string - foreign key
deviceToken - string - foreign key
status - new, delivered
details - string
 */


let PushNotificationsLogRepository = {};
PushNotificationsLogRepository.Status = {
    new: "new",
    tokenUpdate: "tokenUpdate",
    delivered: "delivered",
    error: "error",
}
function objectToItem(object) {
    let item = {};
    if (object.createdAt) item.createdAt = {N: object.createdAt};
    if (object.firebaseId) item.firebaseId = {S: object.firebaseId};
    if (object.notificationID) item.notificationID = {S: object.notificationID};
    if (object.deviceToken) item.deviceToken = {S: object.deviceToken};
    if (object.status) item.status = {S: object.status};
    if (object.details) item.details = {S: object.details};

    return item;
}

function itemToObject(item) {
    let object = {};
    if (item.createdAt) object.createdAt = item.createdAt.N;
    if (item.deviceToken) object.deviceToken = item.deviceToken.S;
    if (item.firebaseId) object.firebaseId = item.firebaseId.S;
    if (item.deviceToken) object.deviceToken = item.deviceToken.S;
    if (item.status) object.status = item.status.S;
    if (item.details) object.status = item.details.S;
    return object;
}

PushNotificationsLogRepository.tableName = "agnostic_push_notifications_log";
PushNotificationsLogRepository.save = async function (data) {
    if (!data.firebaseId) data.firebaseId = "System-" + uuidv4();
    if (!data.createdAt) data.createdAt = String(new Date().getTime() / 1000);
    let params = {
        Item: objectToItem(data),
        ReturnConsumedCapacity: "TOTAL",
        TableName: PushNotificationsLogRepository.tableName
    };
    let putItemCommand = new PutItemCommand(params);
    await dynamodb.send(putItemCommand);
    return data;
};

PushNotificationsLogRepository.get = async function (id) {
    let params = {
        Key: {
            deviceToken: {
                S: id
            }
        },
        TableName: PushNotificationsLogRepository.tableName
    };
    let getItemCommand = new GetItemCommand(params);
    let result = await dynamodb.send(getItemCommand);
    return result.Item ? itemToObject(result.Item) : null;
};

PushNotificationsLogRepository.remove = async function (id) {
    let params = {
        Key: {
            firebaseId: {
                S: id
            }
        },
        TableName: PushNotificationsLogRepository.tableName
    };
    let deleteItemCommand = new DeleteItemCommand(params);
    await dynamodb.send(deleteItemCommand);
};

module.exports = PushNotificationsLogRepository;
