# Welcome to your CDK JavaScript project

This is a blank project for CDK development with JavaScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app. The build step is not required when using JavaScript.

## Useful commands

* `npm run test`         perform the jest unit tests
* `cdk deploy`           deploy this stack to your default AWS account/region
* `cdk diff`             compare deployed stack with current state
* `cdk synth`            emits the synthesized CloudFormation template

## Setup
This is intended to deploy on the **default AWS** on **eu-west-1**. To alter this behaviour edit bin/agnostic_push_notifications.ts
This requires a secret named **AgnosticPushNotificationsSecret** exists and is configured on eu-west-1

