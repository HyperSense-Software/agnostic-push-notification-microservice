import * as cdk from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';
import * as APNSStack from '../lib/agnostic_push_notifications-stack';
import assert = require("assert");

beforeAll(() => {
  assert(process.env.USER_POOL_ID, "USER_POOL_ID is not set");
  assert(process.env.HOSTED_ZONE_ID, "HOSTED_ZONE_ID is not set");
  assert(process.env.ZONE_NAME, "ZONE_NAME is not set");
  assert(process.env.CERTIFICATE_ARN, "CERTIFICATE_ARN is not set");
  assert(process.env.API_DOMAIN, "API_DOMAIN is not set");

});
test('DynamoDBSetup', () => {

  const app = new cdk.App();
  const stack = new APNSStack.AgnosticPushNotificationsStack(app, 'DynamoDBSetup', undefined);

  const template = Template.fromStack(stack);
  let tableNames = ['agnostic_push_notifications_log', 'agnostic_push_devices', 'agnostic_push_notifications'];
  template.resourceCountIs('AWS::DynamoDB::Table', tableNames.length);

  for (let index = 0; index < 3; index++) {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: tableNames[index]
    });
  }
});

test('SQSSetup', () => {

  const app = new cdk.App();
  const stack = new APNSStack.AgnosticPushNotificationsStack(app, 'DynamoDBSetup', undefined);

  const template = Template.fromStack(stack);
  let queues = ['AgnosticPushNotificationsInputQueue', 'AgnosticPushNotificationsOutputQueue'];
  template.resourceCountIs('AWS::SQS::Queue', queues.length);
});

test('LambdaSetup', () => {

  const app = new cdk.App();
  const stack = new APNSStack.AgnosticPushNotificationsStack(app, 'DynamoDBSetup', undefined);

  const template = Template.fromStack(stack);
  let lambdas = [
      "AgnosticPushNotificationsStack/ServerFunction/Resource",
    "AgnosticPushNotificationsStack/GetMessage/Resource",
    "AgnosticPushNotificationsStack/GetMessages/Resource",
    "AgnosticPushNotificationsStack/MarkAsRead/Resource",
    "AgnosticPushNotificationsStack/UpdateToken/Resource",
    "AgnosticPushNotificationsStack/RemoveToken/Resource",
    "AgnosticPushNotificationsStack/GetUnreadCounter/Resource",
    "AgnosticPushNotificationsStack/Status/Resource",
  ];
  //there are 8 lambdas
  template.resourcePropertiesCountIs('AWS::Lambda::Function',
      {
        Handler: "index.handler",
        MemorySize: 256,
        Runtime: "nodejs18.x",
        Timeout: 60,
      },lambdas.length);

  //7 of them have access to SecretManager
  template.resourcePropertiesCountIs('AWS::Lambda::Function',
      {
        Handler: "index.handler",
        MemorySize: 256,
        Runtime: "nodejs18.x",
        Timeout: 60,
        Environment :{
          Variables: {
            "SECRET_NAME": "AgnosticPushNotificationsSecret"
          }
        }
      },lambdas.length - 1);

  //1 layer
  template.resourcePropertiesCountIs('AWS::Lambda::LayerVersion', {
    CompatibleRuntimes: [
      "nodejs18.x"
    ],
    LayerName: "AgnosticPushMicroserviceLayer"
  },1);
});

test('APIGatewaySetup', () => {
  const app = new cdk.App();
  const stack = new APNSStack.AgnosticPushNotificationsStack(app, 'DynamoDBSetup', undefined);

  const template = Template.fromStack(stack);
  template.resourcePropertiesCountIs('AWS::ApiGateway::Authorizer', {
    IdentitySource: "method.request.header.Authorization",
    Type: "COGNITO_USER_POOLS"
  },1);
  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);

  //6 user facing methods
  template.resourcePropertiesCountIs('AWS::ApiGateway::Method', {
    AuthorizationType: "COGNITO_USER_POOLS",
  },6);

});

