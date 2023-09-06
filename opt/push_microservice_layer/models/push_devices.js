let {
    BatchWriteItemCommand,
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

/*
- #deviceToken - string
- userId - string - foreign key
- platform - string - ios/android
 */

const PushDevicesRepository = {};

function objectToItem(object) {
    let item = {};
    if (object.createdAt) item.createdAt = {N: object.createdAt};
    if (object.deviceToken) item.deviceToken = {S: object.deviceToken};
    if (object.userId) item.userId = {S: object.userId};
    if (object.platform) item.platform = {S: object.platform};
    return item;
}

function itemToObject(item) {
    let object = {};
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
    let params = {
        Item: objectToItem(data),
        ReturnConsumedCapacity: "TOTAL",
        TableName: PushDevicesRepository.tableName
    };
    let putItemCommand = new PutItemCommand(params);
    await dynamodb.send(putItemCommand);
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
    let getItemCommand = new GetItemCommand(params);
    let result = await dynamodb.send(getItemCommand);
    return result.Item ? itemToObject(result.Item) : null;
};

PushDevicesRepository.remove = async function (id) {
    let params = {
        Key: {
            deviceToken: {
                S: id
            }
        },
        TableName: PushDevicesRepository.tableName
    };
    let deleteItemCommand = new DeleteItemCommand(params);
    await dynamodb.send(deleteItemCommand);
};


PushDevicesRepository.removeByUserId = async function (userId) {
    let items = (await PushDevicesRepository.findByUserId(userId)).items;
    if (!items.length) return;
    let params = {
        RequestItems : {}
    };
    let requests = [];
    for (let index = 0; index < items.length; index++)
    {
        requests.push({
            DeleteRequest : {
                Key : {deviceToken: {S : items[index].deviceToken}}
            }
        });
    }
    params.RequestItems[PushDevicesRepository.tableName] = requests;
    let batchWriteItemCommand = new BatchWriteItemCommand(params);
    await dynamodb.send(batchWriteItemCommand);
};

PushDevicesRepository.findByUserId = async function (userId) {
    let params = {
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


module.exports = PushDevicesRepository;
