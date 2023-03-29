import { Construct } from "constructs";
import {
  Duration,
  Stack,
  StackProps,
  aws_apigateway as apigw,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_secretsmanager as secrets,
  aws_dynamodb as dynamodb,
  RemovalPolicy,
  aws_sqs as sqs
} from "aws-cdk-lib";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";

//lambda settings
const memSize = 256;
const timeout = 60;

//queue settings
const outputQueueName = "AgnosticPushNotificationsOutputQueue"
const inputQueueName = "AgnosticPushNotificationsInputQueue"
const queueVisibilityTimeout = 120;

//secret
let secretName = "AgnosticPushNotificationsSecret";

class AgnosticPushNotificationsStack extends Stack {

  lambdaLayer = undefined;
  clientEndpoint = undefined;
  authorizer = undefined;

  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const apiPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ["execute-api:Invoke"],
          resources: ["*"],
          principals: [new iam.AnyPrincipal()],
          effect: iam.Effect.ALLOW
        })
      ]
    });

    this.lambdaLayer = new lambda.LayerVersion(this, 'PushMicroserviceLayer', {
      code: lambda.Code.fromAsset('lambda/push_microservice_layer'),
      layerVersionName: 'PushMicroserviceLayer',
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X]
    });


    //API Endpoint
    this.clientEndpoint = new apigw.RestApi(this, 'PushNotificationsEndpoint', {
      restApiName: 'Push Notifications Endpoint for Client',
      policy: apiPolicy,
      endpointConfiguration: {
        types: [apigw.EndpointType.EDGE],
      },
    });

    let dynamoDBTables = this.setupDynamoDBTables();
    let methods = this.setupClientMethods();
    let serverMethod = this.createServerRequestQueuesAndLambda();

    //Allow lambdas to access dynamo
    for (let dIndex = 0; dIndex< dynamoDBTables.length; dIndex++)
    {
      dynamoDBTables[dIndex].grantReadWriteData(serverMethod.role!);
      for (let mIndex = 0; mIndex< methods.length; mIndex++)
      {
        dynamoDBTables[dIndex].grantReadWriteData(methods[mIndex].role!);
      }
    }

    const secretsManager = secrets.Secret.fromSecretNameV2(
        this,
        'Secret',
        secretName);
    secretsManager.grantRead(serverMethod.role!);
    for (let mIndex = 0; mIndex< methods.length; mIndex++)
    {
      secretsManager.grantRead(methods[mIndex].role!);
    }
  }

  //*********************** Endpoint Lambda Helpers ********************//

  /***
   * Setup the client methods.
   * This creates the remotes that are intended to be called from iOS or Android applications
   */
  setupClientMethods(): lambda.Function[] {
    let clientMethods = [];

    let method = this.createMethodHelper('UpdateToken',
        "handlers/update_token",
        "updateToken",
        "Register or update a firebase token for a given user.Ex: user logged in on a new device");
    clientMethods.push(method);

    method = this.createMethodHelper('RemoveToken',
        "handlers/remove_token",
        "removeToken",
        "Remove a firebase token for a given user. Ex: user logged out"
    );
    clientMethods.push(method);

    method = this.createMethodHelper('GetMessages',
        "handlers/get_messages",
        "getMessages",
        "Retrieve messages for a user.");
    clientMethods.push(method);

    method = this.createMethodHelper('GetMessage',
        "handlers/get_message",
        "getMessage",
        "Retrieve a specific message");
    clientMethods.push(method);

    method = this.createMethodHelper('MarkAsRead',
        "handlers/mark_as_read",
        "markAsRead",
        "Mark a specific message as read");
    clientMethods.push(method);

    method = this.createMethodHelper('GetUnreadCounter',
        "handlers/get_unread_counter",
        "getUnreadCounter",
        "Get the number of unread messages");
    clientMethods.push(method);

    return clientMethods
  }

  /**
   * Helper to create a Lambda that can be called using the gateway
   * @param id - id of the lambda
   * @param asset - asset location, should be in handlers - this expects an index.handler to exist
   * @param pathPart - path for the call "endpoint/prod/<pathPart>" will the API call
   * @param description - Description of the method
   */
  createMethodHelper(id, asset, pathPart, description): lambda.Function {
    const lambdaFunction = new lambda.Function(this, id, {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset(asset),
      handler: 'index.handler',
      layers: [this.lambdaLayer],
      memorySize: memSize,
      timeout: Duration.seconds(timeout),
      description: description
    });

    const endpointIntegration = new apigw.LambdaIntegration(lambdaFunction, {});
    const resource = this.clientEndpoint.root.addResource(pathPart);
    resource.addMethod(
        'POST',
        endpointIntegration, {
          authorizer: this.authorizer
        });

    return lambdaFunction;
  }

  //*********************** Server Queue ********************//
  createServerRequestQueuesAndLambda(): lambda.Function {
    const outputQueue = new sqs.Queue(this, outputQueueName, {
      visibilityTimeout: Duration.seconds(queueVisibilityTimeout),
    });

    const lambdaFunction = new lambda.Function(this, 'ServerFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset('handlers/server_request'),
      handler: 'index.handler',
      layers: [this.lambdaLayer],
      environment: {
        'SERVER_RESPONSE_QUEUE_ID': outputQueue.queueUrl,
      },
      memorySize: memSize,
      timeout: Duration.seconds(timeout),
    });

    outputQueue.grantSendMessages(lambdaFunction.role!);

    const inputQueue = new sqs.Queue(this, inputQueueName, {
      visibilityTimeout: Duration.seconds(queueVisibilityTimeout),
    });

    const eventSource = new SqsEventSource(inputQueue, {
      batchSize: 1
    });
    lambdaFunction.addEventSource(eventSource);

    return lambdaFunction;
  }

  //*********************** Dynamo Helpers ********************//
  setupDynamoDBTables() : dynamodb.Table[]
  {
    let tables = [];

    const pushDevicesTable = new dynamodb.Table(this, 'push_devices', {
      partitionKey: {
        name: 'deviceToken',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'push_devices',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    pushDevicesTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
    });
    this.addScalingToTable(pushDevicesTable);
    this.addScalingToIndex(pushDevicesTable, 'userId-index');
    tables.push(pushDevicesTable);

    const pushNotificationsTable = new dynamodb.Table(this, 'push_notifications', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'push_notifications',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    pushNotificationsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER
      }
    });
    pushNotificationsTable.addGlobalSecondaryIndex({
      indexName: 'userId-status-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING
      }
    });
    this.addScalingToTable(pushNotificationsTable);
    this.addScalingToIndex(pushNotificationsTable, 'userId-createdAt-index');
    this.addScalingToIndex(pushNotificationsTable, 'userId-status-index');
    tables.push(pushNotificationsTable);

    const pushNotificationsLogTable = new dynamodb.Table(this, 'push_notifications_log', {
      partitionKey: {
        name: 'firebaseId',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'push_notifications_log',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.addScalingToTable(pushNotificationsLogTable);
    tables.push(pushNotificationsLogTable);

    return tables;

  }
  addScalingToTable(table: dynamodb.Table): void {
    const readScaling = table.autoScaleReadCapacity({
      minCapacity: 5,
      maxCapacity: 20
    });
    readScaling.scaleOnUtilization({
      targetUtilizationPercent: 50
    });

    const writeScaling = table.autoScaleWriteCapacity({
      minCapacity: 5,
      maxCapacity: 20
    });
    writeScaling.scaleOnUtilization({
      targetUtilizationPercent: 50
    });
  }

  addScalingToIndex(
      table: dynamodb.Table,
      indexName: string
  ): void {
    const readScaling = table.autoScaleGlobalSecondaryIndexReadCapacity(
        indexName,
        {
          minCapacity: 5,
          maxCapacity: 20
        }
    );
    readScaling.scaleOnUtilization({
      targetUtilizationPercent: 50
    });

    const writeScaling = table.autoScaleGlobalSecondaryIndexWriteCapacity(
        indexName,
        {
          minCapacity: 5,
          maxCapacity: 20
        }
    );
    writeScaling.scaleOnUtilization({
      targetUtilizationPercent: 50
    });
  }
}