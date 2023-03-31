# Agnostic Push Notification Microservice

Welcome to our newest open-source software project - an agnostic push notification microservice! This service is developed using AWS Cloud Development Kit (CDK) and JavaScript, offering a highly flexible and efficient solution for managing push notifications in mobile applications.

This project is developed by [HyperSense Software](https://hypersense-software.com/) and it is distributed under an MIT License.

Our agnostic push notification microservice leverages the power of AWS services to provide a seamless experience. At its core, the API Gateway exposes endpoints that enable mobile apps to register Firebase tokens. With the help of AWS Cognito, secure access is ensured through the authorization of incoming requests.

This microservice is designed to handle various aspects of push notifications, including associating user IDs with their respective Firebase tokens, sending push notifications, maintaining read counts, managing notification lists, and offering other functionalities aimed at improving the push notification experience.

Another vital element of the microservice is an SQS queue that allows other microservices to send push notifications to users. By saving sent messages and maintaining logs using DynamoDB, the push notification microservice offers a reliable and efficient method for tracking notifications and ensuring smooth operation.

# Microservice high-level diagram

Please find below a high-level diagram outlining the main components of this node.js microservice. 

![push notification node.js microservice](https://hypersense-software.com/blogs-assets/a4c4cc18-f373-4701-8cf5-18fd66b128be/Notifications-CDK.jpg)

# Setup and deploy
Some resources will need to be created, while others be provided

## AWS resources
### Need to be provided
The following must be created manually or by other systems
- Secret Manager named **AgnosticPushNotificationsSecret**
- User Pool

### Will be created during deploy
The following will be created during deployment
- ApiGateway: **AgnosticPushNotificationsEndpoint**
- DynamoDb tables: **agnostic_push_devices**, **agnostic_push_notifications**, **agnostic_push_notifications_log**
- Lambda layer: **AgnosticPushMicroserviceLayer**
- Lambdas
- CloudWatch Log Groups
- Input and Output Queues


## Environment variables for deployment
### Authorizer pool 
    USER_POOL_ID=<enter your id>

# Sample messages for input queue

## Sending a notification
Templates are part of the code, check [Template](./opt/push_microservice_layer/resources/notificationTemplates.json)
Input queue sample message:
``` json
{
    "requestID":"sample",
    "requestType":"send_message",
    "requestParams" : {
        "userId" :"4368d4ff-e8f5-4788-8e66-30418eafa5af",
        "templateId" : "hello_world",
        "templateParams" : {"USER_NAME":"Jane"}
    }
}
```
Output queue sample message
```json
{
  "requestID":"sample2",
  "response":{
    "type":"default",
    "userId":"4368d4ff-e8f5-4788-8e66-30418eafa5af",
    "id":"94f11d92-9ecf-4cf8-8b3e-901e8227d8ac",
    "notificationPayload":{
      "userId":"4368d4ff-e8f5-4788-8e66-30418eafa5af",
      "templateId":"hello_world",
      "templateParams":{"USER_NAME":"Mirela"},
      "type":"default"
    },
    "texts":{
      "ios":{"title":"Hello Jane","body":"Glad to see an iOS fan"},
      "android":{"title":"Hello Jane","body":"I like android better"}
    },
    "createdAt":"1680268046.989",
    "status":"new",
    "systemStatus":"new"
  }
}
```