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
  aws_sqs as sqs,
  aws_cognito as cognito,
  aws_route53 as route53,
  aws_certificatemanager as acm,
  aws_route53_targets as r53targets,
  aws_logs as logs, Tags
} from "aws-cdk-lib";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";
import * as os from "os";
import {AccessLogFormat} from "aws-cdk-lib/aws-apigateway/lib/access-log";

//Deployment helper
const buildNumber = 1;

// custom domain endpoint
const hostedZoneId = process.env.HOSTED_ZONE_ID; //Should be Z*******;
const zoneName = process.env.ZONE_NAME;
const certificateArn = process.env.CERTIFICATE_ARN;// Should be  arn:aws:acm:<zone>:<account_id>:certificate/<id>";
const apiDomain = process.env.API_DOMAIN;

//table settings
const removalPolicy = RemovalPolicy.RETAIN;

//authorizer
const userPoolId = process.env.USER_POOL_ID!;

//lambda settings
const memSize = 256;
const timeout = 60;

//queue settings
const outputQueueName = "AgnosticPushNotificationsOutputQueue"
const inputQueueName = "AgnosticPushNotificationsInputQueue"
const queueVisibilityTimeout = 120;

//secret
let secretName = "AgnosticPushNotificationsSecret";

export class AgnosticPushNotificationsStack extends Stack {

  lambdaLayer: lambda.LayerVersion;

