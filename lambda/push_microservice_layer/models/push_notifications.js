const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION
});
const { v4: uuidv4 } = require('uuid');

/*

- #id - uuid  - searchable
- createdAt - number unixtime
- debtorNumber - number
- notificationPayload - Dictionary
- status - new, delivered, read
- type - default, silent
 */

function objectToItem(object) {
    var item = {};

    if (object.id) item.id = {S: object.id};
    if (object.createdAt) item.createdAt = {N: object.createdAt};
    if (object.debtorNumber) item.debtorNumber = {S: object.debtorNumber};
    if (object.status) item.status = {S: object.status};
    if (object.systemStatus) item.systemStatus = {S: object.systemStatus};
    if (object.details) item.details = {S: object.details};
    if (object.notificationPayload) item.notificationPayload = {S: JSON.stringify(object.notificationPayload)};
    if (object.texts) item.texts = {S: JSON.stringify(object.texts)};
    if (object.type) item.type = {S: object.type};

    return item;
}

function itemToObject(item) {
    var object = {};

    if (item.id) object.id = item.id.S;
    if (item.createdAt) object.createdAt = item.createdAt.N;
    if (item.debtorNumber) object.debtorNumber = item.debtorNumber.S;
    if (item.status) object.status = item.status.S;
    if (item.systemStatus) object.systemStatus = item.systemStatus.S;
    if (item.details) object.details = item.details.S;
    if (item.notificationPayload) object.notificationPayload = JSON.parse(item.notificationPayload.S);
    if (item.texts) object.texts = JSON.parse(item.texts.S);
    if (item.type) object.type = item.type.S;

    return object;
}


var PushNotificationsRepository = {};

PushNotificationsRepository.tableName = "push_notifications";

PushNotificationsRepository.SecondaryIndexes = {
    DebtorNumberCreatedAt: "debtorNumber-createdAt-index",
    DebtorNumberStatus: "debtorNumber-status-index"
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

    var params = {
        Item: objectToItem(data),
        ReturnConsumedCapacity: "TOTAL",
        TableName: PushNotificationsRepository.tableName
    };
    await dynamodb.putItem(params).promise();
    return data;
};

PushNotificationsRepository.get = async function (id) {
    var params = {
        Key: {
            id: {
                S: id
            }
        },
        TableName: PushNotificationsRepository.tableName
    };
    var result = await dynamodb.getItem(params).promise();
    return result.Item ? itemToObject(result.Item) : null;
};

PushNotificationsRepository.findByDebtorNumber = async function (debtorNumber, limit, minCreatedAt, maxCreatedAt, lastKey) {
    if (!limit) limit = 100;
    var params = {
        ExpressionAttributeValues : {
            ":vDebtorNumber": {
                S: debtorNumber,
            }
        },
        IndexName : PushNotificationsRepository.SecondaryIndexes.DebtorNumberCreatedAt,
        KeyConditionExpression : "debtorNumber = :vDebtorNumber",
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

    var result = await dynamodb.query(params).promise();

    console.log(result);
    var items = [];
    for (var index = 0; index < result.Items.length; index++)
    {
        items.push(itemToObject(result.Items[index]));
    }
    var response = {
        items: items
    }
    if (result.LastEvaluatedKey)
    {
        response.lastKey = JSON.stringify(result.LastEvaluatedKey);
    }
    return response;
};

PushNotificationsRepository.findUnreadMessageCounter = async function (debtorNumber) {
    var params = {
        ExpressionAttributeValues : {
            ":vDebtorNumber": {
                S: debtorNumber,
            },
            ":vStatus" : {
                S: PushNotificationsRepository.Status.new
            },
        },
        ExpressionAttributeNames : {
            "#read_status": "status"
        },
        IndexName : PushNotificationsRepository.SecondaryIndexes.DebtorNumberStatus,
        KeyConditionExpression : "debtorNumber = :vDebtorNumber AND #read_status = :vStatus",
        Limit: 100,
        Select: "COUNT",
        ScanIndexForward: true,
        TableName: PushNotificationsRepository.tableName
    };

    var result = await dynamodb.query(params).promise();
    return result.Count;
};


PushNotificationsRepository.remove = async function (id) {
    var params = {
        Key: {
            id: {
                S: id
            }
        },
        TableName: PushNotificationsRepository.tableName
    };
    await dynamodb.deleteItem(params).promise();
};

module.exports = PushNotificationsRepository;
