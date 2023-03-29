var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION
});

/*
- #deviceToken - string
- debtorNumber - string - foreign key
- platform - string - ios/android
 */

var PushDevicesRepository = {};

function objectToItem(object) {
    var item = {};
    if (object.createdAt) item.createdAt = {N: object.createdAt};
    if (object.deviceToken) item.deviceToken = {S: object.deviceToken};
    if (object.debtorNumber) item.debtorNumber = {S: object.debtorNumber};
    if (object.platform) item.platform = {S: object.platform};
    return item;
}

function itemToObject(item) {
    var object = {};
    if (item.createdAt) object.createdAt = item.createdAt.N;
    if (item.deviceToken) object.deviceToken = item.deviceToken.S;
    if (item.debtorNumber) object.debtorNumber = item.debtorNumber.S;
    if (item.platform) object.platform = item.platform.S;
    return object;
}

PushDevicesRepository.tableName = "push_devices";

PushDevicesRepository.SecondaryIndexes = {
    DebtorNumber: "debtorNumber-index"
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
    var params = {
        Key: {
            deviceToken: {
                S: id
            }
        },
        TableName: PushDevicesRepository.tableName
    };
    var result = await dynamodb.getItem(params).promise();
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


PushDevicesRepository.removeDebtor = async function (debtorNumber) {
    let items = (await PushDevicesRepository.findByDebtorNumber(debtorNumber)).items;
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

PushDevicesRepository.findByDebtorNumber = async function (debtorNumber) {
    var params = {
        ExpressionAttributeValues : {
            ":vDebtorNumber": {
                S: debtorNumber,
            }
        },
        IndexName : PushDevicesRepository.SecondaryIndexes.DebtorNumber,
        KeyConditionExpression : "debtorNumber = :vDebtorNumber",
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
