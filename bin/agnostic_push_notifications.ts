#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { AgnosticPushNotificationsStack } = require('../lib/agnostic_push_notifications-stack');
import 'source-map-support/register';

const app = new cdk.App();
new AgnosticPushNotificationsStack(app, 'AgnosticPushNotificationsStack', {
    env: {
        // change this if you have multiple AWS accounts on your system
        // account: <id of your account>,
        region: 'eu-west-1'
    }
});
