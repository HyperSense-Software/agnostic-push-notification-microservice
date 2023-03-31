var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION
});

/*
- #deviceToken - string
- userId - string - foreign key
- platform - string - ios/android
 */

var PushDevicesRepository = {};

function objectToItem(object) {
    var item = {};
    if (object.createdAt) item.createdAt = {N: object.createdAt};
    if (object.deviceToken) item.deviceToken = {S: object.deviceToken};
    if (object.userId) item.userId = {S: object.userId};
    if (object.platform) item.platform = {S: object.platform};
    return item;
}

function itemToObject(item) {
    var object = {};
    if (item.createdAt) object.createdAt = item.createdAt.N;
    if (item.deviceToken) object.deviceToken = item.deviceToken.S;
    if (item.userId) object.userId = item.userId.S;
    if (item.platform) object.platform = item.platform.S;
    return object;
}

PushDevicesRepository.tableName = "agnostic_push_devices";

PushDevicesRepository.SecondaryIndexes = {
    userId: "userId-index"
}

PushDevicesRepository.save = async function (data) {
    if (!data.createdAt) data.createdAt = String(new Date().getTime() / 1000);
    var params = {
        Item: objectToItem(data),
        ReturnConsumedCapacity: "TOTAL",
        TableName: PushDevicesRepository.tableName
    };
    await dynamodb.putItem(params).promise();
    return data;
};

PushDevicesRepository.get = async function (id) {
    let params = {
        Key: {
            deviceToken: {
                S: id
            }
        },
        TableName: PushDevicesRepository.tableName
    };
    let result = await dynamodb.getItem(params).promise();
    console.log(`Q: ${params} R: ${result.Item}`);
    return result.Item ? itemToObject(result.Item) : null;
};

PushDevicesRepository.remove = async function (id) {
    var params = {
        Key: {
            deviceToken: {
                S: id
            }
        },
        TableName: PushDevicesRepository.tableName
    };
    await dynamodb.deleteItem(params).promise();
};


PushDevicesRepository.removeByUserId = async function (userId) {
    let items = (await PushDevicesRepository.findByUserId(userId)).items;
    if (!items.length) return;
    var params = {
        RequestItems : {}
    };
    var requests = [];
    for (var index = 0; index < items.length; index++)
    {
        requests.push({
            DeleteRequest : {
                Key : {deviceToken: {S : items[index].deviceToken}}
            }
        });
    }
    params.RequestItems[PushDevicesRepository.tableName] = requests;
    await dynamodb.batchWriteItem(params).promise();
};

PushDevicesRepository.findByUserId = async function (userId) {
    var params = {
        ExpressionAttributeValues : {
            ":vuserId": {
                S: userId,
            }
        },
        IndexName : PushDevicesRepository.SecondaryIndexes.userId,
        KeyConditionExpression : "userId = :vuserId",
        Limit: 100,
        Select: "ALL_ATTRIBUTES",
        ScanIndexForward: true,
        TableName: PushDevicesRepository.tableName
    };

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


module.exports = PushDevicesRepository;