  clientEndpoint: apigw.RestApi;
  clientAuthorizer: apigw.Authorizer;

  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope: Construct, id: string, props: StackProps | undefined) {
    super(scope, id, props);

    this.lambdaLayer = new lambda.LayerVersion(this, 'AgnosticPushMicroserviceLayer', {
      code: lambda.Code.fromAsset('opt'),
      layerVersionName: 'AgnosticPushMicroserviceLayer',
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X]
    });

    let userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId);
    this.clientAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'AgnosticPushNotificationsClientAuthorizer', {
      cognitoUserPools: [userPool]
    });

    this.setupClientEndpoint();

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

  //******************** Setup Client Endpoint ******************//
  setupClientEndpoint(){
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

    const clientLogGroup = new logs.LogGroup(
        this,
        'AgnosticPushNotificationsEndpointLogGroup'
    );

    //https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#input-variable-reference
    const accessLogFormat = apigw.AccessLogFormat.custom(JSON.stringify(
        {
          "stage" : "$context.stage",
          "request_id" : "$context.requestId",
          "api_id" : "$context.apiId",
          "resource_path" : "$context.resourcePath",
          "resource_id" : "$context.resourceId",
          "http_method" : "$context.httpMethod",
          "authorizer_status": "$context.authorizer.status",

          "source_ip" : "$context.identity.sourceIp",
          "user-agent" : "$context.identity.userAgent",
          "user_id": "$context.authorizer.claims.sub",
          "user_email": "$context.authorizer.claims.email",

          "response_latency": "$context.responseLatency",
          "authorizer_latency": "$context.authorizer.latency",
          "integration_latency": "$context.integration.latency",
          "waf_latency":"$context.waf.latency",
          "authenticate_latency": "$context.authenticate.latency",
        }
    ));

    this.clientEndpoint = new apigw.RestApi(this, 'AgnosticPushNotificationsEndpoint', {
      restApiName: 'Push Notifications Endpoint for Client',
      policy: apiPolicy,
      endpointConfiguration: {
        types: [apigw.EndpointType.REGIONAL],
      },
      deployOptions :{
        accessLogDestination: new apigw.LogGroupLogDestination(clientLogGroup),
        accessLogFormat: accessLogFormat,
        tracingEnabled: false,
        dataTraceEnabled: true,
        metricsEnabled: true,
      }
    });

    this.clientEndpoint.addGatewayResponse("PathOrMethodMaybeFound",
        {
          type: apigw.ResponseType.MISSING_AUTHENTICATION_TOKEN,
          templates: {
            "application/json": `{"message": "$context.error.message", "hint": "Is the method/path combination correct? Check:${apiDomain ?? this.clientEndpoint.url}/status as well"}`
          }
        })

    //Custom domain setup
    if (hostedZoneId && zoneName && certificateArn && apiDomain)
    {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'ImportedHostedZone', {
        hostedZoneId: hostedZoneId,
        zoneName: zoneName,
      });


      const certificate = acm.Certificate.fromCertificateArn(this, "DomainCertificate", certificateArn)

      // custom domain with multiple apis
      // let domain = new apigw.DomainName(this, 'custom-domain', {
      //   domainName: apiDomain,
      //   certificate: certificate,
      //   endpointType: apigw.EndpointType.REGIONAL,
      //   securityPolicy: apigw.SecurityPolicy.TLS_1_2
      // });
      // domain.addBasePathMapping(this.clientEndpoint, { basePath: 'status' });


      this.clientEndpoint.addDomainName("AgnosticPushNotificationsAPI", {
        domainName: apiDomain,
        certificate: certificate,
        securityPolicy: apigw.SecurityPolicy.TLS_1_2,
        endpointType: apigw.EndpointType.REGIONAL
      });

      new route53.ARecord(this, 'AgnosticPushNotificationsAPI', {
        zone,
        recordName: apiDomain,
        target: route53.RecordTarget.fromAlias(new r53targets.ApiGateway(this.clientEndpoint)),
      });

    }
    else
    {
      console.warn("No setup for custom domain")
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

    //this is not added to client methods because it doesn't need access to secrets or dynamo
    this.createStatusMethodHelper()

    //add 404
    this.create404Helper()

    return clientMethods
  }

  /**
   * Helper to create a Lambda that can be called using the gateway
   * @param id - id of the lambda
   * @param asset - asset location, should be in handlers - this expects an index.handler to exist
   * @param pathPart - path for the call "endpoint/prod/<pathPart>" will the API call
   * @param description - Description of the method
   */
  createMethodHelper(id: string, asset: string, pathPart: string, description: string, methodVerb: string = 'POST'): lambda.Function {
    const lambdaFunction = new lambda.Function(this, id, {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(asset),
      handler: 'index.handler',
      layers: [this.lambdaLayer],
      environment: {
        'SECRET_NAME': secretName
      },
      memorySize: memSize,
      timeout: Duration.seconds(timeout),
      description: description,
      retryAttempts: 0
    });

    const endpointIntegration = new apigw.LambdaIntegration(lambdaFunction, {});
    const resource = this.clientEndpoint.root.addResource(pathPart);
    resource.addMethod(
        methodVerb,
        endpointIntegration, {
          authorizer: this.clientAuthorizer
        });

    return lambdaFunction;
  }

  /**
   * Helper to create the status method
   */
  createStatusMethodHelper(): lambda.Function {
    let deployMessage = JSON.stringify({
      deployment_date: new Date(),
      deployed_by: os.hostname(),
      build: buildNumber,
      details: "Added log monitoring"
    });
    const lambdaFunction = new lambda.Function(this, 'Status', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("handlers/microservice_status"),
      handler: 'index.handler',
      layers: [this.lambdaLayer],
      environment: {
        'DEPLOY_DETAIL' : deployMessage
      },
      memorySize: memSize,
      timeout: Duration.seconds(timeout),
      description: "Microservice status status"
    });

    const endpointIntegration = new apigw.LambdaIntegration(lambdaFunction, {});
    const resource = this.clientEndpoint.root.addResource("status");
    resource.addMethod(
        'GET',
        endpointIntegration);

    return lambdaFunction;
  }

  /**
   * Helper to respond with 404
   */
  create404Helper() {
    const endpointIntegration = new apigw.MockIntegration({
          requestTemplates: {
            "application/json": `{"statusCode": 404}`
          },
          integrationResponses: [
            {
              statusCode: "404",
              responseTemplates: {
                "application/json": `"Method/Path combination not found. Please check the documentation."`
              }
            }
          ]
        })
    this.clientEndpoint.root.addResource("{proxy+}").addMethod(
        "ANY",
        endpointIntegration,
        {
          methodResponses: [{ statusCode: "404" }]
        });
  }


  //*********************** Server Queue ********************//
  createServerRequestQueuesAndLambda(): lambda.Function {
    const outputQueue = new sqs.Queue(this, outputQueueName, {
      visibilityTimeout: Duration.seconds(queueVisibilityTimeout),
    });

    const lambdaFunction = new lambda.Function(this, 'ServerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('handlers/server_request'),
      handler: 'index.handler',
      layers: [this.lambdaLayer],
      environment: {
        'SERVER_RESPONSE_QUEUE_ID': outputQueue.queueUrl,
        'SECRET_NAME': secretName
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

    const pushDevicesTable = new dynamodb.Table(this, 'agnostic_push_devices', {
      partitionKey: {
        name: 'deviceToken',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'agnostic_push_devices',
      removalPolicy: removalPolicy,
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

    const pushNotificationsTable = new dynamodb.Table(this, 'agnostic_push_notifications', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'agnostic_push_notifications',
      removalPolicy: removalPolicy,
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

    const pushNotificationsLogTable = new dynamodb.Table(this, 'agnostic_push_notifications_log', {
      partitionKey: {
        name: 'firebaseId',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'agnostic_push_notifications_log',
      removalPolicy: removalPolicy,
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