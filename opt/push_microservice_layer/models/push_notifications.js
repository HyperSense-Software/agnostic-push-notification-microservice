let {
    DeleteItemCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand
} = require("@aws-sdk/client-dynamodb");

const dynamodb = new DynamoDBClient({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION
});
const { v4: uuidv4 } = require('uuid');

const defaultMessageTTL = process.env.APN_MESSAGE_DEFAULT_TTL ? Number.parseInt(process.env.APN_MESSAGE_DEFAULT_TTL) : 0;

/*

- #id - uuid  - searchable
- createdAt - number unixtime
- userId - number
- notificationPayload - Dictionary
- status - new, delivered, read
- type - default, silent
- expiresAt - number
 */

function objectToItem(object) {
    let item = {};

    if (object.id) item.id = {S: object.id};
    if (object.createdAt) item.createdAt = {N: object.createdAt};
    if (object.userId) item.userId = {S: object.userId};
    if (object.status) item.status = {S: object.status};
    if (object.systemStatus) item.systemStatus = {S: object.systemStatus};
    if (object.details) item.details = {S: object.details};
    if (object.notificationPayload) item.notificationPayload = {S: JSON.stringify(object.notificationPayload)};
    if (object.texts) item.texts = {S: JSON.stringify(object.texts)};
    if (object.type) item.type = {S: object.type};
    if (object.expiresAt) item.expiresAt = {N: object.expiresAt};

    return item;
}

function itemToObject(item) {
    let object = {};

    if (item.id) object.id = item.id.S;
    if (item.createdAt) object.createdAt = item.createdAt.N;
    if (item.userId) object.userId = item.userId.S;
    if (item.status) object.status = item.status.S;
    if (item.systemStatus) object.systemStatus = item.systemStatus.S;
    if (item.details) object.details = item.details.S;
    if (item.notificationPayload) object.notificationPayload = JSON.parse(item.notificationPayload.S);
    if (item.texts) object.texts = JSON.parse(item.texts.S);
    if (item.type) object.type = item.type.S;
    if (item.expiresAt) object.expiresAt = item.expiresAt.N;

    return object;
}


let PushNotificationsRepository = {};

PushNotificationsRepository.tableName = "agnostic_push_notifications";

PushNotificationsRepository.SecondaryIndexes = {
    userIdCreatedAt: "userId-createdAt-index",
    userIdStatus: "userId-status-index"
}
PushNotificationsRepository.Status = {
    new: "new",
    read: "read"
}
PushNotificationsRepository.SystemStatus = {
    new: "new",
    error: "error",
    delivered: "delivered"
}


PushNotificationsRepository.save = async function (data) {
    if (!data.id) data.id = uuidv4();
    if (!data.createdAt) data.createdAt = String(new Date().getTime() / 1000);
    if (!data.status) data.status = PushNotificationsRepository.Status.new;
    if (!data.systemStatus) data.systemStatus = PushNotificationsRepository.SystemStatus.new;
    if (!data.expiresAt && defaultMessageTTL) data.expiresAt = String(new Date().getTime() / 1000 + defaultMessageTTL);

    let params = {
        Item: objectToItem(data),
        ReturnConsumedCapacity: "TOTAL",
        TableName: PushNotificationsRepository.tableName
    };

    let putItemCommand = new PutItemCommand(params);
    await dynamodb.send(putItemCommand);
    return data;
};

PushNotificationsRepository.get = async function (id) {
    let params = {
        Key: {
            id: {
                S: id
            }
        },
        TableName: PushNotificationsRepository.tableName
    };
    let getItemCommand = new GetItemCommand(params);
    let result = await dynamodb.send(getItemCommand);
    return result.Item ? itemToObject(result.Item) : null;
};

PushNotificationsRepository.findByUserId = async function (userId, limit, minCreatedAt, maxCreatedAt, lastKey) {
    if (!limit) limit = 100;
    let params = {
        ExpressionAttributeValues : {
            ":vUserId": {
                S: userId,
            }
        },
        IndexName : PushNotificationsRepository.SecondaryIndexes.userIdCreatedAt,
        KeyConditionExpression : "userId = :vUserId",
        Limit: limit,
        Select: "ALL_ATTRIBUTES",
        ScanIndexForward: false,
        TableName: PushNotificationsRepository.tableName
    };
    if (lastKey)
    {
        if (typeof lastKey == "string") lastKey = JSON.parse(lastKey);
        params.ExclusiveStartKey = lastKey;
    }
    if (minCreatedAt)
    {
        params.ExpressionAttributeValues[":vMinCreatedAt"] = {N: minCreatedAt}
        params.KeyConditionExpression += " AND createdAt >= :vMinCreatedAt";
    }
    if (maxCreatedAt)
    {
        params.ExpressionAttributeValues[":vMaxCreatedAt"] = {N: maxCreatedAt}
        params.KeyConditionExpression += " AND createdAt < :vMaxCreatedAt";
    }

    let queryCommand = new QueryCommand(params);
    let result = await dynamodb.send(queryCommand);

    let items = [];
    for (let index = 0; index < result.Items.length; index++)
    {
        items.push(itemToObject(result.Items[index]));
    }
    let response = {
        items: items
    }
    if (result.LastEvaluatedKey)
    {
        response.lastKey = JSON.stringify(result.LastEvaluatedKey);
    }
    return response;
};

PushNotificationsRepository.findUnreadMessageCounter = async function (userId) {
    let params = {
        ExpressionAttributeValues : {
            ":vUserId": {
                S: userId,
            },
            ":vStatus" : {
                S: PushNotificationsRepository.Status.new
            },
        },
        ExpressionAttributeNames : {
            "#read_status": "status"
        },
        IndexName : PushNotificationsRepository.SecondaryIndexes.userIdStatus,
        KeyConditionExpression : "userId = :vUserId AND #read_status = :vStatus",
        Limit: 100,
        Select: "COUNT",
        ScanIndexForward: true,
        TableName: PushNotificationsRepository.tableName
    };

    let queryCommand = new QueryCommand(params);
    let result = await dynamodb.send(queryCommand);
    return result.Count;
};


PushNotificationsRepository.remove = async function (id) {
    let params = {
        Key: {
            id: {
                S: id
            }
        },
        TableName: PushNotificationsRepository.tableName
    };
    let deleteItemCommand = new DeleteItemCommand(params);
    await dynamodb.send(deleteItemCommand);
};

module.exports = PushNotificationsRepository;
